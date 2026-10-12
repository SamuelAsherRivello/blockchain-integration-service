import { ArkAddress, MnemonicIdentity, Wallet, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, hasTerminalSpend, type AssetDetails } from '@arkade-os/sdk';
import { encodeAssetMetadata } from './asset-metadata.ts';
import { shareIndexerReads } from './indexer-reads.ts';
import type { RoleWalletAccess } from './adapter-session.ts';
import {useReadonlyWallet,useSigningWallet} from './adapter-wallet.ts';
import { requireNetwork, operatorFor, withTemporaryWallet, type AccountSecret } from './account.ts';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import { AssetError, checkMintRecord, readAssetRecords, writeAssetRecord, assetBaseUnits, decodeListedMetadataValue, normalizeAssetMetadata, type BisAsset, type BisMintAssetRequest, type BisMintAssetResult } from '../state-layer-core/assets.ts';
import { BIS_LATEST_ASSET_FORMAT_VERSION, resolveBisAssetFormat } from '../state-layer-core/asset-format.ts';
import { BurnError, readBurnRecord, writeBurnRecord, validateBurn, type BisBurnAssetRequest, type BisBurnAssetResult, type BurnInput } from '../state-layer-core/burning.ts';
import { eligibleUnreservedCoins, walletReservations } from '../state-layer-core/wallet-reservations.ts';
import { AssetDeliveryError, completeAssetDelivery, readAssetDeliveryRecord, validateAssetDelivery, writeAssetDeliveryRecord, type AssetDeliveryAsset, type AssetDeliveryRecord, type BisAssetDeliveryRequest, type BisAssetDeliveryResult } from '../state-layer-core/asset-delivery.ts';

export async function loadMintAvailability(account:AccountSecret,signal:AbortSignal,session?:RoleWalletAccess) {
  const network=account.network ?? 'signet';
  try {eligibleUnreservedCoins([],walletReservations(account.profileId,network));}
  catch {return {canMint:false,reason:'Pending operation inputs could not be verified. Open wallet recovery details before minting.'};}
  const p=providers(signal, undefined, undefined, network);
  return useReadonlyWallet(account,signal,{arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,storage:storage()},async wallet=>{
    const coins=eligibleUnreservedCoins(await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false}),walletReservations(account.profileId,network));
    const connection=wallet.getProviderConnectionState();p.assertFresh();
    if(connection.mode!=='online'||connection.source!=='live')throw new AssetError('unavailable');
    const availableSats=coins.reduce((sum,c)=>sum+c.value,0),minimumSats=Number(wallet.dustAmount);
    if(!Number.isSafeInteger(availableSats)||!Number.isSafeInteger(minimumSats)||minimumSats<=0)throw new AssetError('unavailable');
    return {canMint:availableSats>=minimumSats,availableSats,minimumSats,reason:availableSats>=minimumSats?undefined:'Awaiting Balance'};
  },session);
}

type OwnedAsset = { asset: BisAsset; operationId?: string };
type AssetWallet = Pick<ReadonlyWallet, 'getProviderConnectionState' | 'assetManager'> & {getBalance():Promise<{assets:readonly {assetId:string;amount:bigint}[]}>};
/** Ownership reporting uses the same all-output view as SDK balance.assets,
 * without unrelated Bitcoin UTXO, chain-tip, or spending-capability probes.
 * This is never a source of spendable transaction inputs.
 */
export async function readAssetHoldings(wallet:Pick<ReadonlyWallet,'getVtxos'>) {
  const totals=new Map<string,bigint>();
  for(const coin of await wallet.getVtxos({withRecoverable:true,withUnrolled:true})){
    if(hasTerminalSpend(coin))continue;
    for(const asset of coin.assets ?? []){
      if(typeof asset.amount!=='bigint'||asset.amount<0n)throw new AssetError('unavailable');
      totals.set(asset.assetId,(totals.get(asset.assetId) ?? 0n)+asset.amount);
    }
  }
  return {assets:[...totals].map(([assetId,amount])=>({assetId,amount}))};
}
export async function readFreshAssets(wallet: AssetWallet): Promise<OwnedAsset[]> {
  const balance = await wallet.getBalance();
  const connection = wallet.getProviderConnectionState();
  if (connection.mode !== 'online' || connection.source !== 'live' || !Array.isArray(balance.assets)) throw new AssetError('unavailable');
  const owned: OwnedAsset[] = [];
  let next = 0;
  // Bound metadata hydration so a nine-item catalog does not require nine
  // sequential HTTP round trips or consume every SDK transport slot.
  await Promise.all(Array.from({length:Math.min(4,balance.assets.length)},async()=>{
    while(next<balance.assets.length) {
    const holding=balance.assets[next++];
    if (typeof holding.amount !== 'bigint' || holding.amount < 0n) throw new AssetError('unavailable');
    if (holding.amount === 0n) continue;
    const details: AssetDetails = await wallet.assetManager.getAssetDetails(holding.assetId);
    if (details.assetId !== holding.assetId) throw new AssetError('unavailable');
    const m = details.metadata;
    const metadata = normalizeAssetMetadata(m, 'list');
    const asset: BisAsset = { assetId: holding.assetId, quantity: holding.amount.toString(),
      ...(typeof m?.name === 'string' ? { name: m.name } : {}),
      ...(typeof m?.ticker === 'string' ? { ticker: m.ticker } : {}),
      ...(typeof m?.icon === 'string' ? { iconUrl: m.icon } : {}),
      ...(Number.isInteger(m?.decimals) && Number(m?.decimals) >= 0 ? { decimals: m!.decimals } : {}),
      ...(metadata ? {metadata} : {}) };
    const formatted = metadata ? {...asset,format:resolveBisAssetFormat(asset)} : asset;
    const kind=decodeListedMetadataValue(m?.bisKind),schema=decodeListedMetadataValue(m?.bisSchemaVersion),operationId=decodeListedMetadataValue(m?.bisOperationId);
    owned.push({ asset: formatted, ...(kind === 'asset' && schema === '1' && typeof operationId === 'string' ? { operationId } : {}) });
    }
  }));
  return owned.sort((a, b) => a.asset.assetId.localeCompare(b.asset.assetId));
}

function providers(signal: AbortSignal, beforeSubmit?: () => void, afterSubmit?: (transactionId: string) => void, network: TestNetwork = 'signet') {
  const operator=operatorFor(network);
  const arkProvider = new RestArkProvider(operator), indexerProvider = shareIndexerReads(new RestIndexerProvider(operator),operator);
  const getInfo = arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo = async () => { signal.throwIfAborted(); const info = await getInfo(); requireNetwork(info.network,network); return info; };
  let failed = false;
  const getVtxos = indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos = async (...args) => { try { signal.throwIfAborted(); return await getVtxos(...args); } catch (e) { failed = true; throw e; } };
  const submit = arkProvider.submitTx.bind(arkProvider);
  arkProvider.submitTx = async (...args) => {
    signal.throwIfAborted(); if (failed) throw new AssetError('unavailable'); beforeSubmit?.();
    const result = await submit(...args);
    afterSubmit?.(result.arkTxid);
    return result;
  };
  return { arkProvider, indexerProvider, assertFresh() { signal.throwIfAborted(); if (failed) throw new AssetError('unavailable'); } };
}
const storage = () => ({ walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() });
// Caller holds the wallet mutation lock. A pending record is written before submission.
export async function burnWalletAsset(account:AccountSecret, input:BisBurnAssetRequest, signal:AbortSignal, isCurrent:()=>boolean,session?:RoleWalletAccess):Promise<Extract<BisBurnAssetResult,{status:'burned'}>> {
  const network=account.network ?? 'signet';
  const request=validateBurn(input), prior=readBurnRecord(account.profileId, input.operationId, network);
  if(prior?.id===request.operationId) {
    if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new BurnError('invalid-input','The burn request changed.');
    if(prior.status==='succeeded')return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:prior.transactionId!};
    throw new BurnError('outcome-unknown','This item burn is unresolved. Its asset and inputs remain reserved; do not resubmit it.');
  }
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
  let submitted=false,open=true,burnInputs:BurnInput[]=[],minimumCarrierSats:number|undefined;
  const p=providers(deadline,()=>{
    if(!open||!isCurrent())throw new BurnError('account-changed','The account changed.');
    if(!burnInputs.length)throw new BurnError('unavailable','The burn inputs could not be verified.');
    writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'pending',network,inputs:burnInputs});
    submitted=true;
  },transactionId=>{
    if(open&&!deadline.aborted&&/^[a-f0-9]{64}$/i.test(transactionId)) {
      try {writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'pending',network,transactionId,inputs:burnInputs});} catch { /* Intent is already durable; let finalization continue. */ }
    }
  },network);
  try {
    return await useSigningWallet(account,deadline,{arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,settlementConfig:false,storage:storage()},async wallet=>{
      const owned=await readFreshAssets(wallet);p.assertFresh();
      const asset=owned.find(row=>row.asset.assetId===request.assetId)?.asset;
      if(!asset||asset.quantity!==request.quantity)throw new BurnError('invalid-input','The owned quantity changed. Refresh Assets and confirm again.');
      if(!isCurrent())throw new BurnError('account-changed','The account changed.');
      const spendable=wallet.getSpendableVtxos.bind(wallet);
      wallet.getSpendableVtxos=async options=>eligibleUnreservedCoins(await spendable(options),walletReservations(account.profileId,network));
      const submitOffchain=wallet.buildAndSubmitOffchainTx.bind(wallet);
      wallet.buildAndSubmitOffchainTx=async(inputs,outputs)=>{
        burnInputs=inputs.map(input=>({txid:input.txid,vout:input.vout}));
        return submitOffchain(inputs,outputs);
      };
      minimumCarrierSats=Number(wallet.dustAmount);
      const transactionId=await wallet.assetManager.burn({assetId:request.assetId,amount:BigInt(request.quantity)});
      if(!open||deadline.aborted||!isCurrent())throw new BurnError('outcome-unknown','The burn outcome is unknown. Refresh Assets; do not retry the burn.');
      if(!/^[a-f0-9]{64}$/i.test(transactionId))throw Error('Invalid transaction ID');
      writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'succeeded',network,transactionId,inputs:burnInputs});
      return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId};
    },session,30000);
  } catch(error) {
    if(submitted)throw new BurnError('outcome-unknown','The burn may have been submitted. Refresh Assets; do not retry the burn.');
    if(error instanceof Error && error.message.startsWith('Operator network mismatch:'))throw new BurnError('unavailable','The selected wallet network could not be verified. Refresh the wallet and try again.');
    if(error instanceof Error && error.message === 'Insufficient funds') {
      const minimum=Number.isSafeInteger(minimumCarrierSats) && minimumCarrierSats! > 0 ? minimumCarrierSats!.toLocaleString('en-US') : 'the required';
      throw new BurnError('unavailable',`This asset needs ${minimum} spendable sats for its Arkade carrier output. Add or settle spendable funds, then try again.`);
    }
    if(error instanceof Error && error.message.startsWith('Insufficient asset balance:'))throw new BurnError('unavailable','This asset is owned but is not currently spendable. Wait for its wallet operation to settle, then refresh Assets and try again.');
    if(error instanceof BurnError)throw error;
    throw new BurnError('unavailable','The wallet could not prepare a spendable burn transaction. This is not caused by the item metadata format. Refresh Assets, resolve any pending wallet operation, and try again.');
  } finally {open=false;}
}
export async function listWalletAssets(account: AccountSecret, signal: AbortSignal, session?: RoleWalletAccess): Promise<BisAsset[]> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  const network = account.network ?? 'signet';
  if(session) {
    const holdings=await session.read(account,deadline,readAssetHoldings);
    return session.read(account,deadline,async wallet=>{
      let cache=metadataCaches.get(session);if(!cache){cache=new Map();metadataCaches.set(session,cache);}
      const owned=await readFreshAssets({getBalance:async()=>holdings,getProviderConnectionState:()=>({mode:'online',source:'live',lastOnlineAt:Date.now()}),assetManager:{
        getAssetDetails:async assetId=>{
          const key=JSON.stringify([network,operatorFor(network),assetId]);
          const known=cache!.get(key);if(known)return known;
          const details=await wallet.assetManager.getAssetDetails(assetId);
          if(details.assetId!==assetId)throw new AssetError('unavailable');
          normalizeAssetMetadata(details.metadata,'list');
          deadline.throwIfAborted();cache!.set(key,details);return details;
        },
      } as ReadonlyWallet['assetManager']});
      deadline.throwIfAborted();return addLocalProvenance(owned,account);
    },false);
  }
  const p = providers(deadline, undefined, undefined, network);
  const identity = await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly();
  return withTemporaryWallet(ReadonlyWallet.create({ identity, arkProvider: p.arkProvider, indexerProvider: p.indexerProvider, storage: storage() }), deadline, async wallet => {
    const owned = await readFreshAssets({getBalance:()=>readAssetHoldings(wallet),getProviderConnectionState:()=>wallet.getProviderConnectionState(),assetManager:wallet.assetManager}); p.assertFresh();
    return addLocalProvenance(owned,account);
  }, 30000);
}
// Immutable metadata only. Mutable quantities are ALWAYS read above. Weak scope
// is app-owned; network/operator/asset ID prevent cross-network metadata reuse.
const metadataCaches=new WeakMap<RoleWalletAccess,Map<string,AssetDetails>>();
function addLocalProvenance(owned:OwnedAsset[],account:AccountSecret):BisAsset[] {
    let records: ReturnType<typeof readAssetRecords> = [];
    const network=account.network??'signet';
    try { records = readAssetRecords(account.profileId, network); } catch { /* Local provenance is optional; chain ownership remains authoritative. */ }
    return owned.map(({asset}) => {
      const record = records.find(item => item.status === 'succeeded' && item.asset?.assetId === asset.assetId);
      const transactionId = record?.transactionId && /^[a-f0-9]{64}$/i.test(record.transactionId) ? record.transactionId : undefined;
      return record ? {...asset, sourceOperationId: record.request.operationId, ...(transactionId ? {sourceTransactionId: transactionId} : {})} : asset;
    });
}

function deliveryRecipient(recipient:string, own:string) {
  try {
    const destination=ArkAddress.decode(recipient.trim()), source=ArkAddress.decode(own);
    const bytes=(value:Uint8Array)=>Array.from(value,part=>part.toString(16).padStart(2,'0')).join('');
    if(destination.hrp!=='tark'||destination.version!==0||bytes(destination.serverPubKey)!==bytes(source.serverPubKey)||bytes(destination.vtxoTaprootKey)===bytes(source.vtxoTaprootKey))throw Error();
    return {address:destination.encode(),senderScript:bytes(source.pkScript),recipientScript:bytes(destination.pkScript)};
  } catch {throw new AssetDeliveryError('invalid-input','Use a distinct Signet Arkade recipient address for this item delivery.');}
}

/** Select only the sender's unreserved inputs that carry the exact asset. */
export function selectExactAssetDeliveryInputs<T extends {txid:string;vout:number;assets?:readonly {assetId:string;amount:bigint}[]}>(coins:readonly T[],profileId:string,assetId:string,quantity:bigint,network:TestNetwork='signet'):T[] {
  const eligible=eligibleUnreservedCoins(coins,walletReservations(profileId,network)).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const selected:typeof eligible=[];let total=0n;
  for(const coin of eligible) {
    const amount=(coin.assets??[]).filter(asset=>asset.assetId===assetId).reduce((sum,asset)=>sum+asset.amount,0n);
    if(amount===0n)continue;
    selected.push(coin);total+=amount;
    if(total>=quantity)break;
  }
  if(total<quantity)throw new AssetDeliveryError('invalid-input','The selected item is no longer available. Refresh the listing before trying again.');
  return selected;
}

function selectedAssetTotals(coins:readonly {assets?:readonly {assetId:string;amount:bigint}[]}[]):AssetDeliveryAsset[] {
  const totals=new Map<string,bigint>();
  for(const coin of coins)for(const asset of coin.assets??[])totals.set(asset.assetId,(totals.get(asset.assetId)??0n)+asset.amount);
  return [...totals].sort(([left],[right])=>left.localeCompare(right)).map(([assetId,amount])=>({assetId,quantity:String(amount)}));
}

type DeliveryEvidenceCoin=Readonly<{txid:string;script:string;assets?:readonly {assetId:string;amount:bigint}[]}>;
function assetMap(assets:readonly {assetId:string;amount:bigint}[]|undefined){const totals=new Map<string,bigint>();for(const asset of assets??[])totals.set(asset.assetId,(totals.get(asset.assetId)??0n)+asset.amount);return totals;}
/**
 * Requires the exact recipient allocation and sender-side asset reduction.
 *
 * Some Arkade indexer responses do not expose the sender change output with
 * the same script shape used during submission (for example when change is
 * normalized or split). Requiring that optional representation kept valid
 * deliveries pending forever even though the recipient output and source
 * balance already proved the transfer. The transaction id, recipient script,
 * exact quantity, and sender reduction remain mandatory.
 */
export function hasExactDeliveryEvidence(record:AssetDeliveryRecord,currentSourceQuantity:bigint,vtxos:readonly DeliveryEvidenceCoin[]):boolean {
  if(!record.transactionId||currentSourceQuantity>BigInt(record.sourceQuantity)-BigInt(record.request.quantity))return false;
  const outputs=vtxos.filter(coin=>coin.txid===record.transactionId);
  const recipient=outputs.filter(coin=>coin.script===record.recipientScript).some(coin=>assetMap(coin.assets).get(record.request.assetId)===BigInt(record.request.quantity));
  return recipient;
}

function deliveryResult(record:NonNullable<ReturnType<typeof readAssetDeliveryRecord>>):Extract<BisAssetDeliveryResult,{status:'delivered'|'already-delivered'}> {
  return {status:record.status==='succeeded'?'already-delivered':'delivered',profileId:record.profileId,operationId:record.id,assetId:record.request.assetId,quantity:record.request.quantity,recipient:record.request.recipient,transactionId:record.transactionId!};
}

/**
 * Sends one exact asset allocation using a local signer. The intent is stored
 * before `wallet.send` can submit so a lost acknowledgement stays recoverable.
 */
export async function deliverWalletAsset(account:AccountSecret,input:BisAssetDeliveryRequest,signal:AbortSignal,isCurrent:()=>boolean,session?:RoleWalletAccess):Promise<BisAssetDeliveryResult> {
  let request:BisAssetDeliveryRequest;
  try {request=validateAssetDelivery(input);} catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'invalid-input',message:error instanceof Error?error.message:'Item delivery is invalid.',profileId:account.profileId,operationId:input?.operationId};}
  try {
    const network=account.network ?? 'signet',prior=readAssetDeliveryRecord(account.profileId,request.operationId,network);
    if(prior) {
      if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new AssetDeliveryError('invalid-input','The item delivery request changed.');
      if(prior.status==='succeeded')return deliveryResult(prior);
      return {status:'error',code:'outcome-unknown',message:'This item delivery is pending confirmation.',profileId:account.profileId,operationId:request.operationId};
    }
    const deadline=AbortSignal.any([signal,AbortSignal.timeout(30000)]),p=providers(deadline,undefined,undefined,network);
    return await useSigningWallet(account,deadline,{arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,settlementConfig:false,storage:storage()},async wallet=>{
      const own=await wallet.getAddress(),destination=deliveryRecipient(request.recipient,own);
      const spendable=await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false});p.assertFresh();
      const sourceQuantity=spendable.flatMap(coin=>coin.assets??[]).filter(asset=>asset.assetId===request.assetId).reduce((sum,asset)=>sum+asset.amount,0n);
      const selected=selectExactAssetDeliveryInputs(spendable,account.profileId,request.assetId,BigInt(request.quantity),network);
      if(!isCurrent()||deadline.aborted)throw new AssetDeliveryError('account-changed','The delivery wallet changed.');
      const record={version:1 as const,id:request.operationId,profileId:account.profileId,network,request,status:'pending' as const,inputs:selected.map(coin=>({txid:coin.txid,vout:coin.vout})),inputAssets:selectedAssetTotals(selected),senderScript:destination.senderScript,recipientScript:destination.recipientScript,sourceQuantity:String(sourceQuantity)};
      writeAssetDeliveryRecord(record);
      const transactionId=await wallet.send({recipients:[{address:destination.address,amount:Number(wallet.dustAmount),assets:[{assetId:request.assetId,amount:BigInt(request.quantity)}]}],selectedVtxos:selected});
      if(!/^[a-f0-9]{64}$/i.test(transactionId))throw new AssetDeliveryError('outcome-unknown','Item delivery acknowledgement could not be verified.');
      if(isCurrent()&&!deadline.aborted&&readAssetDeliveryRecord(account.profileId,record.id,network))writeAssetDeliveryRecord({...record,transactionId});
      return {status:'error',code:'outcome-unknown',message:'Item delivery confirmation is pending.',profileId:account.profileId,operationId:request.operationId};
    },session,30000);
  } catch(error) {
    if(error instanceof AssetDeliveryError)return {status:'error',code:error.code,message:error.message,profileId:account.profileId,operationId:request.operationId};
    return {status:'error',code:'unavailable',message:'Item delivery could not be prepared. Refresh the wallet and try again.',profileId:account.profileId,operationId:request.operationId};
  }
}

/** Reconcile only from current sender and recipient evidence; absence is never success. */
export async function reconcileWalletAssetDelivery(account:AccountSecret,operationId:string,signal:AbortSignal,session?:RoleWalletAccess):Promise<BisAssetDeliveryResult> {
  try {
    const network=account.network ?? 'signet',record=readAssetDeliveryRecord(account.profileId,operationId,network);
    if(!record)throw new AssetDeliveryError('invalid-input','The requested item delivery does not exist.');
    if(record.status==='succeeded')return deliveryResult(record);
    if(!record.transactionId)return {status:'error',code:'outcome-unknown',message:'Item delivery preparation is pending. Do not submit another delivery.',profileId:account.profileId,operationId};
    const deadline=AbortSignal.any([signal,AbortSignal.timeout(30000)]),p=providers(deadline,undefined,undefined,network);
    return await useReadonlyWallet(account,deadline,{arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,storage:storage()},async wallet=>{
      const [source,{vtxos}]=await Promise.all([readFreshAssets(wallet),p.indexerProvider.getVtxos({scripts:[record.senderScript,record.recipientScript]})]);p.assertFresh();
      const sourceQuantity=source.filter(item=>item.asset.assetId===record.request.assetId).reduce((sum,item)=>sum+BigInt(item.asset.quantity),0n);
      if(!hasExactDeliveryEvidence(record,sourceQuantity,vtxos))return {status:'error',code:'outcome-unknown',message:'Item delivery is still awaiting fresh sender-change and recipient ownership evidence. Do not submit another delivery.',profileId:account.profileId,operationId};
      return deliveryResult(completeAssetDelivery(account.profileId,operationId,record.transactionId!,network));
    },session,30000);
  } catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'unavailable',message:error instanceof Error?error.message:'Item delivery status is unavailable.',profileId:account.profileId,operationId};}
}
// Caller holds the mutation lock shared with transfers and account clearing.
export async function mintWalletAsset(account: AccountSecret, request: BisMintAssetRequest, signal: AbortSignal, isCurrent: () => boolean,session?:RoleWalletAccess): Promise<Exclude<BisMintAssetResult, {status:'error'}>> {
  const network=account.network ?? 'signet', record = checkMintRecord(account.profileId, request,network);
  if (record?.status === 'succeeded') return { status: 'already-minted', profileId: account.profileId, operationId: request.operationId, asset: record.asset!, transactionId: record.transactionId };
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  let submitted = false, open = true;
  let fundingCoins: readonly {txid:string;vout:number}[] = [];
  const p = providers(deadline, () => {
    if (!open || !isCurrent()) throw new AssetError('account-changed');
    if (eligibleUnreservedCoins(fundingCoins,walletReservations(account.profileId,account.network ?? 'signet')).length !== fundingCoins.length) throw new AssetError('unavailable');
    checkMintRecord(account.profileId, request,network);
    writeAssetRecord(account.profileId, { request, status: 'pending',network });
    submitted = true;
  }, transactionId => {
    // Once the caller exits, its wallet lock is gone. Leave late evidence for
    // a fresh locked retry instead of racing another tab's journal updates.
    if (!open || deadline.aborted) return;
    if (typeof transactionId !== 'string' || !/^[0-9a-f]{64}$/i.test(transactionId)) return;
    try {
      const latest = checkMintRecord(account.profileId, request,network);
      // Only enrich an existing pending intent. Never downgrade confirmed
      // ownership, or recreate a journal removed by account cleanup.
      if (latest?.status === 'pending') writeAssetRecord(account.profileId, { ...latest, transactionId,network });
    } catch {
      // Durable intent already exists. A secondary journal write must not stop
      // SDK finalization of an accepted transaction; completion still persists.
    }
  }, account.network ?? 'signet');
  try {
    return await useSigningWallet(account,deadline,{arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,settlementConfig:false,storage:storage()},async wallet => {
      const owned = await readFreshAssets(wallet); p.assertFresh();
      const existing = owned.find(o => o.operationId === request.operationId && o.asset.name === request.name && o.asset.ticker === request.ticker && o.asset.decimals === request.decimals && o.asset.quantity === assetBaseUnits(request.amount, request.decimals).toString() && (o.asset.iconUrl || '') === (request.iconUrl || ''));
      if (existing) {
        const transactionId = checkMintRecord(account.profileId, request,network)?.transactionId;
        writeAssetRecord(account.profileId, { request, status: 'succeeded', asset: existing.asset, network, ...(transactionId ? { transactionId } : {}) });
        return { status: 'already-minted', profileId: account.profileId, operationId: request.operationId, asset: existing.asset, ...(transactionId ? { transactionId } : {}) };
      }
      if (record) throw new AssetError('outcome-unknown');
      // SDK AssetManager.issue obtains every funding input through this public
      // wallet method. Restrict this temporary signing wallet's source as well as
      // the preflight balance, so its internal selection cannot spend reservations.
      const spendable = wallet.getSpendableVtxos.bind(wallet);
      wallet.getSpendableVtxos = async options => {
        const coins = eligibleUnreservedCoins(await spendable({...options,withRecoverable:false,withUnrolled:false}),walletReservations(account.profileId,account.network ?? 'signet'));
        p.assertFresh();fundingCoins=coins;
        return coins;
      };
      const coins = await wallet.getSpendableVtxos({ withRecoverable: false }); p.assertFresh();
      if (coins.reduce((sum, c) => sum + BigInt(c.value), 0n) < BigInt(wallet.dustAmount)) throw new AssetError('insufficient-funds');
      if (!isCurrent()) throw new AssetError('account-changed');
      const quantity = assetBaseUnits(request.amount, request.decimals);
      const result = await wallet.assetManager.issue({ amount: quantity, metadata: {
        name:request.name,ticker:request.ticker,decimals:request.decimals,...(request.iconUrl?{icon:request.iconUrl}:{}),
        ...encodeAssetMetadata(request.metadata),bisKind:'asset',bisSchemaVersion:'1',bisAssetFormatVersion:request.metadata?.bisAssetFormatVersion ?? BIS_LATEST_ASSET_FORMAT_VERSION,bisOperationId:request.operationId,
      } });
      // These are already typed API values, not indexer hex. In particular a
      // price such as "1100" must not be decoded as hex bytes a second time.
      const metadata = normalizeAssetMetadata({...request.metadata,bisSchemaVersion:'1'});
      const asset: BisAsset = {assetId: result.assetId, name: request.name, ticker: request.ticker, quantity: quantity.toString(), decimals: request.decimals, ...(request.iconUrl ? {iconUrl: request.iconUrl} : {}), ...(metadata ? {metadata} : {})};
      // SDK finalization continues after abort, but only an open caller still
      // holds the mutation lock needed to update this operation's journal.
      if (open && !deadline.aborted && checkMintRecord(account.profileId, request,network)) writeAssetRecord(account.profileId, {request, status: 'succeeded', asset, network, transactionId: result.arkTxId});
      return { status: 'minted', profileId: account.profileId, operationId: request.operationId, asset, transactionId: result.arkTxId };
    },session,30000);
  } catch (e) {
    if (submitted) throw new AssetError('outcome-unknown');
    throw e;
  } finally { open = false; }
}

/** Stream wallet output changes directly; no history or balance polling. */
export async function watchAssetChanges(account: AccountSecret, signal: AbortSignal, changed: () => void,session?:RoleWalletAccess): Promise<void> {
  if(session)return session.observe(account,signal,changed);
  const p = providers(signal, undefined, undefined, account.network ?? 'signet');
  const identity = await MnemonicIdentity.fromMnemonic(account.phrase, {isMainnet:false}).toReadonly();
  const wallet = await ReadonlyWallet.create({identity, arkProvider:p.arkProvider, indexerProvider:p.indexerProvider, storage:storage()});
  try {
    signal.throwIfAborted();
    const address = ArkAddress.decode(await wallet.getAddress());
    const hex = (bytes:Uint8Array) => Array.from(bytes, byte=>byte.toString(16).padStart(2,'0')).join('');
    await observeAssetScripts(p.indexerProvider, [hex(address.pkScript), hex(address.subdustPkScript)], signal, changed);
  } finally { await wallet.dispose(); }
}

export async function observeAssetScripts(provider: Pick<RestIndexerProvider,'subscribeForScripts'|'getSubscription'|'unsubscribeForScripts'>, scripts:string[], signal:AbortSignal, changed:()=>void):Promise<void> {
  const id = await provider.subscribeForScripts(scripts);
  try {
    signal.throwIfAborted();
    // Re-read once after registration to close the initial read/subscription gap.
    changed();
    for await (const event of provider.getSubscription(id, signal)) {
      if(signal.aborted)break;
      if(event.newVtxos.length || event.spentVtxos.length || event.sweptVtxos.length) changed();
    }
  } finally { await provider.unsubscribeForScripts(id).catch(()=>{}); }
}
