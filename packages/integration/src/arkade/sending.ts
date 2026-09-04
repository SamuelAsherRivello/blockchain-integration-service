import { ArkAddress, MnemonicIdentity, ReadonlyWallet, Wallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, Transaction, type ExtendedVirtualCoin } from '@arkade-os/sdk';
import { SIGNET_OPERATOR, requireSignet, withTemporaryWallet, type AccountSecret } from './account.ts';
import { readFreshBalance } from './balance.ts';
import { SendError, sendAmounts, assertSendQuote, readSendRecord, writeSendRecord, completeSend, type BisSendQuote, type SendRecord } from '../core/sending.ts';

const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const decode=(encoded:string)=>Transaction.fromPSBT(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));
export function sendRecipient(raw:string,own:string) {
 try {
  const address=ArkAddress.decode(raw.trim()),sender=ArkAddress.decode(own);
  if(address.hrp!=='tark'||address.version!==0||hex(address.serverPubKey)!==hex(sender.serverPubKey)||hex(address.vtxoTaprootKey)===hex(sender.vtxoTaprootKey))throw Error();
  return address;
 } catch {throw new SendError('Enter another Arkade test address for this operator.');}
}
function config(signal:AbortSignal) {
 const arkProvider=new RestArkProvider(SIGNET_OPERATOR), indexerProvider=new RestIndexerProvider(SIGNET_OPERATOR);
 const getInfo=arkProvider.getInfo.bind(arkProvider);
 arkProvider.getInfo=async()=>{signal.throwIfAborted();const info=await getInfo();requireSignet(info.network);return info;};
 let failed=false;const getVtxos=indexerProvider.getVtxos.bind(indexerProvider);
 indexerProvider.getVtxos=async(...args)=>{try {signal.throwIfAborted();return await getVtxos(...args);}catch(e){failed=true;throw e;}};
 return {options:{arkProvider,indexerProvider,settlementConfig:false as const,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}},assertFresh(){signal.throwIfAborted();if(failed)throw new SendError('Live send data is unavailable.');}};
}
async function funds(wallet:ReadonlyWallet) {
 const info=await new RestArkProvider(SIGNET_OPERATOR).getInfo();requireSignet(info.network);
 if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw new SendError('The operator fee schedule changed. Sending needs fee verification.');
 const coins=(await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false})).filter(c=>!c.assets?.length).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
 const balance=await readFreshBalance(wallet);
 const total=coins.reduce((sum,c)=>sum+c.value,0);
 if(!Number.isSafeInteger(total)||total<0||total>balance.availableSats||coins.some(c=>!Number.isSafeInteger(c.value)||c.value<=0))throw new SendError('Live send data is unavailable.');
 return {info,coins,total,dust:Math.max(Number(wallet.dustAmount),Number(info.vtxoMinAmount),1)};
}
async function plan(wallet:ReadonlyWallet,profileId:string,recipient:string,requested?:number) {
 const own=await wallet.getAddress();const address=sendRecipient(recipient,own);
 const {info,coins,total,dust}=await funds(wallet), amounts=sendAmounts(total,requested,dust);
 if(info.vtxoMaxAmount>0n&&(BigInt(amounts.amountSats)>info.vtxoMaxAmount||BigInt(amounts.changeSats)>info.vtxoMaxAmount))throw new SendError('Amount exceeds the operator limit.');
 const raw=JSON.stringify({profileId,recipient:address.encode(),amount:amounts.amountSats,inputs:coins.map(c=>[c.txid,c.vout,c.value]),fees:info.fees,own,dust});
 const fingerprint=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))));
 const quote:BisSendQuote=Object.freeze({id:crypto.randomUUID(),profileId,recipient:address.encode(),amountSats:amounts.amountSats,feeSats:0,totalSats:amounts.amountSats,maxSats:total,expiresAt:Date.now()+60000,fingerprint});
 return {quote,coins,recipientScript:hex(address.pkScript),changeScript:hex(ArkAddress.decode(own).pkScript)};
}
async function read<T>(account:AccountSecret,signal:AbortSignal,work:(wallet:ReadonlyWallet)=>Promise<T>):Promise<T> {
 const c=config(signal),identity=await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly();
 return withTemporaryWallet(ReadonlyWallet.create({...c.options,identity}),signal,async wallet=>{const result=await work(wallet);c.assertFresh();return result;});
}
export const loadSendFunds=(account:AccountSecret,signal:AbortSignal)=>read(account,signal,async wallet=>(await funds(wallet)).total);
export const quoteSend=(account:AccountSecret,recipient:string,amount:number|undefined,signal:AbortSignal)=>read(account,signal,async wallet=>(await plan(wallet,account.profileId,recipient,amount)).quote);

// Verify the entire direct-send shape, including the checkpoint indirection.
// No signed bytes are returned or persisted by this boundary.
export function inspectSendTransaction(encoded:string,checkpoints:string[],quote:BisSendQuote,coins:Pick<ExtendedVirtualCoin,'txid'|'vout'|'value'>[],recipientScript:string,changeScript:string) {
 const tx=decode(encoded), cps=checkpoints.map(decode),change=quote.maxSats-quote.totalSats;
 if(quote.feeSats!==0||quote.totalSats!==quote.amountSats||coins.reduce((sum,c)=>sum+c.value,0)!==quote.maxSats)throw new SendError('Prepared send amounts changed.');
 if(cps.length!==coins.length||tx.inputsLength!==coins.length||tx.outputsLength!==(change>0?3:2))throw new SendError('Prepared send does not match review.');
 for(let i=0;i<coins.length;i++) {
  const cp=cps[i],original=cp.getInput(0),input=tx.getInput(i);
  const checkpointOutput=cp.getOutput(0),anchor=cp.getOutput(1);
  if(!checkpointOutput.script||!input.witnessUtxo?.script||hex(checkpointOutput.script)!==hex(input.witnessUtxo.script)||!anchor.script||hex(anchor.script)!=='51024e73'||anchor.amount!==0n)throw new SendError('Prepared checkpoint changed.');
  if(cp.inputsLength!==1||cp.outputsLength!==2||!original.txid||hex(original.txid)!==coins[i].txid||original.index!==coins[i].vout||original.witnessUtxo?.amount!==BigInt(coins[i].value)||cp.getOutput(0).amount!==BigInt(coins[i].value)||!input.txid||hex(input.txid)!==cp.id||input.index!==0||input.witnessUtxo?.amount!==BigInt(coins[i].value))throw new SendError('Prepared send inputs changed.');
 }
 const outputs=[{script:recipientScript,amount:quote.amountSats},...(change>0?[{script:changeScript,amount:change}]:[]),{script:'51024e73',amount:0}];
 for(let i=0;i<outputs.length;i++){const out=tx.getOutput(i);if(!out.script||hex(out.script)!==outputs[i].script||out.amount!==BigInt(outputs[i].amount))throw new SendError('Prepared send outputs changed.');}
 return tx.id;
}
export async function submitSend(account:AccountSecret,quote:BisSendQuote,isCurrent:()=>boolean):Promise<SendRecord> {
 const signal=AbortSignal.timeout(30000),c=config(signal);let open=true,record:SendRecord|undefined;
 const submit=c.options.arkProvider.submitTx.bind(c.options.arkProvider);
 c.options.arkProvider.submitTx=async()=>{throw new SendError('Send preparation is incomplete.');};
 try {
  return await withTemporaryWallet(Wallet.create({...c.options,identity:MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false})}),signal,async wallet=>{
   const fresh=await plan(wallet,account.profileId,quote.recipient,quote.amountSats);c.assertFresh();assertSendQuote(quote,fresh.quote);
   c.options.arkProvider.submitTx=async(encoded,checkpoints)=>{
    c.assertFresh();if(!open||!isCurrent()||record||quote.expiresAt<=Date.now())throw new SendError('Send details changed. Review again.');
    const transactionId=inspectSendTransaction(encoded,checkpoints,quote,fresh.coins,fresh.recipientScript,fresh.changeScript);
    const next:SendRecord={version:1,id:crypto.randomUUID(),profileId:account.profileId,status:'pending',transactionId,quote,inputs:fresh.coins.map(c=>({txid:c.txid,vout:c.vout})),recipientScript:fresh.recipientScript};
    writeSendRecord(next);record=next; // Must complete before any network submission.
    return submit(encoded,checkpoints);
   };
   const transactionId=await wallet.send({recipients:[{address:quote.recipient,amount:quote.amountSats}],selectedVtxos:fresh.coins});
   if(!record||record.transactionId!==transactionId)throw new SendError('Send result needs verification.');
   completeSend(record.id,transactionId,account.profileId);return readSendRecord(account.profileId)!;
  },30000);
 } catch(e) {if(record)return readSendRecord(account.profileId)!;throw e instanceof SendError?e:new SendError('Send could not be prepared. Review again.');}
 finally {open=false;}
}
export async function reconcileSend(account:AccountSecret,signal:AbortSignal):Promise<SendRecord|undefined> {
 const record=readSendRecord(account.profileId);if(!record||record.profileId!==account.profileId)return;
 if(record.status==='succeeded')return record;
 // The indexer exposes finalized VTXOs; an absent output is not proof of failure.
 const provider=new RestArkProvider(SIGNET_OPERATOR);requireSignet((await provider.getInfo()).network);signal.throwIfAborted();
 const {vtxos}=await new RestIndexerProvider(SIGNET_OPERATOR).getVtxos({outpoints:[{txid:record.transactionId,vout:0}]});signal.throwIfAborted();
 const receipt=vtxos.find(c=>c.txid===record.transactionId&&c.vout===0&&c.value===record.quote.amountSats&&c.script===record.recipientScript);
 if(receipt){completeSend(record.id,record.transactionId,account.profileId);return readSendRecord(account.profileId);}
 return record;
}
