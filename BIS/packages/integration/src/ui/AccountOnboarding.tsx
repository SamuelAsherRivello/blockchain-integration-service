import {type ReactNode} from 'react';
import type {BisBalance} from '../core/context';
import {onboardingReadiness} from '../core/onboarding-stage.ts';
import type {OnboardingView,OnboardingTransaction} from '../core/onboarding-service.ts';
import {testNetwork,type TestNetwork} from '../core/test-network.ts';
import {CopyableValueField} from './CopyableValueField';
import './onboarding.css';

export const onboardingLabel=(view?:OnboardingView,balance?:BisBalance)=>`Onboarding: ${onboardingReadiness(view,balance).label}`;
type StageStatus='complete'|'pending'|'unstarted';
const stageLabel=(status:StageStatus)=>status==='complete'?'Complete':status==='pending'?'Pending':'Unstarted';
function Stage({number,owner,title,status,children}:{number:number;owner:'CPU'|'USER';title:string;status:StageStatus;children:ReactNode}){
  return <details className={`bis-onboarding-step bis-onboarding-${status}`}>
    <summary><span>{number} · {owner}</span><strong>{title}</strong><small>{stageLabel(status)}</small></summary>
    <div>{children}</div>
  </details>;
}
function Transactions({items,network}:{items:OnboardingTransaction[];network:TestNetwork}){
  if(!items.length)return <p>No matching transaction observed yet.</p>;
  return <div className="bis-onboarding-transactions">{items.map(tx=><div key={`${tx.kind}:${tx.txid}`} className="bis-onboarding-transaction">
    <span>{tx.kind==='incoming'?'Incoming Bitcoin':tx.kind==='boarding'?'Bitcoin → Arkade':'Bitcoin remainder returned'} · {tx.value.toLocaleString()} sats</span>
    <strong className={tx.confirmed?'bis-onboarding-confirmed':'bis-onboarding-unconfirmed'}>{tx.confirmed?'Confirmed':'Unconfirmed'}</strong>
    <a href={testNetwork(network).bitcoinExplorerTransactionUrl(tx.txid)} target="_blank" rel="noreferrer">{tx.txid}</a>
  </div>)}</div>;
}
export function AccountOnboarding({view,network='signet',bitcoinAddress,balance}:{view?:OnboardingView;network?:TestNetwork;bitcoinAddress?:string;balance?:BisBalance}){
  const record=view?.record,readiness=onboardingReadiness(view,balance),completed=readiness.stage,done=completed===5,incoming=view?.transactions.filter(t=>t.kind==='incoming')??[];
  const transfer=view?.transactions.filter(t=>t.kind!=='incoming')??[];
  const boardingAddress=bitcoinAddress??view?.address;
  const selectedNetwork=testNetwork(network);
  const fundingInstruction=network==='mutinynet'?'Add sats on the Mutinynet network. Once funding is confirmed, 50% moves to Arkade automatically.':`${selectedNetwork.label} test sats. Once funding is confirmed, 50% moves to Arkade automatically. The remainder returns to this Bitcoin address.`;
  const stages:StageStatus[]=[1,2,3,4,5].map(number=>number<=completed?'complete':number===completed+1?'pending':'unstarted');
  return <div className="bis-onboarding">
    <p>You must fund the account per step 2. Otherwise sit back and wait for completion.</p>
    <Stage number={1} owner="CPU" title="Account ready" status={stages[0]}><p>Your current account is saved in this browser.</p></Stage>
    <Stage number={2} owner="USER" title="Fund the account" status={stages[1]}>
      {boardingAddress?<CopyableValueField label="Bitcoin boarding address" value={boardingAddress}/>:<p role="status">Getting the current Bitcoin boarding address…</p>}
      <a className="bis-button" href={selectedNetwork.faucetUrl} target="_blank" rel="noreferrer">Open faucet and fund</a>
      <p>{done?'Setup is complete. Later deposits do not restart onboarding.':fundingInstruction}</p>
      <small>Usually a few minutes to fund; faucet queues vary.</small>
    </Stage>
    <Stage number={3} owner="CPU" title="Confirm incoming Bitcoin" status={stages[2]}>
      <Transactions items={incoming} network={network}/><small>Bitcoin confirmation often takes 10–60 minutes or longer. Each transaction has its own status.</small>
    </Stage>
    <Stage number={4} owner="CPU" title="Move 50% to Arkade" status={stages[3]}>
      {record?.readyReason?<p>Already funded with spendable Arkade sats. No onboarding transfer needed.</p>:record?.plan?<><p>{record.plan.totalSats.toLocaleString()} sats frozen · {record.plan.targetSats.toLocaleString()} sats to Arkade · {record.plan.returnSats.toLocaleString()} sats returned.</p>
        <p>Boarding: {record.boarding.phase.replaceAll('-',' ')}. Return: {record.returning.phase.replaceAll('-',' ')}.</p></>:<p>Starts automatically after eligible funding is confirmed.</p>}
      {!record?.readyReason&&<><Transactions items={transfer} network={network}/><small>Two settlement rounds, usually a few minutes. Bitcoin confirmation continues separately.</small></>}
    </Stage>
    <Stage number={5} owner="CPU" title="Spendable funds ready" status={stages[4]}>
      <p>{done?'Onboarding complete. Payments use your current available balance.':'Waiting for the exact final Arkade funds to become spendable and their onboarding holds to be released.'}</p>
      <small>No additional block wait after spendability is verified.</small>
    </Stage>
  </div>;
}
