export type BisAssetDeliveryRequest = Readonly<{operationId:string; assetId:string; quantity:string; recipient:string}>;
export type BisAssetDeliveryResult = Readonly<{status:'delivered'|'already-delivered'; profileId:string; operationId:string; assetId:string; quantity:string; recipient:string; transactionId:string}>
  | Readonly<{status:'error'; code:'invalid-input'|'unavailable'|'outcome-unknown'|'account-changed'; message:string; profileId?:string; operationId?:string}>;
export type AssetDeliveryInput = Readonly<{txid:string;vout:number}>;
export type AssetDeliveryRecord = Readonly<{version:1;id:string;profileId:string;request:BisAssetDeliveryRequest;status:'pending'|'succeeded';inputs:readonly AssetDeliveryInput[];recipientScript:string;transactionId?:string}>;

const key=(profileId:string)=>`bis-signet-asset-delivery-v1:${encodeURIComponent(profileId)}`;
const operationKey=(profileId:string,id:string)=>`${key(profileId)}:${id}`;
export class AssetDeliveryError extends Error {
  code:Extract<BisAssetDeliveryResult,{status:'error'}>['code'];
  constructor(code:AssetDeliveryError['code'],message:string){super(message);this.code=code;}
}
export function validateAssetDelivery(input:BisAssetDeliveryRequest):BisAssetDeliveryRequest {
  if(!input||typeof input.operationId!=='string'||typeof input.assetId!=='string'||typeof input.quantity!=='string'||typeof input.recipient!=='string'
    ||!/^[\w-]{1,128}$/.test(input.operationId)||!/^[a-f0-9]{68}$/i.test(input.assetId)||!/^[1-9][0-9]{0,19}$/.test(input.quantity)||BigInt(input.quantity)>18446744073709551615n
    ||!/^tark1[0-9a-z]{8,256}$/i.test(input.recipient))throw new AssetDeliveryError('invalid-input','The item delivery details are invalid. Refresh and try again.');
  return Object.freeze({operationId:input.operationId,assetId:input.assetId.toLowerCase(),quantity:input.quantity,recipient:input.recipient.trim()});
}
function validateInput(input:unknown):input is AssetDeliveryInput {
  return !!input&&typeof input==='object'&&typeof (input as AssetDeliveryInput).txid==='string'&&/^[a-f0-9]{64}$/i.test((input as AssetDeliveryInput).txid)&&Number.isSafeInteger((input as AssetDeliveryInput).vout)&&(input as AssetDeliveryInput).vout>=0;
}
function validRecord(value:unknown,profileId:string,storageKey:string):value is AssetDeliveryRecord {
  if(!value||typeof value!=='object')return false;
  const record=value as AssetDeliveryRecord;
  try {validateAssetDelivery(record.request);}catch{return false;}
  return record.version===1&&record.id===record.request.operationId&&record.profileId===profileId&&storageKey===operationKey(profileId,record.id)
    &&(record.status==='pending'||record.status==='succeeded')&&Array.isArray(record.inputs)&&record.inputs.length>0&&record.inputs.every(validateInput)
    &&typeof record.recipientScript==='string'&&/^5120[a-f0-9]{64}$/i.test(record.recipientScript)
    &&(record.transactionId===undefined||/^[a-f0-9]{64}$/i.test(record.transactionId))&&!(record.status==='succeeded'&&!record.transactionId);
}
export function readAssetDeliveryRecords(profileId:string|undefined):AssetDeliveryRecord[] {
  if(!profileId)return [];
  try {
    const records:AssetDeliveryRecord[]=[];
    for(let index=0;index<localStorage.length;index++){
      const storageKey=localStorage.key(index);
      if(!storageKey?.startsWith(`${key(profileId)}:`))continue;
      const record=JSON.parse(localStorage.getItem(storageKey)!);
      if(!validRecord(record,profileId,storageKey)||records.some(item=>item.id===record.id))throw Error();
      records.push(record);
    }
    return records.sort((a,b)=>a.id.localeCompare(b.id));
  }catch{throw new AssetDeliveryError('outcome-unknown','Item delivery recovery data could not be verified. Do not submit another delivery.');}
}
export function readAssetDeliveryRecord(profileId:string|undefined,operationId?:string):AssetDeliveryRecord|undefined {
  const records=readAssetDeliveryRecords(profileId);
  return operationId===undefined?records.find(record=>record.status==='pending'):records.find(record=>record.id===operationId);
}
export function writeAssetDeliveryRecord(record:AssetDeliveryRecord):void {
  const request=validateAssetDelivery(record.request),storageKey=operationKey(record.profileId,record.id);
  if(record.id!==request.operationId||!validRecord({...record,request},record.profileId,storageKey))throw new AssetDeliveryError('invalid-input','Item delivery recovery data is invalid.');
  const existing=readAssetDeliveryRecord(record.profileId,record.id);
  if(existing&&JSON.stringify(existing.request)!==JSON.stringify(request))throw new AssetDeliveryError('invalid-input','The item delivery request changed.');
  if(existing?.status==='succeeded'&&record.status!=='succeeded')throw new AssetDeliveryError('outcome-unknown','The item delivery already has a confirmed result.');
  const raw=JSON.stringify({...record,request});
  try{localStorage.setItem(storageKey,raw);if(localStorage.getItem(storageKey)!==raw)throw Error();}
  catch{throw new AssetDeliveryError('unavailable','Item delivery status could not be saved.');}
}
export function assertNoPendingAssetDelivery(profileId:string|undefined):void {
  if(readAssetDeliveryRecords(profileId).some(record=>record.status==='pending'))throw new AssetDeliveryError('outcome-unknown','An item delivery has an unknown outcome. Its exact asset and inputs remain reserved until resolved.');
}
