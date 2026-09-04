import type { BoardingQuote } from './boarding-quote.ts';

export type BoardingRecord = {
  version: 1; id: string; profileId: string;
  status: 'pending' | 'succeeded' | 'not-submitted';
  phase?: 'prepared' | 'submitting' | 'registered';
  quote: BoardingQuote; inputs: {txid:string;vout:number}[];
  bitcoinAddress: string; intentId?: string; commitmentTxid?: string;
  diagnostic?: 'registration-unconfirmed' | 'settlement-interrupted' | 'deadline-exceeded';
};
const key = 'bis-signet-boarding-operation-v1';
const txid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
export class BoardingBlockedError extends Error {}
function validate(r: BoardingRecord): BoardingRecord {
  const q=r?.quote;
  const amounts=q && [q.amountSats,q.feeSats,q.netSats,q.maxSats,q.bitcoinAfterSats,q.arkadeAfterSats,q.totalAfterSats,q.expiresAt];
  if (!r || r.version!==1 || typeof r.id!=='string' || !r.id || typeof r.profileId!=='string' || !r.profileId ||
      !['pending','succeeded','not-submitted'].includes(r.status) ||
      (r.phase!==undefined && !['prepared','submitting','registered'].includes(r.phase)) ||
      !Array.isArray(r.inputs) || !r.inputs.length || r.inputs.some(i=>!txid(i.txid)||!Number.isSafeInteger(i.vout)||i.vout<0) ||
      new Set(r.inputs.map(i=>`${i.txid}:${i.vout}`)).size!==r.inputs.length ||
      typeof r.bitcoinAddress!=='string' || !r.bitcoinAddress.startsWith('tb1') ||
      !q || q.profileId!==r.profileId || !['to-arkade','to-bitcoin'].includes(q.direction) || !txid(q.fingerprint) ||
      !amounts?.every(n=>Number.isSafeInteger(n)&&n>=0) || q.amountSats<=0 || q.netSats<=0 || q.amountSats>q.maxSats ||
      q.totalAfterSats!==q.bitcoinAfterSats+q.arkadeAfterSats ||
      (r.intentId!==undefined && (typeof r.intentId!=='string'||!r.intentId)) ||
      (r.commitmentTxid!==undefined && !txid(r.commitmentTxid)) ||
      (r.diagnostic!==undefined && !['registration-unconfirmed','settlement-interrupted','deadline-exceeded'].includes(r.diagnostic)) ||
      (r.status==='succeeded' && !r.commitmentTxid) ||
      (r.status==='not-submitted' && r.phase!=='prepared')) throw new BoardingBlockedError('Transfer state needs recovery. Account clearing and transfers are blocked.');
  return r;
}
export function readBoardingRecord(): BoardingRecord | undefined {
  if (!globalThis.localStorage) throw new BoardingBlockedError('Transfer storage is unavailable.');
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try { return validate(JSON.parse(raw)); }
  catch { throw new BoardingBlockedError('Transfer state needs recovery. Account clearing and transfers are blocked.'); }
}
export function writeBoardingRecord(record: BoardingRecord) {
  validate(record);
  const raw=JSON.stringify(record);
  localStorage.setItem(key,raw);
  if (localStorage.getItem(key)!==raw) throw new BoardingBlockedError('Transfer state could not be saved.');
}
// Every caller performing reconciliation or clearing must hold this lock too.
export function withWalletMutation<T>(work:()=>Promise<T>):Promise<T> {
  if (!globalThis.navigator?.locks) return Promise.reject(Error('This browser cannot safely coordinate wallet transfers.'));
  return navigator.locks.request('bis-signet-wallet-mutation', {ifAvailable:true}, lock=> {
    if(!lock)throw new BoardingBlockedError('Another wallet operation is in progress.');
    return work();
  });
}
export function assertNoPendingBoarding() {
  if(readBoardingRecord()?.status==='pending')throw new BoardingBlockedError('A transfer is unresolved. Open Account Transfer and check its status before starting another transfer or clearing this account.');
}
export function updateBoardingRecord(id:string, patch:Partial<BoardingRecord>) {
  const record=readBoardingRecord();
  if (!record || record.id!==id || record.status!=='pending') throw new BoardingBlockedError('The transfer operation changed.');
  const next={...record,...patch};writeBoardingRecord(next);return next;
}
// Safe only while holding the mutation lock: no active attempt can register.
export function recoverPreparedBoarding(record:BoardingRecord) {
  return record.status==='pending' && record.phase==='prepared'
    ? updateBoardingRecord(record.id,{status:'not-submitted'}) : record;
}
// The provider wrapper calls beforeRegister synchronously immediately before its
// network call. A durable submitting marker is required, even if response is lost.
export function createBoardingAttempt(id:string, isCurrent:()=>boolean, deadline:number, now=Date.now) {
  let open=true;
  return {
    beforeRegister() {
      const record=readBoardingRecord();
      if(!open || !isCurrent() || now()>=deadline || record?.id!==id || record.status!=='pending' || record.phase!=='prepared') throw Error('Transfer details changed. Review again.');
      updateBoardingRecord(id,{phase:'submitting'});
    },
    registered(intentId:string) {updateBoardingRecord(id,{phase:'registered',intentId});},
    committed(commitmentTxid:string) {
      const record=readBoardingRecord();
      if(record?.id===id && record.status==='pending')updateBoardingRecord(id,{commitmentTxid});
    },
    interrupted(diagnostic:NonNullable<BoardingRecord['diagnostic']>) {
      const record=readBoardingRecord();
      if(record?.id===id && record.status==='pending')updateBoardingRecord(id,{diagnostic});
    },
    close() {
      open=false;
      const record=readBoardingRecord();
      if(record?.id===id)recoverPreparedBoarding(record);
    },
  };
}

