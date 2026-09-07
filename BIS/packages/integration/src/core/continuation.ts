import { validateSendRecord, type SendRecord } from './sending.ts';

export type BisContinueRequest = Readonly<{operationId:string; sats:number; context:string}>;
export type BisContinueResult = Readonly<BisContinueRequest & {profileId:string; status:'pending'|'succeeded'|'failed'; mechanism:'sink-payment'; feeSats:0; transactionId?:string; recipient?:string; message?:string}>;
export type ContinueRecord = {request:BisContinueRequest; profileId:string; status:BisContinueResult['status']; send?:SendRecord; message?:string};
export const continuationPrefix='bis-signet-continuations-v1:';
export function validateContinue(request:BisContinueRequest) {
  // Local validation is not fail-safe or cheat-resistant price enforcement.
  if (!request || !Number.isSafeInteger(request.sats) || request.sats<1000 || request.sats>10000 ||
    typeof request.operationId!=='string' || !request.operationId.trim() || request.operationId.length>200 ||
    typeof request.context!=='string' || !request.context.trim() || request.context.length>500) throw Error('Continue requires an operation ID, context and 1,000–10,000 whole sats.');
}
export function readContinuations(profileId:string,storage:Pick<Storage,'getItem'>=localStorage):ContinueRecord[] {
  try {
    const raw=storage.getItem(continuationPrefix+encodeURIComponent(profileId));
    const records:ContinueRecord[]=raw===null?[]:JSON.parse(raw);
    if (!Array.isArray(records)) throw Error();
    const ids=new Set<string>();
    for(const record of records) {
      if(!record || Object.keys(record).some(k=>!['request','profileId','status','send','message'].includes(k)))throw Error();
      validateContinue(record.request);
      if(Object.keys(record.request).some(k=>!['operationId','sats','context'].includes(k)))throw Error();
      if(record.profileId!==profileId || !['pending','succeeded','failed'].includes(record.status) || ids.has(record.request.operationId))throw Error();
      ids.add(record.request.operationId);
      if(record.send)validateSendRecord(record.send);
      if(record.send && (record.send.profileId!==profileId || record.send.quote.amountSats!==record.request.sats || record.send.quote.feeSats!==0 || !/^[a-f0-9]{64}$/.test(record.send.transactionId)))throw Error();
      if(record.send && record.status!==record.send.status)throw Error();
      if(record.message!==undefined && (typeof record.message!=='string' || record.message.length>200))throw Error();
      if(record.status==='succeeded' && record.send?.status!=='succeeded')throw Error();
    }
    return records;
  } catch {throw Error('Continuation recovery data is unavailable. Spending and clearing remain blocked.');}
}
export function writeContinuation(record:ContinueRecord) {
  const records=readContinuations(record.profileId),index=records.findIndex(r=>r.request.operationId===record.request.operationId);
  if(index<0)records.push(record);else records[index]=record;
  const key=continuationPrefix+encodeURIComponent(record.profileId),raw=JSON.stringify(records);
  localStorage.setItem(key,raw);
  if(localStorage.getItem(key)!==raw)throw Error('Continuation could not be saved.');
}
export function assertNoPendingContinue(profileId:string|undefined,storage:Pick<Storage,'getItem'>=localStorage) {
  if(profileId && readContinuations(profileId,storage).some(r=>r.status==='pending'))throw Error('A continuation is unresolved. Check its status before spending or clearing this account.');
}
export function continueResult(record:ContinueRecord):BisContinueResult {
  // Presentation-only compatibility for the legacy B1 funds rejection.
  // Leave the saved operation and its historical amounts unchanged.
  const message=record.status==='failed' && !record.send && record.message==='Enter an affordable whole-sats amount above the minimum.'
    ? `Insufficient eligible spendable funds for this ${record.request.sats.toLocaleString('en-US')}-sat payment. No payment was submitted. Total balance may include ineligible outputs.`
    : record.message ?? 'Payment was not submitted.';
  return Object.freeze({...record.request,profileId:record.profileId,status:record.status,mechanism:'sink-payment',feeSats:0,
    ...(record.send?{transactionId:record.send.transactionId,recipient:record.send.quote.recipient}:{}),
    ...(record.status==='failed'?{message}:{})});
}
