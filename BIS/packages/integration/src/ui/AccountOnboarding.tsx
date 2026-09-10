import {type ReactNode} from 'react';
import type {OnboardingView,OnboardingTransaction} from '../core/onboarding-service.ts';
import {CopyableValueField} from './CopyableValueField';
import './onboarding.css';

export const onboardingLabel=(view?:OnboardingView)=>`Onboarding: ${view?.status==='complete'?'Complete':view?.status==='start'?'Start?':'Pending'}`;
type StageStatus='complete'|'pending'|'unstarted';
const stageLabel=(status:StageStatus)=>status==='complete'?'Complete':status==='pending'?'Pending':'Unstarted';
function Stage({number,owner,title,status,children}:{number:number;owner:'CPU'|'USER';title:string;status:StageStatus;children:ReactNode}){
  return <details className={`bis-onboarding-step bis-onboarding-${status}`}>
    <summary><span>{number} · {owner}</span><strong>{title}</strong><small>{stageLabel(status)}</small></summary>
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
  const record=view?.record,done=view?.status==='complete'||record?.status==='complete',incoming=view?.transactions.filter(t=>t.kind==='incoming')??[];
  const transfer=view?.transactions.filter(t=>t.kind!=='incoming')??[];
  const completed=done?5:record?.plan?(record.returning.phase==='receipt-verified'?4:3):incoming.length?2:1;
  const stages:StageStatus[]=[1,2,3,4,5].map(number=>number<=completed?'complete':number===completed+1?'pending':'unstarted');
  return <div className="bis-onboarding">
    <p>You must fund the account per step 2. Otherwise sit back and wait for completion.</p>
    <Stage number={1} owner="CPU" title="Account ready" status={stages[0]}><p>Your current account is saved in this browser.</p></Stage>
    <Stage number={2} owner="USER" title="Fund the account" status={stages[1]}>
      <CopyableValueField label="Bitcoin boarding address" value={view?.address??''} disabled={!view?.address}/>
      <a className="bis-button" href="https://www.google.com/search?q=signet+bitcoin+faucet" target="_blank" rel="noreferrer">Open faucet and fund</a>
      <p>{done?'Setup is complete. Later deposits do not restart onboarding.':'Signet test sats. Once funding is confirmed, 50% moves to Arkade automatically. The remainder returns to this Bitcoin address.'}</p>
      <small>Usually a few minutes to fund; faucet queues vary.</small>
    </Stage>
    <Stage number={3} owner="CPU" title="Confirm incoming Bitcoin" status={stages[2]}>
      <Transactions items={incoming}/><small>Bitcoin confirmation often takes 10–60 minutes or longer. Each transaction has its own status.</small>
    </Stage>
    <Stage number={4} owner="CPU" title="Move 50% to Arkade" status={stages[3]}>
      {record?.readyReason?<p>Already funded with spendable Arkade sats. No onboarding transfer needed.</p>:record?.plan?<><p>{record.plan.totalSats.toLocaleString()} sats frozen · {record.plan.targetSats.toLocaleString()} sats to Arkade · {record.plan.returnSats.toLocaleString()} sats returned.</p>
        <p>Boarding: {record.boarding.phase.replaceAll('-',' ')}. Return: {record.returning.phase.replaceAll('-',' ')}.</p></>:<p>Starts automatically after eligible funding is confirmed.</p>}
      {!record?.readyReason&&<><Transactions items={transfer}/><small>Two settlement rounds, usually a few minutes. Bitcoin confirmation continues separately.</small></>}
    </Stage>
    <Stage number={5} owner="CPU" title="Spendable funds ready" status={stages[4]}>
      <p>{done?'Onboarding complete. Payments use your current available balance.':'Waiting for the exact final Arkade funds to become spendable and their onboarding holds to be released.'}</p>
      <small>No additional block wait after spendability is verified.</small>
    </Stage>
  </div>;
}
