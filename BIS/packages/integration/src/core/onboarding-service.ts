import {readOnboardingRecord,writeOnboardingRecord,type OnboardingRecord,type OnboardingScope,type OnboardingProgress,type OnboardingCoin} from './onboarding-record.ts';
import {assessOnboarding,type OnboardingSnapshot} from './onboarding-allocation.ts';
export type OnboardingTransaction={txid:string;confirmed:boolean;value:number;kind:'incoming'|'boarding'|'return'};
export type OnboardingView={status:'start'|'pending'|'complete';detail:string;record?:OnboardingRecord;address?:string;transactions:OnboardingTransaction[];checkedAt?:number;nextCheckAt?:number};
export type OnboardingFacts={snapshot:OnboardingSnapshot;address:string;transactions:OnboardingTransaction[];independent:OnboardingCoin[];reconciled?:OnboardingRecord};
export interface OnboardingAdapter {
  inspect(record:OnboardingRecord|undefined,signal:AbortSignal):Promise<OnboardingFacts>;
  submit(record:OnboardingRecord,leg:'boarding'|'returning',signal:AbortSignal,checkpoint:(change:(r:OnboardingRecord)=>OnboardingRecord)=>Promise<OnboardingRecord>):Promise<void>;
}
const explanations={connection:'Connection unavailable. Status checks will restart automatically; no action needed.', 'registration-unknown':'Submission outcome is unknown. Checking the original transfer; no new submission.', 'batch-failed':'The selected batch failed. Checking its outcome before any further transfer.', deadline:'Processing stopped. Checking the original transfer automatically.',validation:'Transfer terms or receipts could not be verified. Funds are protected while checks continue.',storage:'Checkpoint storage is unavailable. Funds remain protected.'};
export function startOnboarding(scope:OnboardingScope,adapter:OnboardingAdapter,publish:(v:OnboardingView)=>void,lock:<T>(work:()=>Promise<T>)=>Promise<T>,signal:AbortSignal,changed:()=>void=()=>{}) {
  let timer:ReturnType<typeof setTimeout>|undefined,busy=false,failures=0,submission:Promise<void>|undefined,notified=false,first=true,view:OnboardingView={status:'pending',detail:'Checking account readiness…',transactions:[]};
  const emit=(patch:Partial<OnboardingView>)=>{view={...view,...patch};if(!signal.aborted){try{publish(view);}catch{/* A host render failure cannot change a financial checkpoint. */}}};
  const checkpoint=async(change:(r:OnboardingRecord)=>OnboardingRecord)=>lock(async()=>{
    signal.throwIfAborted();const r=readOnboardingRecord(scope);if(!r)throw Error('Onboarding record missing.');const next=change(r);
    if(JSON.stringify(next)===JSON.stringify(r))return r;
    const saved=writeOnboardingRecord(scope,{...next,revision:r.revision+1},r.revision);emit({record:saved});return saved;
  });
  const schedule=(delay:number)=>{if(signal.aborted)return;clearTimeout(timer);emit({nextCheckAt:Date.now()+delay});timer=setTimeout(()=>void tick(),delay);(timer as unknown as {unref?:()=>void}).unref?.();};
  async function tick(){
    if(busy||signal.aborted)return;busy=true;let delay=5000,stop=false;
    try{
      let r=readOnboardingRecord(scope);
      if(first&&r?.status==='pending')r=await checkpoint(current=>current.status==='pending'?{...current,interrupted:true}:current);
      first=false;
      if(r)emit({record:r,...(r.status==='complete'?{status:'complete' as const}:{} )});
      if(r?.status==='pending'&&r.progress?.retryAt&&r.progress.retryAt>Date.now()){
        delay=r.progress.retryAt-Date.now();emit({detail:r.progress.failure?explanations[r.progress.failure]:'Waiting for the next automatic status check.'});return;
      }
      const facts=await adapter.inspect(r,signal);signal.throwIfAborted();
      emit({address:facts.address,transactions:facts.transactions,checkedAt:Date.now()});
      if(r&&facts.reconciled){const revision=r.revision;r=await checkpoint(current=>current.revision===revision?{...facts.reconciled!,...(current.status==='complete'?{}:{independent:facts.independent})}:current);}
      else if(r?.status==='pending')r=await checkpoint(current=>({...current,independent:facts.independent}));
      const assessment=assessOnboarding(scope,facts.snapshot,r);
      if(assessment.status==='ready'||assessment.status==='already-ready'){
        r=await lock(async()=>{
          signal.throwIfAborted();const current=readOnboardingRecord(scope);if(current&&current.status!=='not-submitted')return current;
          const base={version:1 as const,...scope,id:crypto.randomUUID(),revision:(current?.revision??0)+1,createdAt:Date.now(),allocationPercent:50 as const,independent:facts.independent};
          if(assessment.status!=='ready'&&assessment.status!=='already-ready')throw Error('Assessment changed.');
          const next:OnboardingRecord=assessment.status!=='ready'?{...base,status:'complete',completedAt:Date.now(),readyReason:'existing-funds'}:
            {...base,status:'pending',plan:assessment.plan,boarding:{phase:'prepared',attemptId:crypto.randomUUID(),inputs:assessment.plan.inputs,outputs:[{network:'arkade',script:assessment.plan.arkadeScript,value:assessment.plan.totalSats}]},returning:{phase:'unprepared',inputs:[],outputs:[{network:'bitcoin',script:assessment.plan.bitcoinScript,value:assessment.plan.returnSats},{network:'arkade',script:assessment.plan.arkadeScript,value:assessment.plan.targetSats}]}};
          return writeOnboardingRecord(scope,next,current?.revision??0);
        });
      }
      if(r?.status==='complete'){emit({status:'complete',detail:r.readyReason?'Existing spendable funds verified. Account ready.':'Final Arkade funds are spendable. Account ready.',record:r});if(!notified){try{changed();notified=true;}catch{/* Retry availability publication; completion remains durable. */}}stop=notified&&(!r.plan||!!r.boarding.bitcoinConfirmedAt&&!!r.returning.bitcoinConfirmedAt);}
      else if(r?.status==='pending'&&r.plan){
        emit({status:'pending',record:r,detail:r.progress?.failure?explanations[r.progress.failure]:'Moving the frozen 50% target to Arkade automatically.'});
        let leg:'boarding'|'returning'|undefined;
        if(r.boarding.phase==='prepared')leg='boarding';
        else if(r.boarding.phase==='receipt-verified'&&r.returning.phase==='unprepared'){
          r=await checkpoint(current=>{if(!current.plan||current.returning.phase!=='unprepared')return current;return {...current,returning:{...current.returning,phase:'prepared' as const,attemptId:crypto.randomUUID(),inputs:current.boarding.receipts!}};});leg='returning';
        }else if(r.returning.phase==='prepared')leg='returning';
        if(leg&&!submission&&(!r.progress?.retryAt||r.progress.retryAt<=Date.now())){
          // Observe independently while the signer waits or cleans up. The adapter
          // retains its exclusive signer lease until actual termination.
          submission=adapter.submit(r,leg,signal,checkpoint).catch(()=>{if(!signal.aborted)emit({detail:explanations.connection});}).finally(()=>{submission=undefined;});
        }
        else if(r.progress?.retryAt&&r.progress.retryAt>Date.now())delay=r.progress.retryAt-Date.now();
        else if(!r.progress?.failure)emit({detail:'Checking the existing settlement and exact receipts automatically; no action needed.'});
      }else emit({record:undefined,status:assessment.status==='funding-needed'?'start':'pending',detail:assessment.status==='funding-needed'?'Fund this account to start automatic 50% onboarding.':assessment.status==='waiting-confirmation'?'Incoming Bitcoin detected. Waiting for eligible confirmation.':assessment.status==='unsupported'?'Current fees or amount limits do not support this 50% transfer. Checking automatically.':'Checking eligibility and existing reservations automatically.'});
      failures=0;
    }catch{
      failures++;delay=Math.min(60000,5000*2**Math.min(failures-1,4));
      if(!signal.aborted&&view.record?.status==='pending')try{await checkpoint(r=>r.status==='pending'?{...r,interrupted:true,progress:{stage:r.progress?.stage??'checking',at:Date.now(),failure:r.progress?.failure??'connection',retryAt:Date.now()+delay,failures}}:r);}catch{/* Failed persistence keeps existing reservations authoritative. */}
      emit({status:view.record?.status==='complete'?'complete':'pending',detail:explanations.connection});
    }finally{busy=false;if(!stop)schedule(delay);else emit({nextCheckAt:undefined});}
  }
  signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});emit({});void tick();
  return {refresh:()=>{clearTimeout(timer);void tick();}};
}
export function onboardingFailure(error:unknown):NonNullable<OnboardingProgress['failure']>{
  try{if(error instanceof Error){if(error.message.includes('deadline'))return 'deadline';if(error.message.includes('registration'))return 'registration-unknown';if(error.message.includes('batch'))return 'batch-failed';if(error.message.includes('saved')||error.message.includes('storage'))return 'storage';if(error.message.includes('terms')||error.message.includes('inputs')||error.message.includes('receipt'))return 'validation';}}catch{}
  return 'connection';
}
