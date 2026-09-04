import {SendError} from '../core/sending.ts';
import {createAccount,type AccountSecret} from './account.ts';
import {loadAddresses} from './addresses.ts';
import {quoteSend,submitSend,reconcileSend,type SendJournal} from './sending.ts';
import {continueResult,readContinuations,writeContinuation,type ContinueRecord} from '../core/continuation.ts';

function journal(record:ContinueRecord):SendJournal {
  const read=()=>readContinuations(record.profileId).find(r=>r.request.operationId===record.request.operationId)!.send;
  return {read,write(send){writeContinuation({...record,send,status:send.status});},complete(id,transactionId){
    const send=read();if(!send || send.id!==id || send.transactionId!==transactionId)throw Error('Continuation changed.');
    writeContinuation({...record,send:{...send,status:'succeeded'},status:'succeeded'});
  }};
}
export async function reconcileContinuation(account:AccountSecret,record:ContinueRecord,signal:AbortSignal) {
  if(record.status!=='pending')return continueResult(record);
  if(!record.send) { // Under the wallet lock, no submit marker proves preparation never reached the network.
    record={...record,status:'failed'};writeContinuation(record);return continueResult(record);
  }
  try {await reconcileSend(account,signal,journal(record));}catch {/* Unknown is still pending. */}
  return continueResult(readContinuations(account.profileId).find(r=>r.request.operationId===record.request.operationId)!);
}
export async function submitContinuation(account:AccountSecret,record:ContinueRecord,signal:AbortSignal,isCurrent:()=>boolean) {
  writeContinuation(record);
  try {
    // This identity is never saved to AccountStorage or activated. Only its public address survives.
    const recipient=await createAccount(signal);
    const {arkadeAddress}=await loadAddresses(recipient,signal);
    const quote=await quoteSend(account,arkadeAddress,record.request.sats,signal,true);
    if(!isCurrent())throw Error('Account changed.');
    await submitSend(account,quote,isCurrent,journal(record),true);
  } catch(error) {
    const saved=readContinuations(account.profileId).find(r=>r.request.operationId===record.request.operationId)!;
    if(!saved.send)writeContinuation({...saved,status:'failed',message:error instanceof SendError?error.message:'Payment preparation failed; no payment was submitted.'});
  }
  return continueResult(readContinuations(account.profileId).find(r=>r.request.operationId===record.request.operationId)!);
}
