/** Public checkpoints only. Callers must hold the account mutation lock when writing. */
export const onboardingPrefix = 'bis-signet-onboarding-v1';
export type OnboardingScope = {profileId: string; network: 'signet'; operator: string};
export type OnboardingCoin = {txid: string; vout: number; value: number};
export type OnboardingOutput = {network: 'bitcoin' | 'arkade'; script: string; value: number};
export type OnboardingLeg = {
  phase: 'unprepared' | 'prepared' | 'submitting' | 'registered' | 'receipt-verified';
  attemptId?: string; intentId?: string; commitmentTxid?: string;
  sdkVersion?:string; failureCode?:'duplicate-input'|'operator-policy'|'registration-unknown'|'batch-failed'|'deadline'|'connection'|'validation'|'storage';
  inputs: OnboardingCoin[]; outputs: OnboardingOutput[]; receipts?: OnboardingCoin[];
  startedAt?: number; registeredAt?: number; participatedAt?:number; finalizedAt?:number; verifiedAt?: number; bitcoinConfirmedAt?:number;
};
export type OnboardingProgress = {stage:'preparing'|'registered'|'participating'|'signing'|'broadcast'|'checking'|'complete';at:number; failure?:'connection'|'registration-unknown'|'batch-failed'|'deadline'|'validation'|'storage';retryAt?:number;failures?:number};
export type OnboardingPlan = {
  inputs: OnboardingCoin[]; totalSats: number; targetSats: number; returnSats: number;
  bitcoinScript: string; arkadeScript: string;
};
type Base = OnboardingScope & {version: 1; id: string; revision: number; createdAt: number; allocationPercent: 50; progress?:OnboardingProgress; independent?:OnboardingCoin[]; interrupted?:boolean};
export type OnboardingRecord = Base & (
  {status: 'pending' | 'not-submitted' | 'complete'; plan: OnboardingPlan; boarding: OnboardingLeg; returning: OnboardingLeg; completedAt?: number; readyReason?: never} |
  {status: 'complete'; readyReason: 'existing-funds'; completedAt: number; plan?: never; boarding?: never; returning?: never}
);
export type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem'>;
export class OnboardingRecordError extends Error {}
const invalid = (): never => {throw new OnboardingRecordError('Onboarding state needs recovery. Saved funds remain protected.');};
const integer = (n: unknown, min = 0): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min;
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,256}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const script = (v: unknown): v is string => typeof v === 'string' && /^(?:[a-f0-9]{2}){2,10000}$/.test(v);
function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) invalid();
}
function validScope(scope: OnboardingScope) {
  if (!identifier(scope?.profileId) || scope.network !== 'signet') throw new OnboardingRecordError('Invalid onboarding scope.');
  try {
    const url = new URL(scope.operator);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.origin !== scope.operator) throw Error();
  } catch {throw new OnboardingRecordError('Invalid onboarding scope.');}
}
export function onboardingKey(scope: OnboardingScope) {
  validScope(scope);
  return `${onboardingPrefix}:${encodeURIComponent(scope.profileId)}:${scope.network}:${encodeURIComponent(scope.operator)}`;
}
function coins(value: unknown, allowEmpty = false): OnboardingCoin[] {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) invalid();
  const parsed = (value as unknown[]).map(c => {
    keys(c, ['txid','vout','value']);
    if (!hash(c.txid) || !integer(c.vout) || !integer(c.value,1)) invalid();
    return {txid: c.txid as string, vout: c.vout as number, value: c.value as number};
  });
  if (new Set(parsed.map(c => `${c.txid}:${c.vout}`)).size !== parsed.length) invalid();
  total(parsed);
  return parsed;
}
function total(items: {value: number}[]) {
  const sum = items.reduce((s,c) => s+c.value,0);
  if (!integer(sum)) invalid();
  return sum;
}
function sameCoins(a: OnboardingCoin[], b: OnboardingCoin[]) {
  return a.length === b.length && a.every(c => b.some(d => c.txid === d.txid && c.vout === d.vout && c.value === d.value));
}
function leg(value: unknown): OnboardingLeg {
  keys(value, ['phase','attemptId','intentId','commitmentTxid','inputs','outputs','receipts','startedAt','registeredAt','participatedAt','finalizedAt','verifiedAt','bitcoinConfirmedAt','sdkVersion','failureCode']);
  if(value.sdkVersion!==undefined&&(typeof value.sdkVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(value.sdkVersion)))invalid();
  if(value.failureCode!==undefined&&!['duplicate-input','operator-policy','registration-unknown','batch-failed','deadline','connection','validation','storage'].includes(value.failureCode as string))invalid();
  for(const k of ['startedAt','registeredAt','participatedAt','finalizedAt','verifiedAt','bitcoinConfirmedAt'])if(value[k]!==undefined&&!integer(value[k]))invalid();
  if (!['unprepared','prepared','submitting','registered','receipt-verified'].includes(value.phase as string)) invalid();
  for (const k of ['attemptId','intentId']) if (value[k] !== undefined && !identifier(value[k])) invalid();
  if (value.commitmentTxid !== undefined && !hash(value.commitmentTxid)) invalid();
  const inputs = coins(value.inputs,value.phase === 'unprepared');
  if (!Array.isArray(value.outputs) || !value.outputs.length) invalid();
  const outputs = (value.outputs as unknown[]).map(o => {
    keys(o,['network','script','value']);
    if (!['bitcoin','arkade'].includes(o.network as string) || !script(o.script) || !integer(o.value,1)) invalid();
    return o as OnboardingOutput;
  });
  total(outputs);
  if (value.phase !== 'unprepared' && (!value.attemptId || total(inputs) !== total(outputs))) invalid();
  if (value.phase === 'unprepared' && (inputs.length || value.attemptId || value.intentId || value.commitmentTxid || value.receipts)) invalid();
  if (value.phase === 'registered' && !value.intentId) invalid();
  if (value.phase === 'receipt-verified' && (!value.commitmentTxid || !value.receipts)) invalid();
  if (value.receipts !== undefined) coins(value.receipts);
  return value as OnboardingLeg;
}
function validate(scope: OnboardingScope, value: unknown): OnboardingRecord {
  keys(value,['version','id','profileId','network','operator','revision','createdAt','status','allocationPercent','plan','boarding','returning','completedAt','readyReason','progress','independent','interrupted']);
  if(value.independent!==undefined)coins(value.independent,true);
  if(value.interrupted!==undefined&&typeof value.interrupted!=='boolean')invalid();
  if(value.progress!==undefined){const p=value.progress;keys(p,['stage','at','failure','retryAt','failures']);if(!['preparing','registered','participating','signing','broadcast','checking','complete'].includes(p.stage as string)||!integer(p.at)||p.failure!==undefined&&!['connection','registration-unknown','batch-failed','deadline','validation','storage'].includes(p.failure as string)||p.retryAt!==undefined&&!integer(p.retryAt)||p.failures!==undefined&&!integer(p.failures))invalid();}
  if (value.version !== 1 || !identifier(value.id) || value.profileId !== scope.profileId || value.network !== scope.network || value.operator !== scope.operator ||
      !integer(value.revision,1) || !integer(value.createdAt) || value.allocationPercent !== 50 || !['pending','complete','not-submitted'].includes(value.status as string)) invalid();
  if (value.completedAt !== undefined && (!integer(value.completedAt) || (value.completedAt as number) < (value.createdAt as number))) invalid();
  if (value.status === 'complete' ? value.completedAt === undefined : value.completedAt !== undefined) invalid();
  if (value.readyReason !== undefined) {
    if (value.readyReason !== 'existing-funds' || value.status !== 'complete' || value.plan !== undefined || value.boarding !== undefined || value.returning !== undefined) invalid();
  } else {
    const p = value.plan;
    keys(p,['inputs','totalSats','targetSats','returnSats','bitcoinScript','arkadeScript']);
    const inputs = coins(p.inputs);
    if (!integer(p.totalSats,2) || !integer(p.targetSats,1) || !integer(p.returnSats,1) || total(inputs) !== p.totalSats ||
        p.targetSats !== Math.floor((p.totalSats as number)/2) || (p.targetSats as number)+(p.returnSats as number) !== p.totalSats || !script(p.bitcoinScript) || !script(p.arkadeScript)) invalid();
    const board=leg(value.boarding), returning=leg(value.returning);
    if (board.phase === 'unprepared' || !sameCoins(board.inputs,inputs) || board.outputs.length !== 1 ||
        board.outputs[0].network !== 'arkade' || board.outputs[0].script !== p.arkadeScript || board.outputs[0].value !== p.totalSats) invalid();
    if (returning.outputs.length !== 2 || !returning.outputs.some(o => o.network === 'bitcoin' && o.script === p.bitcoinScript && o.value === p.returnSats) ||
        !returning.outputs.some(o => o.network === 'arkade' && o.script === p.arkadeScript && o.value === p.targetSats)) invalid();
    if (board.receipts && total(board.receipts) !== p.totalSats) invalid();
    if (returning.phase !== 'unprepared' && (board.phase !== 'receipt-verified' || !board.receipts || !sameCoins(returning.inputs,board.receipts))) invalid();
    if (returning.receipts && total(returning.receipts) !== p.targetSats) invalid();
    if (value.status === 'complete' && returning.phase !== 'receipt-verified') invalid();
    if (value.status === 'not-submitted' && (board.phase !== 'prepared' || board.intentId || board.commitmentTxid || board.receipts || returning.phase !== 'unprepared')) invalid();
  }
  // Return a detached copy, preventing caller changes from mutating the checkpoint.
  return JSON.parse(JSON.stringify(value)) as OnboardingRecord;
}
export function readOnboardingRecord(scope: OnboardingScope, storage: Pick<OnboardingStorage,'getItem'> = localStorage): OnboardingRecord | undefined {
  const key=onboardingKey(scope);
  try {
    const raw=storage.getItem(key);
    return raw === null ? undefined : validate(scope,JSON.parse(raw));
  } catch {return invalid();}
}
/** Optimistic revision check supplements, but never replaces, the mutation lock. */
export function writeOnboardingRecord(scope: OnboardingScope, record: OnboardingRecord, expectedRevision: number, storage: OnboardingStorage = localStorage): OnboardingRecord {
  const key=onboardingKey(scope), next=validate(scope,record);
  const previous=readOnboardingRecord(scope,storage);
  if ((previous?.revision ?? 0) !== expectedRevision) throw new OnboardingRecordError('Onboarding checkpoint changed. Reconcile before writing.');
  if (!integer(expectedRevision) || next.revision !== expectedRevision+1) throw new OnboardingRecordError('Invalid onboarding revision.');
  if (previous && previous.status!=='not-submitted' && (next.id !== previous.id || next.createdAt !== previous.createdAt || JSON.stringify(next.plan) !== JSON.stringify(previous.plan))) invalid();
  if(previous?.status==='complete'){
    const withoutConfirmation=(r:OnboardingRecord)=>{const copy=JSON.parse(JSON.stringify(r));delete copy.revision;if(copy.boarding)delete copy.boarding.bitcoinConfirmedAt;if(copy.returning)delete copy.returning.bitcoinConfirmedAt;return JSON.stringify(copy);};
    if(withoutConfirmation(previous)!==withoutConfirmation(next))invalid();
  }
  if(previous?.plan&&next.plan&&previous.id===next.id){
    const phases=['unprepared','prepared','submitting','registered','receipt-verified'];
    for(const name of ['boarding','returning'] as const){
      const before=previous[name],after=next[name];
      if(phases.indexOf(after.phase)<phases.indexOf(before.phase))invalid();
      for(const key of ['attemptId','intentId','commitmentTxid','startedAt','registeredAt','participatedAt','finalizedAt','verifiedAt','bitcoinConfirmedAt','receipts'] as const)
        if(before[key]!==undefined&&JSON.stringify(before[key])!==JSON.stringify(after[key]))invalid();
      if(before.phase!=='unprepared'&&!sameCoins(before.inputs,after.inputs))invalid();
    }
  }
  const raw=JSON.stringify(next);
  try {
    if(previous?.status==='not-submitted'&&previous.id!==next.id){const archive=key+':archive:'+encodeURIComponent(previous.id),saved=JSON.stringify(previous);storage.setItem(archive,saved);if(storage.getItem(archive)!==saved)throw Error();}
    storage.setItem(key,raw);
    if (storage.getItem(key) !== raw) throw Error();
  } catch {throw new OnboardingRecordError('Onboarding checkpoint could not be saved. Funds remain protected.');}
  return next;
}
export function readAccountOnboarding(profileId:string):OnboardingRecord[]{
  const prefix=`${onboardingPrefix}:${encodeURIComponent(profileId)}:`;const result:OnboardingRecord[]=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix)||key.includes(':archive:'))continue;try{const r=JSON.parse(localStorage.getItem(key)!);if(r.profileId!==profileId||onboardingKey(r)!==key)invalid();result.push(validate(r,r));}catch{invalid();}}
  return result;
}
