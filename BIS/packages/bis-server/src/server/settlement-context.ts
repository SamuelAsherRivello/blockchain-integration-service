import { RestArkProvider, RestIndexerProvider, EsploraProvider, ESPLORA_URL, DefaultVtxo, CSVMultisigTapscript, Transaction, getNetwork,
  canSpendOffchain, hasBoardingTxExpired, type ArkInfo, type Coin, type VirtualCoin, type IntentCoin } from '@arkade-os/sdk';
import { Address } from '@scure/btc-signer';
import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import type { GameNetwork } from './environment.ts';
import type { TrustedSettlementContext } from './settlement-intent-policy.ts';

type Outpoint = { txid: string; vout: number };
export type SettlementSourceReader = {
  info(): Promise<ArkInfo>;
  virtual(outpoints: Outpoint[]): Promise<{ vtxos: VirtualCoin[]; page?: unknown }>;
  boarding(address: string): Promise<Coin[]>;
  raw(txid: string): Promise<Uint8Array>;
  outspends(txid: string): Promise<{ spent: boolean }[]>;
  tip(): Promise<{ height: number }>;
};
const deny = () => Error('Fresh settlement context could not be verified.');
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');
const point = (coin: Outpoint) => `${coin.txid}:${coin.vout}`;
const publicKey = (value: string) => {
  if (!/^(?:0[23])?[a-f0-9]{64}$/.test(value)) throw deny();
  return Buffer.from(value.slice(-64), 'hex');
};

/** Read-only validation. Values, scripts and source types never come from the
 * browser. Bitcoin sources additionally match raw transaction bytes and fresh
 * unspent/confirmed evidence. No registration, broadcast or recovery journal.
 */
export async function readSettlementContext(options: {
  network: GameNetwork; gamePublicKey: string; outpoints: readonly Outpoint[]; maximumExposureSats: number; signal: AbortSignal;
}, reader?: SettlementSourceReader): Promise<TrustedSettlementContext> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(10000)]);
  signal.throwIfAborted();
  if (!['signet', 'mutinynet'].includes(options.network) || !/^0[23][a-f0-9]{64}$/.test(options.gamePublicKey) ||
      !Array.isArray(options.outpoints) || !options.outpoints.length || options.outpoints.length > 100 ||
      !Number.isSafeInteger(options.maximumExposureSats) || options.maximumExposureSats < 0 || options.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS) throw deny();
  const outpoints = options.outpoints.map(input => {
    if (!input || !/^[a-f0-9]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff) throw deny();
    return { txid: input.txid, vout: input.vout };
  });
  const requested = new Set(outpoints.map(point));
  if (requested.size !== outpoints.length) throw deny();
  if (!reader) {
    const url = options.network === 'signet' ? 'https://signet.arkade.sh' : 'https://mutinynet.arkade.sh';
    const ark = new RestArkProvider(url), indexer = new RestIndexerProvider(url), chain = new EsploraProvider(ESPLORA_URL[options.network]);
    reader = { info: () => ark.getInfo(), virtual: outpoints => indexer.getVtxos({ outpoints }), boarding: address => chain.getCoins(address),
      raw: txid => chain.getRawTransaction(txid), outspends: txid => chain.getTxOutspends(txid), tip: () => chain.getChainTip() };
  }
  let abort = () => {};
  try {
    return await Promise.race([(async () => {
      const [info, tip] = await Promise.all([reader!.info(), reader!.tip()]); signal.throwIfAborted();
      if (info.network !== options.network || !Number.isSafeInteger(tip.height) || tip.height < 0 ||
          typeof info.unilateralExitDelay !== 'bigint' || info.unilateralExitDelay <= 0n ||
          typeof info.boardingExitDelay !== 'bigint' || info.boardingExitDelay <= 0n || typeof info.dust !== 'bigint' || info.dust <= 0n) throw deny();
      const script = (value: bigint) => new DefaultVtxo.Script({ pubKey: publicKey(options.gamePublicKey), serverPubKey: publicKey(info.signerPubkey),
        csvTimelock: { value, type: value < 512n ? 'blocks' : 'seconds' } });
      const arkade = script(info.unilateralExitDelay), bitcoin = script(info.boardingExitDelay);
      const address = Address(getNetwork(options.network)).encode({ type: 'tr', pubkey: bitcoin.pkScript.slice(2) });
      const [virtual, boarding] = await Promise.all([reader!.virtual(outpoints), reader!.boarding(address)]); signal.throwIfAborted();
      if (!Array.isArray(virtual.vtxos) || virtual.page || virtual.vtxos.length > outpoints.length || !Array.isArray(boarding) || boarding.length > 10000) throw deny();
      const vtxos = new Map(virtual.vtxos.map(coin => [point(coin), coin])), utxos = new Map(boarding.map(coin => [point(coin), coin]));
      if (vtxos.size !== virtual.vtxos.length || utxos.size !== boarding.length || [...vtxos.keys()].some(id => !requested.has(id))) throw deny();
      const boardingExit = CSVMultisigTapscript.decode(Buffer.from(bitcoin.exitScript, 'hex')).params.timelock;
      const inputs = await Promise.all(outpoints.map(async reference => {
        const vtxo = vtxos.get(point(reference)), utxo = utxos.get(point(reference));
        if (vtxo && utxo || !vtxo && !utxo) throw deny();
        if (vtxo) {
          if (vtxo.script !== hex(arkade.pkScript) || vtxo.isUnrolled || vtxo.isSpent || vtxo.spentBy || vtxo.isSwept ||
              vtxo.expiresAtHeight !== undefined || !canSpendOffchain(vtxo, { timestamp: new Date() })) throw deny();
          return { ...vtxo, tapTree: arkade.encode(), intentTapLeafScript: arkade.forfeit(), forfeitTapLeafScript: arkade.forfeit() } as IntentCoin;
        }
        const coin = { ...utxo!, tapTree: bitcoin.encode(), intentTapLeafScript: bitcoin.forfeit(), forfeitTapLeafScript: bitcoin.forfeit() };
        if (!Number.isSafeInteger(coin.value) || coin.value <= 0 || !coin.status?.confirmed || !Number.isSafeInteger(coin.status.block_height) || coin.status.block_height! < 0 || coin.status.block_height! > tip.height ||
            !Number.isSafeInteger(coin.status.block_time) || coin.status.block_time! <= 0 || hasBoardingTxExpired(coin, boardingExit, tip.height)) throw deny();
        const [bytes, spent] = await Promise.all([reader!.raw(coin.txid), reader!.outspends(coin.txid)]); signal.throwIfAborted();
        if (!(bytes instanceof Uint8Array) || bytes.length > 1024 * 1024 || !Array.isArray(spent) || spent[coin.vout]?.spent !== false) throw deny();
        const tx = Transaction.fromRaw(bytes), output = tx.getOutput(coin.vout);
        if (tx.id !== coin.txid || !output.script || hex(output.script) !== hex(bitcoin.pkScript) || output.amount !== BigInt(coin.value)) throw deny();
        return coin as IntentCoin;
      }));
      signal.throwIfAborted();
      for (const input of inputs) {
        if (!Number.isSafeInteger(input.value) || input.value <= 0) throw deny();
        const assets = 'assets' in input ? input.assets ?? [] : [], seen = new Set<string>();
        if (!Array.isArray(assets) || assets.length > 100) throw deny();
        for (const holding of assets) {
          if (!/^[a-f0-9]{68}$/.test(holding.assetId) || typeof holding.amount !== 'bigint' || holding.amount <= 0n || seen.has(holding.assetId)) throw deny();
          seen.add(holding.assetId);
        }
      }
      return { inputs, gamePublicKey: options.gamePublicKey, arkadeScript: arkade.pkScript, bitcoinScript: bitcoin.pkScript, dustAmount: info.dust, maximumExposureSats: options.maximumExposureSats };
    })(), new Promise<never>((_, reject) => { abort = () => reject(deny()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); })]);
  } catch { throw deny(); }
  finally { signal.removeEventListener('abort', abort); }
}
