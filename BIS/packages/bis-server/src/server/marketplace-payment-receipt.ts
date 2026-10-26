import { isDeepStrictEqual } from 'node:util';
import { RestArkProvider, RestIndexerProvider, Transaction, DefaultVtxo, Extension, asset, createAssetPacket, buildOffchainTx, assertValidServerUnrollScript, defaultCheckpointExitDelayPolicy, getNetwork, type ArkInfo, type AssetDetails, type VirtualCoin } from '@arkade-os/sdk';
import { classifyBisEquipmentAsset } from '../../../integration/src/client/state-layer-core/equipment.ts';
import { normalizeAssetMetadata } from '../../../integration/src/client/state-layer-core/assets.ts';
import type { GameNetwork } from './environment.ts';
import { validateAssetIssuance } from './asset-policy.ts';
import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';

type Outpoint = {txid:string;vout:number};
export type MarketplaceReceiptReader = {
  info():Promise<ArkInfo>;
  asset(id:string):Promise<AssetDetails>;
  transactions(ids:string[]):Promise<{txs:string[];page?:unknown}>;
  coins(outpoints:Outpoint[]):Promise<{vtxos:VirtualCoin[];page?:unknown}>;
};
const deny=()=>Error('Marketplace payment receipt could not be verified.');
const hex=(bytes:Uint8Array)=>Buffer.from(bytes).toString('hex');
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function decode(encoded:string) {
  if(typeof encoded!=='string'||!encoded.length||encoded.length>1024*1024)throw deny();
  if(/^(?:[a-f0-9]{2})+$/i.test(encoded))return Transaction.fromRaw(Buffer.from(encoded,'hex'));
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.toString('base64')!==encoded)throw deny();
  return Transaction.fromPSBT(bytes);
}
function exactTransactions(answer:Awaited<ReturnType<MarketplaceReceiptReader['transactions']>>,ids:string[]) {
  if(!Array.isArray(answer.txs)||answer.txs.length!==ids.length||answer.page||answer.txs.reduce((n,s)=>n+s.length,0)>2*1024*1024)throw deny();
  const rows=new Map(answer.txs.map(encoded=>{const tx=decode(encoded);return [tx.id,tx] as const;}));
  if(rows.size!==ids.length||ids.some(id=>!rows.has(id)))throw deny();
  return rows;
}
function exactCoins(answer:Awaited<ReturnType<MarketplaceReceiptReader['coins']>>,outpoints:Outpoint[]) {
  if(!Array.isArray(answer.vtxos)||answer.vtxos.length!==outpoints.length||answer.page)throw deny();
  const ids=outpoints.map(p=>`${p.txid}:${p.vout}`),rows=new Map(answer.vtxos.map(coin=>[`${coin.txid}:${coin.vout}`,coin]));
  if(new Set(ids).size!==ids.length||rows.size!==ids.length||ids.some(id=>!rows.has(id)))throw deny();
  return ids.map(id=>rows.get(id)!);
}

/** Prove immutable catalog metadata came from a real Game-owned issuance.
 * Metadata labels alone never establish issuer authority. Historical spent
 * sources are expected here, unlike the fresh inputs used for a signing plan.
 */
async function verifyGameIssuance(reader: MarketplaceReceiptReader, details: AssetDetails, game: DefaultVtxo.Script,
  unroll: ReturnType<typeof assertValidServerUnrollScript>, signal: AbortSignal) {
  const id = asset.AssetId.fromString(details.assetId);
  if (id.groupIndex !== 0 || details.supply !== 1n || details.controlAssetId) throw deny();
  const genesisId = hex(id.txid);
  const root = exactTransactions(await reader.transactions([genesisId]), [genesisId]).get(genesisId)!;
  signal.throwIfAborted();
  if (root.inputsLength < 1 || root.inputsLength > 100 || root.outputsLength !== 3) throw deny();
  const checkpointIds = Array.from({ length: root.inputsLength }, (_, i) => {
    const input = root.getInput(i);
    if (!input.txid || input.index !== 0) throw deny();
    return hex(input.txid);
  });
  if (new Set(checkpointIds).size !== checkpointIds.length) throw deny();
  const checkpoints = exactTransactions(await reader.transactions(checkpointIds), checkpointIds);
  signal.throwIfAborted();
  const originals = checkpointIds.map(checkpointId => {
    const cp = checkpoints.get(checkpointId)!;
    if (cp.inputsLength !== 1) throw deny();
    const input = cp.getInput(0);
    if (!input.txid || !Number.isSafeInteger(input.index) || input.index! < 0) throw deny();
    return { txid: hex(input.txid), vout: input.index! };
  });
  const coins = exactCoins(await reader.coins(originals), originals);
  signal.throwIfAborted();
  const inputs = coins.map((coin, i) => {
    if (coin.script !== hex(game.pkScript) || coin.isSpent !== true || coin.spentBy !== checkpointIds[i] ||
        coin.arkTxId && coin.arkTxId !== root.id || coin.isUnrolled || coin.isSwept) throw deny();
    return { txid: coin.txid, vout: coin.vout, value: coin.value, tapTree: game.encode(), tapLeafScript: game.forfeit(), assets: coin.assets ?? [] };
  });
  const outputs = Array.from({ length: root.outputsLength - 1 }, (_, i) => {
    const output = root.getOutput(i);
    if (!output.script || typeof output.amount !== 'bigint') throw deny();
    return { script: output.script, amount: output.amount };
  });
  const canonical = buildOffchainTx(inputs, outputs, unroll);
  const validated = validateAssetIssuance(canonical.arkTx, { inputs, changeScript: game.pkScript, recipientScript: game.pkScript,
    serverUnrollScript: unroll, maximumExposureSats: MAX_OPERATION_EXPOSURE_SATS });
  if (!isDeepStrictEqual(root.unsignedTx, validated.arkTx.unsignedTx) || validated.issuedAssets[0] !== details.assetId ||
      validated.checkpoints.some((cp, i) => !isDeepStrictEqual(cp.unsignedTx, checkpoints.get(checkpointIds[i])!.unsignedTx))) throw deny();
  // Mirror the pinned SDK's indexed metadata representation. Comparing every
  // entry binds even custom fields to the actual issuance packet.
  const group = Extension.fromTx(validated.arkTx).getAssetPacket()!.groups[0];
  const items = Reflect.get(group, 'metadataList').items as { key: Uint8Array; value: Uint8Array }[];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const metadata = Object.fromEntries(items.map(({ key, value }) => {
    const name = decoder.decode(key);
    return [name, name === 'decimals' ? Number(decoder.decode(value)) : ['name', 'ticker', 'icon'].includes(name) ? decoder.decode(value) : hex(value)];
  }));
  if (!isDeepStrictEqual(metadata, details.metadata)) throw deny();
}

/** Read-only evidence for Player->Game purchase payment. This does not issue a
 * grant, consume the receipt, sign, submit or journal
 * a checkout. Callers must bind/consume this receipt atomically before signing.
 */
export async function readMarketplacePaymentReceipt(options:{network:GameNetwork;gamePublicKey:string;playerPublicKey:string;assetId:string;transactionId:string;signal:AbortSignal},reader?:MarketplaceReceiptReader) {
  const signal=AbortSignal.any([options.signal,AbortSignal.timeout(10000)]);
  signal.throwIfAborted();
  if(!['signet','mutinynet'].includes(options.network)||!hash(options.transactionId)||!/^[a-f0-9]{68}$/.test(options.assetId)||![options.gamePublicKey,options.playerPublicKey].every(key=>/^0[23][a-f0-9]{64}$/.test(key))||options.gamePublicKey===options.playerPublicKey)throw deny();
  if(!reader) {
    const url=options.network==='signet'?'https://signet.arkade.sh':'https://mutinynet.arkade.sh',ark=new RestArkProvider(url),indexer=new RestIndexerProvider(url);
    reader={info:()=>ark.getInfo(),asset:id=>indexer.getAssetDetails(id),transactions:ids=>indexer.getVirtualTxs(ids),coins:outpoints=>indexer.getVtxos({outpoints})};
  }
  let abort=()=>{};
  try {
    return await Promise.race([(async()=>{
      const [info,details]=await Promise.all([reader!.info(),reader!.asset(options.assetId)]);signal.throwIfAborted();
      if(info.network!==options.network||typeof info.unilateralExitDelay!=='bigint'||info.unilateralExitDelay<=0n||details.assetId!==options.assetId||typeof details.supply!=='bigint'||details.supply<=0n||details.controlAssetId)throw deny();
      const metadata=details.metadata;
      const item=classifyBisEquipmentAsset({assetId:details.assetId,quantity:'1',name:metadata?.name,ticker:metadata?.ticker,iconUrl:typeof metadata?.icon==='string'?metadata.icon:undefined,decimals:metadata?.decimals,metadata:normalizeAssetMetadata(metadata,'list')});
      if(!item||metadata?.decimals!==0)throw deny();
      const key=(value:string)=>{if(!/^(?:0[23])?[a-f0-9]{64}$/.test(value))throw deny();return Buffer.from(value.slice(-64),'hex');};
      const script=(publicKey:string)=>new DefaultVtxo.Script({pubKey:key(publicKey),serverPubKey:key(info.signerPubkey),csvTimelock:{value:info.unilateralExitDelay,type:info.unilateralExitDelay<512n?'blocks':'seconds'}});
      const player=script(options.playerPublicKey),game=script(options.gamePublicKey);
      if(hex(player.pkScript)===hex(game.pkScript))throw deny();
      const unroll=assertValidServerUnrollScript(info.checkpointTapscript,{...defaultCheckpointExitDelayPolicy(getNetwork(options.network)),advertisedForfeitPubkey:key(info.forfeitPubkey)});
      await verifyGameIssuance(reader!, details, game, unroll, signal);
      signal.throwIfAborted();
      const root=exactTransactions(await reader!.transactions([options.transactionId]),[options.transactionId]).get(options.transactionId)!;signal.throwIfAborted();
      if(root.inputsLength<1||root.inputsLength>100)throw deny();
      const checkpointIds=Array.from({length:root.inputsLength},(_,i)=>{const input=root.getInput(i);if(!input.txid||input.index!==0)throw deny();return hex(input.txid);});
      if(new Set(checkpointIds).size!==checkpointIds.length)throw deny();
      const checkpoints=exactTransactions(await reader!.transactions(checkpointIds),checkpointIds);signal.throwIfAborted();
      const originals=checkpointIds.map(id=>{const cp=checkpoints.get(id)!;if(cp.inputsLength!==1)throw deny();const input=cp.getInput(0);if(!input.txid||input.index===undefined||!Number.isSafeInteger(input.index)||input.index<0)throw deny();return {txid:hex(input.txid),vout:input.index};});
      const coins=exactCoins(await reader!.coins([...originals,{txid:root.id,vout:0}]),[...originals,{txid:root.id,vout:0}]);signal.throwIfAborted();
      const receipt=coins.pop()!,holdings=new Map<string,bigint>();let total=0n;
      const inputs=coins.map((coin,i)=>{
        if(coin.script!==hex(player.pkScript)||coin.isSpent!==true||coin.spentBy!==checkpointIds[i]||(coin.arkTxId&&coin.arkTxId!==root.id)||coin.isUnrolled||coin.isSwept||!Number.isSafeInteger(coin.value)||coin.value<=0||!Array.isArray(coin.assets??[])||(coin.assets?.length??0)>100)throw deny();
        const seen=new Set<string>();for(const asset of coin.assets??[]){if(!/^[a-f0-9]{68}$/.test(asset.assetId)||typeof asset.amount!=='bigint'||asset.amount<=0n||seen.has(asset.assetId))throw deny();seen.add(asset.assetId);holdings.set(asset.assetId,(holdings.get(asset.assetId)??0n)+asset.amount);if(holdings.size>100)throw deny();}
        total+=BigInt(coin.value);
        return {txid:coin.txid,vout:coin.vout,value:coin.value,tapTree:player.encode(),tapLeafScript:player.forfeit(),assets:coin.assets??[]};
      });
      const change=total-BigInt(item.priceSats);
      if(total>BigInt(Number.MAX_SAFE_INTEGER)||change<0n||(holdings.size>0&&(typeof info.dust!=='bigint'||info.dust<=0n||change<info.dust)))throw deny();
      const outputs=[{amount:BigInt(item.priceSats),script:game.pkScript},...(change>0n?[{amount:change,script:player.pkScript}]:[])];
      if(holdings.size)outputs.push(Extension.create([createAssetPacket(new Map(inputs.flatMap((input,i)=>input.assets.length?[[i,input.assets] as const]:[])),[{address:'',amount:item.priceSats}],{address:'',amount:Number(change),assets:[...holdings].map(([assetId,amount])=>({assetId,amount}))})]).txOut());
      const canonical=buildOffchainTx(inputs,outputs,unroll);
      if(!isDeepStrictEqual(root.unsignedTx,canonical.arkTx.unsignedTx)||canonical.checkpoints.some((cp,i)=>!isDeepStrictEqual(cp.unsignedTx,checkpoints.get(checkpointIds[i])!.unsignedTx))||receipt.script!==hex(game.pkScript)||receipt.value!==item.priceSats||receipt.assets?.length)throw deny();
      return Object.freeze({transactionId:root.id,vout:0 as const,assetId:item.assetId,catalogId:item.catalogId,priceSats:item.priceSats,playerPublicKey:options.playerPublicKey,gamePublicKey:options.gamePublicKey,network:options.network,receiptKey:`marketplace-payment:${root.id}:0`});
    })(),new Promise<never>((_,reject)=>{abort=()=>reject(deny());signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();})]);
  } catch {throw deny();} finally {signal.removeEventListener('abort',abort);}
}
