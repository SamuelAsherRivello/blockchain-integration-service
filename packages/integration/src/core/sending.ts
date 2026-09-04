import {readWalletRecord, walletRecordKey} from './wallet-record.ts';
export type BisSendQuote = Readonly<{id:string;profileId:string;recipient:string;amountSats:number;feeSats:number;totalSats:number;maxSats:number;expiresAt:number;fingerprint:string}>;
export type BisSendStatus = Readonly<{status:'idle'|'pending'|'succeeded';transactionId?:string;amountSats?:number;recipient?:string;verification?:'live'|'unavailable'}>;
export type SendRecord = {version:1;id:string;profileId:string;status:'pending'|'succeeded';transactionId:string;quote:BisSendQuote;inputs:{txid:string;vout:number}[];recipientScript:string};
export class SendError extends Error {}
const key='bis-signet-send-operation-v1';
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const natural=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
export function sendAmounts(total:number,requested:number|undefined,dust:number) {
 const amount=requested??total;
 if(!natural(total)||!natural(dust)||dust<1||!natural(amount)||amount<dust||amount>total)throw new SendError('Enter an affordable whole-sats amount above the minimum.');
 const change=total-amount;
 if(change>0&&change<dust)throw new SendError('The remaining change is below the minimum. Use Max or a smaller amount.');
 return {amountSats:amount,changeSats:change,maxSats:total};
}
export function assertSendQuote(reviewed:BisSendQuote,fresh:BisSendQuote,now=Date.now()) {
 if(reviewed.expiresAt<=now||(['profileId','recipient','amountSats','feeSats','totalSats','maxSats','fingerprint'] as const).some(k=>reviewed[k]!==fresh[k]))throw new SendError('Send details changed. Review again.');
}
function validate(r:SendRecord):SendRecord {
 const q=r?.quote;
 if(!r||Object.keys(r).some(k=>!['version','id','profileId','status','transactionId','quote','inputs','recipientScript'].includes(k))||r.version!==1||!r.id||typeof r.id!=='string'||typeof r.profileId!=='string'||!r.profileId||!['pending','succeeded'].includes(r.status)||!hash(r.transactionId)||!q||Object.keys(q).some(k=>!['id','profileId','recipient','amountSats','feeSats','totalSats','maxSats','expiresAt','fingerprint'].includes(k))||typeof q.id!=='string'||!q.id||q.profileId!==r.profileId||typeof q.recipient!=='string'||!q.recipient.startsWith('tark1')||q.recipient.length>300||!hash(q.fingerprint)||![q.amountSats,q.feeSats,q.totalSats,q.maxSats,q.expiresAt].every(natural)||q.amountSats<=0||q.totalSats!==q.amountSats+q.feeSats||q.totalSats>q.maxSats||!Array.isArray(r.inputs)||!r.inputs.length||r.inputs.some(i=>!hash(i.txid)||!natural(i.vout)||Object.keys(i).some(k=>!['txid','vout'].includes(k)))||new Set(r.inputs.map(i=>`${i.txid}:${i.vout}`)).size!==r.inputs.length||!/^5120[a-f0-9]{64}$/.test(r.recipientScript))throw new SendError('Send recovery data is invalid. Spending and account clearing remain blocked.');
 return r;
}
export function readSendRecord(profileId: string | undefined):SendRecord|undefined {
 try {return readWalletRecord(key,profileId,validate);}
 catch {throw new SendError('Send recovery data is unavailable. Spending and account clearing remain blocked.');}
}
export function writeSendRecord(record:SendRecord) {
 validate(record);const raw=JSON.stringify(record),scopedKey=walletRecordKey(key,record.profileId);
 try {localStorage.setItem(scopedKey,raw);if(localStorage.getItem(scopedKey)!==raw)throw Error();}
 catch {throw new SendError('Send recovery data could not be saved.');}
}
export function assertNoPendingSend(profileId: string | undefined) {if(readSendRecord(profileId)?.status==='pending')throw new SendError('A send is unresolved. Open Send and Check Status before spending or clearing this account.');}
export function completeSend(id:string,transactionId:string,profileId:string) {
 const record=readSendRecord(profileId);
 if(!record||record.id!==id||record.transactionId!==transactionId)throw new SendError('The send operation changed.');
 writeSendRecord({...record,status:'succeeded'});
}
export function sendStatus(record:SendRecord|undefined,verification:'live'|'unavailable'='live'):BisSendStatus {
 return record?{status:record.status,transactionId:record.transactionId,amountSats:record.quote.amountSats,recipient:record.quote.recipient,verification}:{status:'idle'};
}
