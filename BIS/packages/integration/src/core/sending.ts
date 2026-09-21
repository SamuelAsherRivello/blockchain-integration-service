import {assertNoPendingContinue} from './continuation.ts';
import {readWalletRecord, walletRecordKey} from './wallet-record.ts';
import type { TestNetwork } from './test-network.ts';
export type BisSendQuote = Readonly<{id:string;profileId:string;recipient:string;amountSats:number;feeSats:number;totalSats:number;maxSats:number;expiresAt:number;fingerprint:string}>;
export type BisSendStatus = Readonly<{status:'idle'|'pending'|'succeeded';transactionId?:string;amountSats?:number;recipient?:string;verification?:'live'|'unavailable'}>;
export type SendRecord = {version:1;id:string;profileId:string;status:'pending'|'succeeded';transactionId:string;quote:BisSendQuote;inputs:{txid:string;vout:number}[];recipientScript:string;network?:TestNetwork;change?:{script:string;sats:number;assets:{assetId:string;amount:string}[]}};
export class SendError extends Error {}
const key=(network:TestNetwork='signet')=>`bis-${network}-send-operation-v1`;
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const natural=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
export function sendAmounts(total:number,requested:number|undefined,dust:number) {
 const amount=requested??total;
 if(!natural(total)||!natural(dust)||dust<1)throw new SendError('Eligible spendable funds or operator limits could not be verified.');
 if(!natural(amount)||amount===0)throw new SendError('Enter a positive whole-sats amount.');
 if(amount<dust)throw new SendError(`The operator minimum is ${dust.toLocaleString('en-US')} sats; requested ${amount.toLocaleString('en-US')} sats.`);
 if(amount>total)throw new SendError(`Insufficient eligible spendable funds: ${total.toLocaleString('en-US')} sats available; ${amount.toLocaleString('en-US')} sats required. Total balance may include ineligible outputs.`);
 const change=total-amount;
 if(change>0&&change<dust)throw new SendError('The remaining change is below the minimum. Use Max or a smaller amount.');
 return {amountSats:amount,changeSats:change,maxSats:total};
}
export function assertSendQuote(reviewed:BisSendQuote,fresh:BisSendQuote,now=Date.now()) {
 if(reviewed.expiresAt<=now||(['profileId','recipient','amountSats','feeSats','totalSats','maxSats','fingerprint'] as const).some(k=>reviewed[k]!==fresh[k]))throw new SendError('Send details changed. Review again.');
}
export function validateSendRecord(r:SendRecord):SendRecord {
 const q=r?.quote;
 if(!r||Object.keys(r).some(k=>!['version','id','profileId','status','transactionId','quote','inputs','recipientScript','network','change'].includes(k))||r.version!==1||!r.id||typeof r.id!=='string'||typeof r.profileId!=='string'||!r.profileId||!['pending','succeeded'].includes(r.status)||!hash(r.transactionId)||!q||Object.keys(q).some(k=>!['id','profileId','recipient','amountSats','feeSats','totalSats','maxSats','expiresAt','fingerprint'].includes(k))||typeof q.id!=='string'||!q.id||q.profileId!==r.profileId||typeof q.recipient!=='string'||!q.recipient.startsWith('tark1')||q.recipient.length>300||!hash(q.fingerprint)||![q.amountSats,q.feeSats,q.totalSats,q.maxSats,q.expiresAt].every(natural)||q.amountSats<=0||q.totalSats!==q.amountSats+q.feeSats||q.totalSats>q.maxSats||!Array.isArray(r.inputs)||!r.inputs.length||r.inputs.some(i=>!hash(i.txid)||!natural(i.vout)||Object.keys(i).some(k=>!['txid','vout'].includes(k)))||new Set(r.inputs.map(i=>`${i.txid}:${i.vout}`)).size!==r.inputs.length||!/^5120[a-f0-9]{64}$/.test(r.recipientScript))throw new SendError('Send recovery data is invalid. Spending and account clearing remain blocked.');
 const change=r.change;
 if(r.network!==undefined&&!['signet','mutinynet'].includes(r.network))throw new SendError('Send recovery data is invalid. Spending and account clearing remain blocked.');
 if(change && (Object.keys(change).some(k=>!['script','sats','assets'].includes(k))||!/^5120[a-f0-9]{64}$/.test(change.script)||!natural(change.sats)||change.sats<=0||change.sats!==q.maxSats-q.totalSats||!Array.isArray(change.assets)||!change.assets.length||change.assets.some(a=>Object.keys(a).some(k=>!['assetId','amount'].includes(k))||!/^[a-f0-9]{68}$/.test(a.assetId)||!/^[1-9][0-9]*$/.test(a.amount))||new Set(change.assets.map(a=>a.assetId)).size!==change.assets.length))throw new SendError('Send asset recovery data is invalid.');
 return r;
}
export function readSendRecords(profileId: string | undefined, network:TestNetwork='signet'):SendRecord[] {
 if(!profileId)return [];
 try {
  const journalKey=key(network), first=readWalletRecord(journalKey,profileId,validateSendRecord), records=first?[first]:[];
  const prefix=walletRecordKey(journalKey,profileId)+':operation:';
  for(let i=0;i<localStorage.length;i++) {
   const storageKey=localStorage.key(i);if(!storageKey?.startsWith(prefix))continue;
   const record=validateSendRecord(JSON.parse(localStorage.getItem(storageKey)!));
   if(record.profileId!==profileId||((record.network??'signet')!==network)||storageKey!==prefix+encodeURIComponent(record.id)||records.some(r=>r.id===record.id))throw Error();
   records.push(record);
  }
  return records;
 }
 catch {throw new SendError('Send recovery data is unavailable. Spending and account clearing remain blocked.');}
}
export function readSendRecord(profileId: string | undefined,id?:string,network:TestNetwork='signet'):SendRecord|undefined {
 const records=readSendRecords(profileId,network);
 return id===undefined?records.at(-1):records.find(r=>r.id===id);
}
export function writeSendRecord(record:SendRecord) {
 validateSendRecord(record);
 const network=record.network ?? 'signet', journalKey=key(network), first=readWalletRecord(journalKey,record.profileId,validateSendRecord);
 const raw=JSON.stringify(record),scopedKey=walletRecordKey(journalKey,record.profileId)+(first&&first.id!==record.id?':operation:'+encodeURIComponent(record.id):'');
 try {localStorage.setItem(scopedKey,raw);if(localStorage.getItem(scopedKey)!==raw)throw Error();}
 catch {throw new SendError('Send recovery data could not be saved.');}
}
export function assertNoPendingSend(profileId: string | undefined,network:TestNetwork='signet') {assertNoPendingContinue(profileId);if(readSendRecords(profileId,network).some(r=>r.status==='pending'))throw new SendError('A send is unresolved. Open Send and Check Status before spending or clearing this account.');}
export function completeSend(id:string,transactionId:string,profileId:string,network:TestNetwork='signet') {
 const record=readSendRecord(profileId,id,network);
 if(!record||record.id!==id||record.transactionId!==transactionId)throw new SendError('The send operation changed.');
 writeSendRecord({...record,status:'succeeded',network});
}
export function sendStatus(record:SendRecord|undefined,verification:'live'|'unavailable'='live'):BisSendStatus {
 return record?{status:record.status,transactionId:record.transactionId,amountSats:record.quote.amountSats,recipient:record.quote.recipient,verification}:{status:'idle'};
}
