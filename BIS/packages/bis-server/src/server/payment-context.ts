import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { RestArkProvider, RestIndexerProvider, DefaultVtxo, getNetwork, defaultCheckpointExitDelayPolicy, assertValidServerUnrollScript, canSpendOffchain, type ArkInfo, type VirtualCoin } from '@arkade-os/sdk';
import type { GameNetwork } from './environment.ts';
import type { TrustedPaymentContext } from './offchain-policy.ts';
import { parseGameContractIntent, gameContractScripts, type GameContractIntent } from './contract-policy.ts';
import {inspectTreasureDirectPolicy} from '../../../integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import {verifyTreasureFundingTransaction,type TreasureTrustedContext} from './treasure-contract-policy.ts';

const refuse = () => Error('Fresh payment context could not be verified.');
const bytes = (hex: string) => {
  if (!/^(?:[a-f0-9]{64}|0[23][a-f0-9]{64})$/.test(hex)) throw refuse();
  return Uint8Array.from(Buffer.from(hex.slice(-64), 'hex'));
};
type Outpoint = { txid: string; vout: number };
type Reader = { info(): Promise<ArkInfo>; coins(outpoints: Outpoint[]): Promise<{ vtxos: VirtualCoin[]; page?: unknown }>; transactions?(ids:string[]):Promise<{txs:string[]}> };

/** Read-only validation, not transaction preparation/submission or a journal.
 * The caller must verify the Player authority before supplying its public key.
 * Only outpoint references are taken from the proposed client transaction.
 */
export async function readPaymentContext(options: {
  network: GameNetwork; gamePublicKey: string; playerPublicKey: string;
  outpoints: readonly Outpoint[]; maximumExposureSats: number; signal: AbortSignal;
  allowAssets?: boolean;
  contract?: GameContractIntent;
}, reader?: Reader): Promise<TrustedPaymentContext> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(10000)]);
  signal.throwIfAborted();
  if (!['signet', 'mutinynet'].includes(options.network) || !/^0[23][a-f0-9]{64}$/.test(options.gamePublicKey) || !/^0[23][a-f0-9]{64}$/.test(options.playerPublicKey) ||
      options.outpoints.length === 0 || options.outpoints.length > 100 || !Number.isSafeInteger(options.maximumExposureSats) || options.maximumExposureSats <= 0 || options.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS) throw refuse();
  const outpoints = options.outpoints.map(input => ({ ...input }));
  const ids = outpoints.map(input => {
    if (!/^[a-f0-9]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff) throw refuse();
    return `${input.txid}:${input.vout}`;
  });
  if (new Set(ids).size !== ids.length) throw refuse();
  const operator = options.network === 'signet' ? 'https://signet.arkade.sh' : 'https://mutinynet.arkade.sh';
  if (!reader) {
    const ark = new RestArkProvider(operator), indexer = new RestIndexerProvider(operator);
    reader = { info: () => ark.getInfo(), coins: outpoints => indexer.getVtxos({ outpoints, spendableOnly: true }),transactions:ids=>indexer.getVirtualTxs(ids) };
  }
  let abort: () => void = () => {};
  try {
    return await Promise.race([(async () => {
      const info = await reader!.info();
      signal.throwIfAborted();
      if (info.network !== options.network || typeof info.unilateralExitDelay !== 'bigint' || info.unilateralExitDelay <= 0n) throw refuse();
      const serverKey = bytes(info.signerPubkey), forfeitKey = bytes(info.forfeitPubkey);
      const serverUnrollScript = assertValidServerUnrollScript(info.checkpointTapscript, { ...defaultCheckpointExitDelayPolicy(getNetwork(options.network)), advertisedForfeitPubkey: forfeitKey });
      const script = (key: string) => new DefaultVtxo.Script({ pubKey: bytes(key), serverPubKey: serverKey, csvTimelock: { value: info.unilateralExitDelay, type: info.unilateralExitDelay < 512n ? 'blocks' : 'seconds' } });
      const game = script(options.gamePublicKey), player = script(options.playerPublicKey);
      const intent=options.contract===undefined?undefined:parseGameContractIntent(options.contract);
      if(intent&&'artifactVersion' in intent){if(options.network!=='mutinynet')throw refuse();inspectTreasureDirectPolicy(options.network,info);}
      const contract = intent === undefined ? undefined : gameContractScripts(intent, game, {
        gameKey: bytes(options.gamePublicKey), playerKey: bytes(options.playerPublicKey), operatorKey: serverKey, exitDelay: info.unilateralExitDelay,
      },{network:options.network,observedAtMs:Date.now()});
      const source = contract?.source ?? game, leaf = contract?.leaf ?? game.forfeit();
      const changeScript = game.pkScript, recipientScript = contract?.recipientScript ?? player.pkScript;
      const response = await reader!.coins(outpoints);
      signal.throwIfAborted();
      // Every requested source must be present exactly once in this fresh
      // answer. A paginated, incomplete or unrelated answer is not authority.
      if (!Array.isArray(response.vtxos) || response.vtxos.length !== ids.length || response.page) throw refuse();
      const coins = new Map(response.vtxos.map(coin => [`${coin.txid}:${coin.vout}`, coin]));
      if (coins.size !== ids.length) throw refuse();
      const inputs = ids.map(id => {
        const coin = coins.get(id);
        if (!coin || coin.script !== Buffer.from(source.pkScript).toString('hex') || coin.expiresAtHeight !== undefined || !canSpendOffchain(coin, { timestamp: new Date() }) || coin.isUnrolled ||
            coin.assets !== undefined && (!Array.isArray(coin.assets) || !options.allowAssets && coin.assets.length !== 0) || !Number.isSafeInteger(coin.value) || coin.value <= 0) throw refuse();
        const assets = coin.assets ?? [], seen = new Set<string>();
        if (assets.length > 100) throw refuse();
        for (const holding of assets) {
          if (!holding || !/^[a-f0-9]{68}$/.test(holding.assetId) || typeof holding.amount !== 'bigint' || holding.amount <= 0n || seen.has(holding.assetId)) throw refuse();
          seen.add(holding.assetId);
        }
        return { txid: coin.txid, vout: coin.vout, value: coin.value, tapTree: source.encode(), tapLeafScript: leaf, assets: assets.map(holding => ({ assetId: holding.assetId, amount: holding.amount })) };
      });
      const treasure=(contract&&'treasure' in contract?contract.treasure:undefined) as TreasureTrustedContext|undefined;
      if(treasure){
        if(inputs.some(input=>input.assets.length))throw refuse();
        if(intent!.kind!=='fund'){
          if(inputs.length!==1||!reader!.transactions)throw refuse();
          const response=await reader!.transactions([inputs[0].txid]);signal.throwIfAborted();
          if(!Array.isArray(response.txs)||response.txs.length!==1)throw refuse();
          return {inputs,changeScript,recipientScript,serverUnrollScript,maximumExposureSats:options.maximumExposureSats,
            treasure:{...treasure,previousTransaction:verifyTreasureFundingTransaction(treasure,inputs,response.txs[0])}};
        }
      }
      return { inputs, changeScript, recipientScript, serverUnrollScript, maximumExposureSats: options.maximumExposureSats,...(treasure?{treasure}:{}) };
    })(), new Promise<never>((_, reject) => {
      abort = () => reject(refuse());
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    })]);
  } catch { throw refuse(); }
  finally { signal.removeEventListener('abort', abort); }
}
