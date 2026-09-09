import type {OnboardingCoin, OnboardingPlan, OnboardingRecord, OnboardingScope} from './onboarding-record.ts';

/** Adapter-normalized live facts; unknown eligibility must not be normalized to false/zero. */
export type OnboardingFunding = OnboardingCoin & {confirmed: boolean; expired: boolean; reserved: boolean};
export type OnboardingSnapshot = OnboardingScope & {
  complete: boolean; unresolvedOnboarding: boolean;
  boarding: OnboardingFunding[]; spendable: OnboardingFunding[];
  bitcoinScript: string; arkadeScript: string;
  policy: {zeroFees: boolean; arkadeMinimum: number; bitcoinMinimum: number; arkadeMaximum: number; bitcoinMaximum: number};
};
export type OnboardingAssessment =
  {status:'complete'|'resume'|'reconcile'|'already-ready'|'funding-needed'|'waiting-confirmation'|'unavailable'|'unsupported'} |
  {status:'ready';plan:OnboardingPlan};
const sameScope=(a:OnboardingScope,b:OnboardingScope)=>a.profileId===b.profileId&&a.network===b.network&&a.operator===b.operator;
const safe=(n:unknown,min=0):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min;
function validCoins(coins:OnboardingFunding[]) {
  return Array.isArray(coins)&&coins.every(c=>!!c&&/^[a-f0-9]{64}$/.test(c.txid)&&safe(c.vout)&&safe(c.value,1)&&
    typeof c.confirmed==='boolean'&&typeof c.expired==='boolean'&&typeof c.reserved==='boolean')&&
    new Set(coins.map(c=>`${c.txid}:${c.vout}`)).size===coins.length&&safe(coins.reduce((s,c)=>s+c.value,0));
}
/** The record, when present, must come from the validated journal reader. No mutations. */
export function assessOnboarding(scope:OnboardingScope, snapshot:OnboardingSnapshot, record?:OnboardingRecord):OnboardingAssessment {
  if(record) {
    if(!sameScope(scope,record))return {status:'unavailable'};
    if(record.status==='complete')return {status:'complete'};
    if(record.status==='pending')return {status:'resume'};
  }
  if(!snapshot||!sameScope(scope,snapshot)||snapshot.complete!==true||!validCoins(snapshot.boarding)||!validCoins(snapshot.spendable))return {status:'unavailable'};
  if(typeof snapshot.unresolvedOnboarding!=='boolean')return {status:'unavailable'};
  if(snapshot.unresolvedOnboarding)return {status:'reconcile'};
  // The adapter supplies only freshly SDK-spendable coins; chain confirmation
  // is deliberately not an extra eligibility gate for existing Arkade funds.
  if(snapshot.spendable.some(c=>!c.expired&&!c.reserved))return {status:'already-ready'};
  const policy=snapshot.policy;
  if(!policy||typeof policy.zeroFees!=='boolean'||!safe(policy.arkadeMinimum,1)||!safe(policy.bitcoinMinimum,1)||!safe(policy.arkadeMaximum)||!safe(policy.bitcoinMaximum)||
    !/^(?:[a-f0-9]{2}){2,10000}$/.test(snapshot.bitcoinScript)||!/^(?:[a-f0-9]{2}){2,10000}$/.test(snapshot.arkadeScript))return {status:'unavailable'};
  if(!policy.zeroFees)return {status:'unsupported'};
  const inputs=snapshot.boarding.filter(c=>c.confirmed&&!c.expired&&!c.reserved)
    .map(({txid,vout,value})=>({txid,vout,value})).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const totalSats=inputs.reduce((s,c)=>s+c.value,0),targetSats=Math.floor(totalSats/2),returnSats=totalSats-targetSats;
  if(!totalSats)return {status:snapshot.boarding.some(c=>!c.confirmed&&!c.expired&&!c.reserved)?'waiting-confirmation':'funding-needed'};
  if(targetSats<policy.arkadeMinimum||returnSats<policy.bitcoinMinimum)return {status:'funding-needed'};
  if(policy.arkadeMaximum>0&&totalSats>policy.arkadeMaximum||policy.bitcoinMaximum>0&&returnSats>policy.bitcoinMaximum)return {status:'unsupported'};
  return {status:'ready',plan:{inputs,totalSats,targetSats,returnSats,bitcoinScript:snapshot.bitcoinScript,arkadeScript:snapshot.arkadeScript}};
}
