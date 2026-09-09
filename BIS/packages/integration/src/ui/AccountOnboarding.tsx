import {useEffect,useState,type ReactNode} from 'react';
import type {OnboardingView,OnboardingTransaction} from '../core/onboarding-service.ts';
import {CopyableValueField} from './CopyableValueField';
import './onboarding.css';

export const onboardingLabel=(view?:OnboardingView)=>`Onboarding: ${view?.status==='complete'?'Complete':view?.status==='start'?'Start?':'Pending'}`;
const elapsed=(start:number,end:number)=>{const seconds=Math.max(0,Math.floor((end-start)/1000));return `${Math.floor(seconds/60)}m ${seconds%60}s`;};
function Stage({number,owner,title,complete,children}:{number:number;owner:'CPU'|'USER';title:string;complete:boolean;children:ReactNode}){
  return <details className={`bis-onboarding-step${complete?' bis-onboarding-complete':''}`} open>
    <summary><span>{number} · {owner}</span><strong>{title}</strong><small>{complete?'Complete':'Pending'}</small></summary>
    <div>{children}</div>
  </details>;
}
function Transactions({items}:{items:OnboardingTransaction[]}){
  if(!items.length)return <p>No matching transaction observed yet.</p>;
  return <div className="bis-onboarding-transactions">{items.map(tx=><div key={`${tx.kind}:${tx.txid}`} className="bis-onboarding-transaction">
    <span>{tx.kind==='incoming'?'Incoming Bitcoin':tx.kind==='boarding'?'Bitcoin → Arkade':'Bitcoin remainder returned'} · {tx.value.toLocaleString()} sats</span>
    <strong className={tx.confirmed?'bis-onboarding-confirmed':'bis-onboarding-unconfirmed'}>{tx.confirmed?'Confirmed':'Unconfirmed'}</strong>
    <a href={`https://mempool.space/signet/tx/${tx.txid}`} target="_blank" rel="noreferrer">{tx.txid}</a>
  </div>)}</div>;
}
export function AccountOnboarding({view}:{view?:OnboardingView}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const record=view?.record,done=view?.status==='complete',incoming=view?.transactions.filter(t=>t.kind==='incoming')??[];
  const transfer=view?.transactions.filter(t=>t.kind!=='incoming')??[];
  return <div className="bis-onboarding">
    <p role="status">{view?.detail??'Checking account readiness…'}</p>
    <p className="bis-onboarding-check">{view?.checkedAt?`Last verified ${new Date(view.checkedAt).toLocaleTimeString()}. `:''}{view?.nextCheckAt?`Next check in ${Math.max(0,Math.ceil((view.nextCheckAt-Date.now())/1000))}s.`:done?'Verification complete.':'Checking…'}</p>
    <Stage number={1} owner="CPU" title="Account ready" complete><p>Your current account is saved in this browser.</p></Stage>
    <Stage number={2} owner="USER" title="Fund the account" complete={done||!!record?.plan||incoming.length>0}>
      <CopyableValueField label="Bitcoin boarding address" value={view?.address??''} disabled={!view?.address}/>
      <a className="bis-button" href="https://www.google.com/search?q=signet+bitcoin+faucet" target="_blank" rel="noreferrer">Open faucet and fund</a>
      <p>{done?'Setup is complete. Later deposits do not restart onboarding.':'Signet test sats. Once funding is confirmed, 50% moves to Arkade automatically. The remainder returns to this Bitcoin address.'}</p>
      <small>Usually a few minutes to fund; faucet queues vary.</small>
    </Stage>
    <Stage number={3} owner="CPU" title="Confirm incoming Bitcoin" complete={done||!!record?.plan}>
      <Transactions items={incoming}/><small>Bitcoin confirmation often takes 10–60 minutes or longer. Each transaction has its own status.</small>
    </Stage>
    <Stage number={4} owner="CPU" title="Move 50% to Arkade" complete={done}>
      {record?.readyReason?<p>Already funded with spendable Arkade sats. No onboarding transfer needed.</p>:record?.plan?<><p>{record.plan.totalSats.toLocaleString()} sats frozen · {record.plan.targetSats.toLocaleString()} sats to Arkade · {record.plan.returnSats.toLocaleString()} sats returned.</p>
        <p>Boarding: {record.boarding.phase.replaceAll('-',' ')}. Return: {record.returning.phase.replaceAll('-',' ')}.</p></>:<p>Starts automatically after eligible funding is confirmed.</p>}
      {!record?.readyReason&&<><Transactions items={transfer}/><small>Two settlement rounds, usually a few minutes. Bitcoin confirmation continues separately.</small></>}
    </Stage>
    <Stage number={5} owner="CPU" title="Spendable funds ready" complete={done}>
      <p>{done?'Onboarding complete. Payments use your current available balance.':'Waiting for the exact final Arkade funds to become spendable and their onboarding holds to be released.'}</p>
      <small>No additional block wait after spendability is verified.</small>
    </Stage>
    {record&&<details className="bis-onboarding-timing"><summary>Timing and recovery details</summary>
      <p>This operation: {elapsed(record.createdAt,record.completedAt??now)} {record.completedAt?'total':'elapsed'}.</p>
      {record.plan&&(['boarding','returning'] as const).map(leg=><div key={leg}><strong>{leg==='boarding'?'Boarding':'Return'}</strong>
        <p>{record[leg].startedAt?`${elapsed(record[leg].startedAt!,record[leg].verifiedAt??now)} since submission started`:'Submission has not started.'}</p>
        {record[leg].registeredAt&&<p>Registration acknowledged {new Date(record[leg].registeredAt!).toLocaleTimeString()}.</p>}
        {record[leg].participatedAt&&<p>Participation acknowledged {new Date(record[leg].participatedAt!).toLocaleTimeString()}.</p>}
        {record[leg].finalizedAt&&<p>Settlement finalized {new Date(record[leg].finalizedAt!).toLocaleTimeString()}.</p>}
        {record[leg].verifiedAt&&<p>Spendable receipt verified {new Date(record[leg].verifiedAt!).toLocaleTimeString()}.</p>}
        {record[leg].bitcoinConfirmedAt&&<p>Bitcoin confirmation observed {new Date(record[leg].bitcoinConfirmedAt!).toLocaleTimeString()}.</p>}
        {record[leg].failureCode&&<p>Recorded recovery condition: {record[leg].failureCode!.replaceAll('-',' ')}.</p>}
        {record[leg].sdkVersion&&<p>SDK {record[leg].sdkVersion}</p>}
      </div>)}
      <p>{record.interrupted?'Recovery-inclusive measurement; excluded from uninterrupted averages.':'Measured from the saved start; in-progress time is not an average.'} One saved operation; no historical spike timings are included.</p>
      {record.plan&&<p>Completed uninterrupted samples: {record.status==='complete'&&!record.interrupted?1:0}.{record.status==='complete'&&!record.interrupted?` Average = ${elapsed(record.createdAt,record.completedAt!)} total ÷ 1 sample.`:' No uninterrupted average yet.'}</p>}
      {record.progress?.failure&&<p>Last recovery condition: {record.progress.failure.replaceAll('-',' ')}. Original submission remains protected.</p>}
    </details>}
  </div>;
}
