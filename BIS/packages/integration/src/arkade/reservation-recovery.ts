import {ArkAddress,RestIndexerProvider,Transaction} from '@arkade-os/sdk';
import {loadAddresses} from './addresses.ts';
import {SIGNET_OPERATOR,type AccountSecret} from './account.ts';
import {walletReservations,saveReconstructedReservation} from '../core/wallet-reservations.ts';
import {withWalletMutation} from '../core/boarding-record.ts';
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const decode=(raw:string)=>Transaction.fromRaw(Uint8Array.from(raw.match(/../g)??[],b=>parseInt(b,16)));

/** Public transaction data only. No signing, resubmission, cancellation or finality inference. */
export async function reconstructWalletReservations(account:AccountSecret,signal:AbortSignal) {
  const missing=walletReservations(account.profileId).filter(r=>!r.inputs&&r.transactionId);
  if(!missing.length)return;
  const provider=new RestIndexerProvider(SIGNET_OPERATOR);
  const own=hex(ArkAddress.decode((await loadAddresses(account,signal)).arkadeAddress).pkScript);
  for(const operation of missing) {
    try {
      signal.throwIfAborted();
      const result=await provider.getVirtualTxs([operation.transactionId!]);
      const transaction=result.txs.map(decode).find(tx=>tx.id===operation.transactionId);
      if(!transaction||!transaction.inputsLength)continue;
      const refs=Array.from({length:transaction.inputsLength},(_,i)=>transaction.getInput(i));
      if(refs.some(input=>!input.txid||input.index===undefined))continue;
      const previous=(await provider.getVirtualTxs(refs.map(input=>hex(input.txid!)))).txs.map(decode);
      const inputs=refs.map(input=>{
        const prior=previous.find(tx=>tx.id===hex(input.txid!));
        if(!prior)throw Error('Ancestry unavailable');
        if(input.index===0&&prior.inputsLength===1&&prior.outputsLength===2&&hex(prior.getOutput(1).script??new Uint8Array())==='51024e73') {
          const original=prior.getInput(0);if(!original.txid||original.index===undefined)throw Error('Input unavailable');
          return {txid:hex(original.txid),vout:original.index};
        }
        return {txid:hex(input.txid!),vout:input.index!};
      });
      if(new Set(inputs.map(i=>`${i.txid}:${i.vout}`)).size!==inputs.length)continue;
      const {vtxos}=await provider.getVtxos({outpoints:inputs});signal.throwIfAborted();
      if(!inputs.every(input=>vtxos.some(v=>v.txid===input.txid&&v.vout===input.vout&&v.script===own)))continue;
      await withWalletMutation(async()=>{signal.throwIfAborted();saveReconstructedReservation(account.profileId,operation.id,operation.transactionId!,inputs);},account.profileId);
    } catch { /* Unverifiable inputs retain the explicit spending hold. */ }
  }
}
