import {eligibleUnreservedCoins, walletReservations} from '../core/wallet-reservations.ts';
import { verifiedBoardingCommitment } from '../core/boarding-reconciliation.ts';
import { hasLiveBoardingWait, liveBoardingState } from '../core/live-boarding-wait.ts';
import { settlementTimeoutMs, settlementDiagnostic } from '../core/boarding-status.ts';
import { readFreshBalance } from './balance.ts';
import { MnemonicIdentity, ReadonlyWallet, Wallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, CSVMultisigTapscript, hasBoardingTxExpired, Ramps, ArkAddress, Transaction, Extension, createAssetPacket, type IWallet, type SettleParams } from '@arkade-os/sdk';
import { boardingAssets, type BoardingAssetChange } from '../core/boarding-assets.ts';
import type { ExtendedVirtualCoin } from '@arkade-os/sdk';
import { SIGNET_OPERATOR, requireSignet, withTemporaryWallet, type AccountSecret } from './account.ts';
import { boardingAmounts, assertQuoteUnchanged, type BoardingQuote } from '../core/boarding-quote.ts';
import { readBoardingRecord, readBoardingRecords, writeBoardingRecord, createBoardingAttempt, recoverPreparedBoarding, withWalletMutation, type BoardingRecord } from '../core/boarding-record.ts';
import { withBrowserMutation } from '../core/logout-cleanup.ts';
import { runBoardingWorker } from '../core/boarding-execution.ts';
import { recordBoardingProgress, withBoardingRecordLock, type BoardingStage, type BoardingAction } from '../core/boarding-record.ts';

function config() {
  const arkProvider=new RestArkProvider(SIGNET_OPERATOR);
  const getInfo=arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo=async()=>{const info=await getInfo();requireSignet(info.network);return info;};
  const indexerProvider=new RestIndexerProvider(SIGNET_OPERATOR);
  let failed=false;
  const getVtxos=indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos=async(...args)=>{try{return await getVtxos(...args);}catch(error){failed=true;throw error;}};
  return {options:{arkProvider,indexerProvider,settlementConfig:false as const,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}},healthy:()=>!failed};
}
async function readonly<T>(account:AccountSecret,signal:AbortSignal,read:(wallet:ReadonlyWallet)=>Promise<T>):Promise<T> {
  const c=config();
  const identity=await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly();
  return withTemporaryWallet(ReadonlyWallet.create({...c.options,identity}),signal,async wallet=>{
    const result=await read(wallet);
    const state=wallet.getProviderConnectionState();
    if(!c.healthy()||state.mode!=='online'||state.source!=='live')throw Error('Live transfer data is unavailable.');
    return result;
  });
}
async function plan(wallet:ReadonlyWallet,profileId:string,requested?:number,direction:BoardingQuote['direction']='to-arkade') {
  if(!['to-arkade','to-bitcoin'].includes(direction))throw Error('Unsupported transfer direction.');
  const info=await new RestArkProvider(SIGNET_OPERATOR).getInfo();requireSignet(info.network);
  // The configured Signet operator currently quotes zero fees. Do not guess
  // arbitrary fee formulas or omit a future onchain-change output charge.
  if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(value=>value!==''&&value!=='0'))throw Error('The operator fee schedule changed. Transfers need a new fee verification.');
  const [coins,balance,tip,bitcoinAddress]=await Promise.all([wallet.getBoardingUtxos(),wallet.getBalance(),wallet.onchainProvider.getChainTip(),wallet.getBoardingAddress()]);
  await readFreshBalance({getBalance:async()=>balance,getProviderConnectionState:()=>wallet.getProviderConnectionState()});
  const exit=CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g)!.map(v=>parseInt(v,16))));
  const boardingInputs=coins.filter(c=>c.status.confirmed&&!hasBoardingTxExpired(c,exit.params.timelock,tip.height)).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const reserved=new Set(walletReservations(profileId).flatMap(r=>r.inputs?.map(i=>`${i.txid}:${i.vout}`)??[]));
  const candidates=direction==='to-arkade' ? boardingInputs : (await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false})).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const available=eligibleUnreservedCoins(candidates,walletReservations(profileId));
  const changeMinimum=direction==='to-arkade'?Number(info.utxoMinAmount):Math.max(Number(wallet.dustAmount),Number(info.vtxoMinAmount),1);
  // A partial transfer should not reserve every coin in the wallet. Select
  // enough whole inputs for the amount and valid change; Max still selects all.
  const inputs:typeof available=[];
  for(const coin of available) {
    inputs.push(coin);
    if(requested!==undefined) {
      const change=inputs.reduce((sum,c)=>sum+c.value,0)-requested;
      if(change>=changeMinimum||(change===0&&!boardingAssets(inputs).length))break;
    }
  }
  const totalInput=inputs.reduce((sum,c)=>sum+c.value,0);
  if(inputs.some(c=>!Number.isSafeInteger(c.value)||c.value<=0))throw Error('Invalid eligible balance response.');
  if(totalInput===0)throw Error((direction==='to-arkade'?'No confirmed eligible Bitcoin funds.':'No spendable Arkade funds are available.')+(reserved.size?' Pending transfers reserve their inputs until verified.':' Refresh your balance and try again.'));
  const retained=boardingAssets(inputs);
  const maxSats=totalInput-(retained.length?changeMinimum:0);
  if(retained.length && (maxSats<Number(info.utxoMinAmount)|| (requested!==undefined && requested>maxSats)))throw Error(`Leave at least ${changeMinimum} sats in Arkade to preserve your assets. Choose Max for the withdrawable amount.`);
  const amounts=boardingAmounts(totalInput,requested??maxSats,direction==='to-arkade'?Math.max(Number(info.vtxoMinAmount),1):Number(info.utxoMinAmount),changeMinimum);
  if(!Number.isSafeInteger(balance.total)||!Number.isSafeInteger(balance.boarding.total)||balance.boarding.total<0||balance.total<balance.boarding.total)throw Error('Invalid balance response.');
  if(totalInput>(direction==='to-arkade'?balance.boarding.total:balance.available))throw Error('Invalid eligible balance response.');
  if(!bitcoinAddress.startsWith('tb1p'))throw Error('Unsupported account Bitcoin destination.');
  let params: SettleParams | undefined;
  // Capture the SDK's output construction using a facade with no signing or
  // submission capability. Only the later explicitly confirmed path can settle.
  const facade={dustAmount:wallet.dustAmount,getSpendableVtxos:async()=>inputs,getAddress:()=>wallet.getAddress(),getBoardingAddress:async()=>bitcoinAddress,settle:async(p:SettleParams)=>{params=p;return 'quote-only';}} as unknown as IWallet;
  if(direction==='to-arkade')await new Ramps(facade).onboard(info.fees,inputs,BigInt(amounts.amountSats));
  else await new Ramps(facade).offboard(bitcoinAddress,info.fees,BigInt(amounts.amountSats));
  if(!params||params.outputs.reduce((sum,o)=>sum+Number(o.amount),0)!==totalInput)throw Error('Quote does not conserve funds.');
  // SDK settlement assigns every input asset to the output matching this wallet.
  // Keep that output above dust, bind the inventory, and retain it for recovery.
  const own=await wallet.getAddress();
  let assetChange:BoardingAssetChange|undefined;
  if(retained.length) {
    if(direction!=='to-bitcoin'||params.outputs.length!==2||params.outputs[1].address!==own||params.outputs[1].amount!==BigInt(amounts.changeSats))throw Error('Transfer does not preserve your assets.');
    assetChange={script:hex(ArkAddress.decode(own).pkScript),sats:amounts.changeSats,assets:retained};
  }
  if(direction==='to-arkade'&&info.vtxoMaxAmount>0n&&BigInt(amounts.amountSats)>info.vtxoMaxAmount)throw Error('Amount exceeds the operator limit.');
  if(direction==='to-bitcoin'&&info.utxoMaxAmount>0n&&BigInt(amounts.amountSats)>info.utxoMaxAmount)throw Error('Amount exceeds the operator limit.');
  if(direction==='to-bitcoin'&&info.vtxoMaxAmount>0n&&BigInt(amounts.changeSats)>info.vtxoMaxAmount)throw Error('Change exceeds the operator limit.');
  if(direction==='to-arkade'&&info.utxoMaxAmount>0n&&BigInt(amounts.changeSats)>info.utxoMaxAmount)throw Error('Change exceeds the operator limit.');
  const raw=JSON.stringify({profileId,direction,inputs:inputs.map(i=>({txid:i.txid,vout:i.vout,value:i.value,assets:boardingAssets([i])})),outputs:params.outputs.map(o=>({address:o.address,amount:o.amount.toString()})),assetChange,fees:info.fees});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const quote:BoardingQuote=Object.freeze({profileId,direction,amountSats:amounts.amountSats,feeSats:0,netSats:amounts.amountSats,maxSats,inputSats:totalInput,bitcoinAfterSats:balance.boarding.total+(direction==='to-arkade'?-amounts.amountSats:amounts.amountSats),arkadeAfterSats:balance.total-balance.boarding.total+(direction==='to-arkade'?amounts.amountSats:-amounts.amountSats),totalAfterSats:balance.total,expiresAt:Date.now()+60000,fingerprint:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')});
  return {quote,params,bitcoinAddress,assetChange};
}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
// Check the SDK's asset assignment before registering any signed intent.
export function inspectBoardingAssets(proof:string,params:SettleParams,change:BoardingAssetChange) {
  const tx=Transaction.fromPSBT(Uint8Array.from(atob(proof),c=>c.charCodeAt(0)));
  const assetInputs=new Map(params.inputs.flatMap((coin,i)=>{const assets=(coin as ExtendedVirtualCoin).assets;return assets?.length ? [[i+1,assets] as const] : [];}));
  const recipients=params.outputs.map((o,i)=>({address:o.address,amount:Number(o.amount),...(i===1?{assets:change.assets.map(a=>({assetId:a.assetId,amount:BigInt(a.amount)}))}:{})}));
  const expected=Extension.create([createAssetPacket(assetInputs,recipients)]).txOut();
  if(tx.inputsLength!==params.inputs.length+1||tx.outputsLength!==3)throw Error('Transfer asset intent changed.');
  for(let i=0;i<params.inputs.length;i++) {
    const input=tx.getInput(i+1),coin=params.inputs[i];
    if(!input.txid||hex(input.txid)!==coin.txid||input.index!==coin.vout)throw Error('Transfer asset inputs changed.');
  }
  const own=tx.getOutput(1),extension=tx.getOutput(2);
  if(!own.script||hex(own.script)!==change.script||own.amount!==BigInt(change.sats)||!extension.script||hex(extension.script)!==hex(expected.script)||extension.amount!==0n)throw Error('Transfer does not preserve your assets.');
}
export async function quoteBoarding(account:AccountSecret,requested:number|undefined,signal:AbortSignal,direction:BoardingQuote['direction']='to-arkade') {
  return readonly(account,signal,async wallet=>(await plan(wallet,account.profileId,requested,direction)).quote);
}
export function submitBoarding(account:AccountSecret,quote:BoardingQuote,isCurrent:()=>boolean=()=>true):Promise<BoardingRecord> {
  const operationId=crypto.randomUUID();
  let acknowledge!:(record:BoardingRecord)=>void;
  const registered=new Promise<BoardingRecord>(resolve=>{acknowledge=resolve;});
  const run=()=>runBoarding(account,quote,isCurrent,acknowledge,operationId);
  // Keep logout excluded until signing ends; registration releases the caller's
  // account lock so independent inputs can fund another transfer.
  const completion=runBoardingWorker(account.profileId,operationId,()=>globalThis.navigator?.locks?withBrowserMutation(run):run());
  return Promise.race([registered,completion]);
}
async function runBoarding(account:AccountSecret,quote:BoardingQuote,isCurrent:()=>boolean,onRegistered:(record:BoardingRecord)=>void,operationId:string):Promise<BoardingRecord> {
  if(quote.profileId!==account.profileId||!['to-arkade','to-bitcoin'].includes(quote.direction)||quote.expiresAt<=Date.now())throw Error('Review a fresh transfer quote.');
  const c=config();
  let active=true;
  let recordId:string|undefined;
  let intentHash:string|undefined,selectedBatch:string|undefined;
  const observe=async(stage:BoardingStage,action?:BoardingAction)=>{
    if(!recordId||!active)return;
    try {await withBoardingRecordLock(account.profileId,recordId,()=>active?recordBoardingProgress(account.profileId,recordId!,stage,'running',action):undefined);}
    catch {/* Observational metadata must not interrupt signing. */}
  };
  const provider=c.options.arkProvider;
  const confirmRegistration=provider.confirmRegistration.bind(provider);
  provider.confirmRegistration=async id=>{
    if(id!==readBoardingRecord(account.profileId,recordId)?.intentId)throw Error('The transfer intent changed.');
    await observe('registered','confirm-registration');
    await confirmRegistration(id);await observe('batch-selected');
  };
  const nonces=provider.submitTreeNonces.bind(provider);
  provider.submitTreeNonces=async(...args)=>{await observe('signing','tree-nonces');await nonces(...args);};
  const signatures=provider.submitTreeSignatures.bind(provider);
  provider.submitTreeSignatures=async(...args)=>{await observe('signing','tree-signatures');await signatures(...args);};
  const forfeits=provider.submitSignedForfeitTxs.bind(provider);
  provider.submitSignedForfeitTxs=async(...args)=>{await observe('signing','forfeit-signatures');await forfeits(...args);await observe('signatures-submitted');};
  let attempt:ReturnType<typeof createBoardingAttempt>|undefined;
  let prepared:Awaited<ReturnType<typeof plan>>|undefined;
  const schedule=await c.options.arkProvider.getInfo();
  const timeout=settlementTimeoutMs(schedule);
  const deadline=Date.now()+timeout;
  const register=c.options.arkProvider.registerIntent.bind(c.options.arkProvider);
  c.options.arkProvider.registerIntent=async intent=>{
    if(!attempt)throw Error('Transfer preparation is incomplete.');
    if(prepared?.assetChange)inspectBoardingAssets(intent.proof,prepared.params,prepared.assetChange);
    attempt.beforeRegister();
    try {
      const id=await register(intent);
      attempt.registered(id);
      onRegistered(readBoardingRecord(account.profileId,recordId)!);
      try {intentHash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id))));}
      catch {/* Optional event correlation must not interrupt the registered signer. */}
      return id;
    } catch { attempt.interrupted('registration-unconfirmed');throw Error('Submission was not confirmed.'); }
  };
  // Do not allow SDK error recovery to cancel/re-register an ambiguous intent.
  c.options.arkProvider.deleteIntent=async()=>{throw Error('Automatic cancellation is disabled; reconcile the transfer.');};
  try {
    return await withTemporaryWallet(Wallet.create({...c.options,identity:MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false})}),new AbortController().signal,async wallet=>{
      const fresh=await plan(wallet,account.profileId,quote.amountSats,quote.direction);
      const connection=wallet.getProviderConnectionState();
      if(!active || !isCurrent() || Date.now()>=deadline)throw Error('Transfer details changed. Review again.');
      if(!c.healthy() || connection.mode!=='online' || connection.source!=='live')throw Error('Live transfer data is unavailable.');
      assertQuoteUnchanged(quote,fresh.quote);
      prepared=fresh;
      const record:BoardingRecord={version:1,id:operationId,createdAt:Date.now(),profileId:account.profileId,status:'pending',phase:'prepared',quote:fresh.quote,inputs:fresh.params.inputs.map(i=>{if(typeof i==='string')throw Error('Unexpected input.');return {txid:i.txid,vout:i.vout};}),bitcoinAddress:fresh.bitcoinAddress,...(fresh.assetChange?{assetChange:fresh.assetChange}:{})};
      recordId=record.id;
      writeBoardingRecord(record);
      attempt=createBoardingAttempt(record.id,()=>active&&isCurrent(),Math.min(deadline,quote.expiresAt),account.profileId);
      try {
        const commitment=await wallet.settle(fresh.params,async event=>{
          if(event.type==='batch_started'&&intentHash&&event.intentIdHashes.includes(intentHash))selectedBatch=event.id;
          if(!active||!selectedBatch||event.id!==selectedBatch)return;
          if(event.type==='tree_signing_started')await observe('batch-selected','validate-tree');
          if(event.type==='batch_finalization')await observe(readBoardingRecord(account.profileId,record.id)?.progress?.stage??'batch-selected','validate-finalization');
          if(event.type==='batch_failed')await withBoardingRecordLock(account.profileId,record.id,()=>{if(active)attempt!.interrupted('batch-failed');});
        });
        await withBoardingRecordLock(account.profileId,record.id,()=>attempt!.committed(commitment));
      }
      catch(error) { await withBoardingRecordLock(account.profileId,record.id,()=>{
        const current=readBoardingRecord(account.profileId,record.id);
        attempt!.interrupted(current?.phase==='submitting'?'registration-unconfirmed':current?.diagnostic==='batch-failed'?'batch-failed':settlementDiagnostic(error));
      }); }
      attempt.close();
      return readBoardingRecord(account.profileId,record.id)!;
    },timeout);
  } catch(error) {
    attempt?.interrupted(Date.now()>=deadline?'deadline-exceeded':'settlement-interrupted');
    throw error;
  } finally {
    active=false; // Closes late preparation/registration after timeout or disposal.
    attempt?.close();
  }
}
export async function reconcileBoarding(account:AccountSecret,signal:AbortSignal):Promise<BoardingRecord|undefined> {
  let latest:BoardingRecord|undefined;
  for(const record of readBoardingRecords(account.profileId))latest=await reconcileRecord(account,signal,record);
  return latest;
}
export async function readLiveBoardingState(account:AccountSecret,signal:AbortSignal) {
  const records=readBoardingRecords(account.profileId).filter(r=>r.quote.direction==='to-arkade' && r.status!=='not-submitted');
  if(!records.length)return 'ready' as const;
  return readonly(account,signal,async wallet=>{
    const transactions=(await Promise.all([...new Set(records.map(r=>r.bitcoinAddress))].map(address=>wallet.onchainProvider.getTransactions(address)))).flat();
    signal.throwIfAborted();
    return liveBoardingState(records,transactions);
  });
}
/** Read-only live evidence; does not set a persisted "boarded" flag. */
export async function readLiveBoardingWait(account:AccountSecret,signal:AbortSignal):Promise<boolean> {
  const records=readBoardingRecords(account.profileId).filter(r=>r.quote.direction==='to-arkade');
  if(!records.length)return false;
  return readonly(account,signal,async wallet=>{
    const transactions=(await Promise.all([...new Set(records.map(r=>r.bitcoinAddress))].map(address=>wallet.onchainProvider.getTransactions(address)))).flat();
    signal.throwIfAborted();
    return hasLiveBoardingWait(records,transactions);
  });
}
async function reconcileRecord(account:AccountSecret,signal:AbortSignal,record:BoardingRecord):Promise<BoardingRecord|undefined> {
  if(!record||record.profileId!==account.profileId)return;
  if(record.status!=='pending')return record;
  if(record.phase==='prepared')return withWalletMutation(async()=>recoverPreparedBoarding(readBoardingRecord(account.profileId,record.id)!),account.profileId);
  const result = await readonly(account,signal,async wallet=>{
    const transactions=await wallet.onchainProvider.getTransactions(record.bitcoinAddress);
    const vtxos=await wallet.getVtxos();
    const records=readBoardingRecords(account.profileId);
    const outpoints=[...new Map(records.filter(r=>r.status!=='not-submitted'&&r.quote.direction==='to-bitcoin').flatMap(r=>r.inputs).map(i=>[`${i.txid}:${i.vout}`,i])).values()];
    const consumed=outpoints.length ? (await new RestIndexerProvider(SIGNET_OPERATOR).getVtxos({outpoints})).vtxos : [];
    const commitmentTxid=verifiedBoardingCommitment(record,transactions,vtxos,consumed,records);
    if(commitmentTxid) {
      const current=readBoardingRecord(account.profileId,record.id);
      if(current?.id!==record.id)return current;
      return {...current,status:'succeeded' as const,commitmentTxid};
    }
    return record; // Unspent inputs or absent history do not prove failure.
  });
  if(result?.status==='succeeded')return withBoardingRecordLock(account.profileId,result.id,()=>{
    const current=readBoardingRecord(account.profileId,result.id);
    if(!current||current.status!=='pending')return current;
    // Re-read inside the operation lock so a slow receipt read cannot erase a
    // newer signing acknowledgement or resurrect a cleared operation.
    const next={...current,status:'succeeded' as const,commitmentTxid:result.commitmentTxid,progress:{stage:'confirmed' as const,execution:'awaiting-confirmation' as const,observedAt:Date.now()}};
    writeBoardingRecord(next);return next;
  });
  return readBoardingRecord(account.profileId,record.id)??result;
}

