export type BisBurnAssetRequest = Readonly<{operationId:string; assetId:string; quantity:string}>;
export type BisBurnAssetResult = Readonly<{status:'burned'; assetId:string; quantity:string; transactionId:string}>
  | Readonly<{status:'error'; code:'invalid-input'|'unavailable'|'outcome-unknown'|'account-changed'; message:string}>;
export type BurnRecord = {version:1; id:string; profileId:string; request:BisBurnAssetRequest; status:'pending'|'succeeded'; transactionId?:string};
const key = (profileId:string) => `bis-signet-burn-operation-v1:${encodeURIComponent(profileId)}`;
export class BurnError extends Error {
  code: Extract<BisBurnAssetResult,{status:'error'}>['code'];
  constructor(code: BurnError['code'], message:string) {super(message);this.code=code;}
}
export function validateBurn(request:BisBurnAssetRequest): BisBurnAssetRequest {
  if (!request || typeof request.operationId!=='string' || typeof request.assetId!=='string' || typeof request.quantity!=='string' || !/^[\w-]{1,128}$/.test(request.operationId) || !/^[a-f0-9]{68}$/i.test(request.assetId) || !/^[1-9][0-9]{0,19}$/.test(request.quantity) || BigInt(request.quantity)>18446744073709551615n) throw new BurnError('invalid-input','The asset or quantity is invalid. Refresh Assets and try again.');
  return {operationId:request.operationId,assetId:request.assetId,quantity:request.quantity};
}
export function readBurnRecord(profileId:string|undefined, operationId?:string): BurnRecord | undefined {
  if (!profileId) return;
  try {
    const records:BurnRecord[]=[];
    for(let i=0;i<localStorage.length;i++) {
      const storageKey=localStorage.key(i);
      if(!storageKey?.startsWith(`${key(profileId)}:`))continue;
      const record:BurnRecord=JSON.parse(localStorage.getItem(storageKey)!);
      validateBurn(record.request);
      if(record.version!==1 || record.id!==record.request.operationId || record.profileId!==profileId || storageKey!==`${key(profileId)}:${record.id}` || !['pending','succeeded'].includes(record.status) || (record.transactionId!==undefined && !/^[a-f0-9]{64}$/i.test(record.transactionId)) || (record.status==='succeeded' && !record.transactionId))throw Error();
      records.push(record);
    }
    return operationId ? records.find(record=>record.id===operationId) : records.find(record=>record.status==='pending');
  } catch {throw new BurnError('outcome-unknown','Burn state could not be read. Do not submit another burn.');}
}
export function writeBurnRecord(record:BurnRecord) {
  const raw=JSON.stringify(record);
  const storageKey=`${key(record.profileId)}:${record.id}`;
  try {localStorage.setItem(storageKey,raw);if(localStorage.getItem(storageKey)!==raw)throw Error();}
  catch {throw new BurnError('unavailable','Burn status could not be saved.');}
}
export function assertNoPendingBurn(profileId:string|undefined) {
  if(readBurnRecord(profileId)?.status==='pending')throw new BurnError('outcome-unknown','A burn has an unknown outcome. Do not retry or start another spend until its outcome is resolved.');
}
