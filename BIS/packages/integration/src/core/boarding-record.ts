import {readWalletRecord, walletRecordKey} from './wallet-record.ts';
import { withBrowserMutation } from './logout-cleanup.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { validBoardingAssetChange, type BoardingAssetChange } from './boarding-assets.ts';

export type BoardingRecord = {
  version: 1; id: string; profileId: string;
  status: 'pending' | 'succeeded' | 'not-submitted';
  phase?: 'prepared' | 'submitting' | 'registered';
  quote: BoardingQuote; inputs: {txid:string;vout:number}[];
  bitcoinAddress: string; intentId?: string; commitmentTxid?: string;
  assetChange?: BoardingAssetChange;
  createdAt?: number;
  failure?: BoardingFailure;
  progress?: {stage:BoardingStage;observedAt:number;execution:'running'|'awaiting-confirmation'|'interrupted';action?:BoardingAction};
  diagnostic?: 'registration-unconfirmed' | 'settlement-interrupted' | 'deadline-exceeded' | 'response-mismatch' | 'event-stream-closed' | 'batch-failed';
};
export const boardingStages=['registered','batch-selected','signing','signatures-submitted','broadcast','confirmed'] as const;
export type BoardingStage=typeof boardingStages[number];
export const boardingActions=['confirm-registration','tree-nonces','tree-signatures','forfeit-signatures','event-stream','settlement','validate-tree','validate-finalization'] as const;
export type BoardingAction=typeof boardingActions[number];
export const boardingFailureLabels={
  unknown:'Unclassified settlement error',
  'response-mismatch':'SDK rejected a mismatching operator response',
  'event-stream-closed':'Settlement event stream closed',
  'sweep-root-missing':'Sweep tree initialization missing',
  'vtxo-tree-missing':'VTXO tree initialization missing',
  'shared-output-missing':'Shared commitment output missing',
  'nonce-state-missing':'Signing nonce state missing',
  'asset-destination-missing':'Owned asset destination missing',
  'asset-output-missing':'Asset allocation does not match the Arkade change output index',
} as const;
export type BoardingFailure={code:keyof typeof boardingFailureLabels;observedAt:number;stage?:BoardingStage;action?:BoardingAction;sdkVersion?:string;batchId?:string;endReason?:BoardingRecord['diagnostic']};
/** Diagnostic payloads are optional. Discard malformed detail, never the reservation. */
export function publicBoardingFailure(value:unknown):BoardingFailure|undefined {
  if(!value||typeof value!=='object')return;
  const f=value as BoardingFailure;
  if(!Object.hasOwn(boardingFailureLabels,f.code)||!Number.isSafeInteger(f.observedAt)||f.observedAt<0||
    (f.stage!==undefined&&!boardingStages.includes(f.stage))||(f.action!==undefined&&!boardingActions.includes(f.action))||
    (f.sdkVersion!==undefined&&(typeof f.sdkVersion!=='string'||!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(f.sdkVersion)))||
    (f.batchId!==undefined&&(typeof f.batchId!=='string'||!/^([a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(f.batchId)))||
    (f.endReason!==undefined&&!['registration-unconfirmed','settlement-interrupted','deadline-exceeded','response-mismatch','event-stream-closed','batch-failed'].includes(f.endReason)))return;
  return {code:f.code,observedAt:f.observedAt,...(f.stage?{stage:f.stage}:{}),...(f.action?{action:f.action}:{}),...(f.sdkVersion?{sdkVersion:f.sdkVersion}:{}),...(f.batchId?{batchId:f.batchId}:{}),...(f.endReason?{endReason:f.endReason}:{})};
}
function failureCode(error:unknown):BoardingFailure['code'] {
  // Never retain messages, causes, stacks or arbitrary provider fields.
  try {
    if(!(error instanceof Error))return 'unknown';
    if(error.name==='ServerResponseMismatchError')return /^asset output not found in asset group [a-f0-9]{68} at index [0-9]{1,10}$/.test(error.message)?'asset-output-missing':'response-mismatch';
    switch(error.message) {
      case 'event stream closed':return 'event-stream-closed';
      case 'Sweep tap tree root not set':return 'sweep-root-missing';
      case 'vtxo tree not initialized':return 'vtxo-tree-missing';
      case 'Shared output not found':return 'shared-output-missing';
      case 'nonces not set':case 'nonces not generated':case 'missing private nonce':case 'missing aggregate nonce':return 'nonce-state-missing';
      case 'Cannot assign assets: no output matches the destination address':return 'asset-destination-missing';
    }
  } catch { /* Even an error accessor can throw. */ }
  return 'unknown';
}
const key = 'bis-signet-boarding-operation-v1';
const txid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
export class BoardingBlockedError extends Error {}
export class PendingTransferConfirmationError extends BoardingBlockedError {}
export function assertPendingTransfersAcknowledged(profileId:string|undefined, acknowledged:readonly string[]=[]) {
  const pending=readBoardingRecords(profileId).filter(r=>r.status==='pending');
  if(pending.some(r=>!acknowledged.includes(r.id)))throw new PendingTransferConfirmationError('Pending transfers changed. Confirm whether you want to send another.');
}
function validate(r: BoardingRecord): BoardingRecord {
  const q=r?.quote;
  const amounts=q && [q.amountSats,q.feeSats,q.netSats,q.maxSats,q.bitcoinAfterSats,q.arkadeAfterSats,q.totalAfterSats,q.expiresAt];
  if (!r || r.version!==1 || typeof r.id!=='string' || !r.id || typeof r.profileId!=='string' || !r.profileId ||
      !['pending','succeeded','not-submitted'].includes(r.status) ||
      (r.createdAt!==undefined && (!Number.isSafeInteger(r.createdAt)||r.createdAt<0)) ||
      (r.progress!==undefined && (!boardingStages.includes(r.progress.stage)||!Number.isSafeInteger(r.progress.observedAt)||r.progress.observedAt<0||!['running','awaiting-confirmation','interrupted'].includes(r.progress.execution)||(r.progress.action!==undefined&&!boardingActions.includes(r.progress.action)))) ||
      (r.phase!==undefined && !['prepared','submitting','registered'].includes(r.phase)) ||
      !Array.isArray(r.inputs) || !r.inputs.length || r.inputs.some(i=>!txid(i.txid)||!Number.isSafeInteger(i.vout)||i.vout<0) ||
      new Set(r.inputs.map(i=>`${i.txid}:${i.vout}`)).size!==r.inputs.length ||
      typeof r.bitcoinAddress!=='string' || !r.bitcoinAddress.startsWith('tb1') ||
      !q || q.profileId!==r.profileId || !['to-arkade','to-bitcoin'].includes(q.direction) || !txid(q.fingerprint) ||
      !amounts?.every(n=>Number.isSafeInteger(n)&&n>=0) || q.amountSats<=0 || q.netSats<=0 || q.amountSats>q.maxSats ||
      (q.inputSats!==undefined && (!Number.isSafeInteger(q.inputSats)||q.inputSats<q.maxSats)) ||
      (r.assetChange!==undefined && (q.direction!=='to-bitcoin'||!validBoardingAssetChange(r.assetChange,q.inputSats??q.maxSats,q.amountSats))) ||
      ((q.inputSats??q.maxSats)>q.maxSats && !r.assetChange) ||
      q.totalAfterSats!==q.bitcoinAfterSats+q.arkadeAfterSats ||
      (r.intentId!==undefined && (typeof r.intentId!=='string'||!r.intentId)) ||
      (r.commitmentTxid!==undefined && !txid(r.commitmentTxid)) ||
      (r.diagnostic!==undefined && !['registration-unconfirmed','settlement-interrupted','deadline-exceeded','response-mismatch','event-stream-closed','batch-failed'].includes(r.diagnostic)) ||
      (r.status==='succeeded' && !r.commitmentTxid) ||
      (r.status==='not-submitted' && r.phase!=='prepared')) throw new BoardingBlockedError('Transfer state needs recovery. Account clearing and transfers are blocked.');
  const {failure:rawFailure,...record}=r;
  const failure=publicBoardingFailure(rawFailure);
  return failure?{...record,failure}:record;
}
export function readBoardingRecords(profileId: string | undefined): BoardingRecord[] {
  if(!profileId)return [];
  try {
    const first=readWalletRecord(key,profileId,validate);
    const records=first?[first]:[];
    const prefix=`${walletRecordKey(key,profileId)}:operation:`;
    for(let i=0;i<localStorage.length;i++) {
      const entry=localStorage.key(i);
      if(!entry?.startsWith(prefix))continue;
      const record=validate(JSON.parse(localStorage.getItem(entry)!));
      if(record.profileId!==profileId||entry!==prefix+encodeURIComponent(record.id)||records.some(r=>r.id===record.id))throw Error('Invalid transfer owner or ID.');
      records.push(record);
    }
    return records.sort((a,b)=>(a.createdAt??0)-(b.createdAt??0));
  }
  catch { throw new BoardingBlockedError('Transfer state needs recovery. Account clearing and transfers are blocked.'); }
}
export function readBoardingRecord(profileId: string | undefined,id?:string): BoardingRecord | undefined {
  const records=readBoardingRecords(profileId);
  return id===undefined?records.at(-1):records.find(r=>r.id===id);
}
export function writeBoardingRecord(record: BoardingRecord) {
  const raw=JSON.stringify(validate(record));
  const first=readWalletRecord(key,record.profileId,validate);
  const scopedKey=walletRecordKey(key,record.profileId)+(first&&first.id!==record.id?`:operation:${encodeURIComponent(record.id)}`:'');
  localStorage.setItem(scopedKey,raw);
  if (localStorage.getItem(scopedKey)!==raw) throw new BoardingBlockedError('Transfer state could not be saved.');
}
// Every caller performing reconciliation or clearing must hold this lock too.
export function withWalletMutation<T>(work:()=>Promise<T>, profileId: string | undefined):Promise<T> {
  if (!globalThis.navigator?.locks) return Promise.reject(Error('This browser cannot safely coordinate wallet transfers.'));
  return withBrowserMutation(() => navigator.locks.request(`bis-signet-wallet-mutation:${encodeURIComponent(profileId ?? 'no-account')}`, {ifAvailable:true}, lock=> {
    if(!lock)throw new BoardingBlockedError('Another wallet operation is in progress.');
    return work();
  }));
}
export function assertNoPendingBoarding(profileId: string | undefined) {
  if(readBoardingRecords(profileId).some(r=>r.status==='pending'))throw new BoardingBlockedError('A transfer is unresolved. Open Account Transfer and check its status before clearing this account or using these funds.');
}
export function updateBoardingRecord(id:string, patch:Partial<BoardingRecord>, profileId: string) {
  const record=readBoardingRecord(profileId,id);
  if (!record || record.id!==id || record.status!=='pending') throw new BoardingBlockedError('The transfer operation changed.');
  const next={...record,...patch};writeBoardingRecord(next);return next;
}
export function recordBoardingProgress(profileId:string,id:string,stage:BoardingStage,execution:NonNullable<BoardingRecord['progress']>['execution']='running',action?:BoardingAction,now=Date.now()) {
  const record=readBoardingRecord(profileId,id);
  if(!record||record.status!=='pending')return record;
  const previous=record.progress;
  if(previous && boardingStages.indexOf(previous.stage)>boardingStages.indexOf(stage))return record;
  return updateBoardingRecord(id,{progress:{stage,execution,observedAt:Math.max(previous?.observedAt??0,now),...(action?{action}:{})}},profileId);
}
export async function withBoardingRecordLock<T>(profileId:string,id:string,work:()=>T|Promise<T>):Promise<T> {
  if(!globalThis.navigator?.locks)return work();
  return navigator.locks.request(`bis-signet-transfer-record:${encodeURIComponent(profileId)}:${encodeURIComponent(id)}`,{},work);
}
// Safe only while holding the mutation lock: no active attempt can register.
export function recoverPreparedBoarding(record:BoardingRecord) {
  return record.status==='pending' && record.phase==='prepared'
    ? updateBoardingRecord(record.id,{status:'not-submitted'},record.profileId) : record;
}
// The provider wrapper calls beforeRegister synchronously immediately before its
// network call. A durable submitting marker is required, even if response is lost.
export function createBoardingAttempt(id:string, isCurrent:()=>boolean, deadline:number, profileId: string, now=Date.now) {
  let open=true;
  return {
    beforeRegister() {
      const record=readBoardingRecord(profileId,id);
      if(!open || !isCurrent() || now()>=deadline || record?.id!==id || record.status!=='pending' || record.phase!=='prepared') throw Error('Transfer details changed. Review again.');
      updateBoardingRecord(id,{phase:'submitting'},profileId);
    },
    registered(intentId:string) {updateBoardingRecord(id,{phase:'registered',intentId},profileId);recordBoardingProgress(profileId,id,'registered','running',undefined,now());},
    committed(commitmentTxid:string) {
      const record=readBoardingRecord(profileId,id);
      if(record?.id===id && record.status==='pending'){updateBoardingRecord(id,{commitmentTxid},profileId);recordBoardingProgress(profileId,id,'broadcast','awaiting-confirmation',undefined,now());}
    },
    interrupted(diagnostic:NonNullable<BoardingRecord['diagnostic']>,error?:unknown,metadata:{sdkVersion?:string;batchId?:string}={}) {
      const record=readBoardingRecord(profileId,id);
      if(record?.id===id && record.status==='pending'){
        const detail={code:failureCode(error),observedAt:now(),endReason:diagnostic,...(record.progress?.stage?{stage:record.progress.stage}:{}),...(record.progress?.action?{action:record.progress.action}:{})};
        const failure=error===undefined?record.failure:publicBoardingFailure({...detail,...metadata})??publicBoardingFailure(detail);
        updateBoardingRecord(id,{diagnostic,...(failure?{failure}:{})},profileId);
        if(record.phase==='registered'&&record.progress?.stage!=='broadcast'&&record.progress?.stage!=='confirmed')recordBoardingProgress(profileId,id,record.progress?.stage??'registered','interrupted',record.progress?.action,now());
      }
    },
    close() {
      open=false;
      const record=readBoardingRecord(profileId,id);
      if(record?.id===id)recoverPreparedBoarding(record);
    },
  };
}

