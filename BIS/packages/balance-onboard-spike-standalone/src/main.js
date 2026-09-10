import {stateStorage,stateLocks,updateWindowUrl,windowState} from './window-runtime.js';
import {WorkCoordinator,staleError,withDeadline} from './coordinator.js';
import {classifyFailure,nextRetry,recoveryMessage,batchFailure} from './recovery.js';
import {renderSettlementOutput} from './settlement-output.js';
import {renderStepCompletion,setupStepDisclosure} from './step-ui.js';
import { errorSummary, guarded } from './callback-errors.js';

import { layout } from './layout.js';

import { Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository, Ramps, CSVMultisigTapscript, hasBoardingTxExpired, sdkVersion } from '@arkade-os/sdk';

import { identity, read, write, recoveryDetails } from './storage.js';
import { normalizeRecoveryPhrase } from './identity-material.js';

import { half, canSubmit, verifiedReceipt, fundingEligible, capturedFunding } from './model.js';

import { incomingTransactions } from './incoming.js';

import { incomingCard, transferBadge, statusBadge, settlementCard } from './transaction-card.js';

import { recordTiming, loadTimings } from './timing.js';

import { setupTimingViews, renderTimings } from './timing-view.js';

import './style.css';
import './admin-polish.css';



const $=id=>document.getElementById(id);

document.querySelector('#app').innerHTML=layout;

let transferPercent=50;
try{const saved=Number(stateStorage.getItem('standalone-transfer-percent'));if(Number.isInteger(saved)&&saved>=1&&saved<=100)transferPercent=saved;}catch{}
$('transfer-percent').value=String(transferPercent);
$('transfer-percent').oninput=()=>{transferPercent=Number($('transfer-percent').value);try{stateStorage.setItem('standalone-transfer-percent',String(transferPercent));}catch{}render();};
setupStepDisclosure(stateStorage);
setupTimingViews(stateStorage);

$('status').insertAdjacentHTML('beforebegin','<div id="transfer-badge" class="transfer-badge" aria-live="polite"></div>');

document.querySelector('.refresh-bar').insertAdjacentHTML('afterend','<p class="muted" id="timing-storage">Step timings and averages are saved separately for this window. In-progress durations are excluded. Time with the browser closed is included.</p>');

$('sdk').textContent=sdkVersion;
$('window-label').textContent=`Window ${windowState.id.slice(0,8)}`;
try{$('seed-mode').value=stateStorage.getItem('standalone-seed-mode')==='manual'?'manual':'auto';}catch{}
$('seed-mode').onchange=()=>{try{stateStorage.setItem('standalone-seed-mode',$('seed-mode').value);}catch{}};
$('commitment').closest('dl').insertAdjacentHTML('afterend','<div id="settlement-transactions" class="transaction-scroll settlement-scroll" role="region" aria-label="Settlement transactions" tabindex="0"></div>');

$('error').insertAdjacentHTML('afterend','<details><summary>Diagnostic history · includes recovered errors</summary><pre id="callback-errors" style="white-space:pre-wrap"></pre></details>');

const diagnosticKey='standalone-callback-errors-v1';

let errors=[];

try{errors=JSON.parse(stateStorage.getItem(diagnosticKey)||'[]');}catch{}

function renderErrors(){ $('callback-errors').textContent=errors.map(e=>`${e.at} · ${e.context} · ${e.summary}`).join('\n'); }

function captureError(context,error){

 try{errors.push({at:new Date().toISOString(),context,summary:errorSummary(error)});errors=errors.slice(-30);renderErrors();try{stateStorage.setItem(diagnosticKey,JSON.stringify(errors));}catch{}}catch{}

}

const guardCallback=(context,callback)=>guarded(callback,error=>captureError(context,error));

window.addEventListener('error',event=>captureError('window error',event.error));

window.addEventListener('unhandledrejection',event=>captureError('unhandled promise',event.reason));

renderErrors();



let recoveryTimer,recoveryGeneration=0;

function setRecoveryEye(visible){
 $('eye-slash').style.display=visible?'none':'';
 const label=visible?'Hide recovery details':'Show recovery details';
 $('reveal-recovery').setAttribute('aria-label',label);$('reveal-recovery').title=label;
 $('reveal-recovery').setAttribute('aria-pressed',String(visible));
}
function hideRecovery(){

 recoveryGeneration++;clearTimeout(recoveryTimer);$('recovery-value').value='';$('recovery-value').type='password';

 setRecoveryEye(false);$('recovery-feedback').textContent='';

}

$('reveal-recovery').onclick=async()=>{

 if($('recovery-value').type==='text'){hideRecovery();return;}

 const generation=++recoveryGeneration,requestedAccount=accountId;

 try{

  const details=await recoveryDetails(requestedAccount);

  if(generation!==recoveryGeneration||requestedAccount!==accountId||document.hidden)return;

  $('recovery-value').value=details.value;$('recovery-value').type='text';setRecoveryEye(true);

  recoveryTimer=setTimeout(hideRecovery,60000);

 }catch(error){captureError('application callback',error);$('recovery-feedback').textContent='Could not reveal recovery details. Reload to verify the saved account.';}

};

$('copy-recovery').onclick=async()=>{

 if(!accountId)return;

 try{const requested=accountId;const details=await recoveryDetails(requested);if(requested!==accountId)return;await navigator.clipboard.writeText(details.value);$('recovery-feedback').textContent='Copied.';}

 catch{$('recovery-feedback').textContent='Copy unavailable. Reveal and copy manually.';}

};

document.addEventListener('visibilitychange',()=>{if(document.hidden)hideRecovery();});

window.addEventListener('pagehide',hideRecovery);

window.addEventListener('storage',event=>{if(stateStorage.ownsKey(event.key)&&$('recovery-value').type==='text')hideRecovery();});

async function timing(step,action,at=Date.now(),run=accountId){

 const saved=await recordTiming(run,step,action,at,stateStorage,stateLocks);

 if(!saved)$('timing-storage').textContent='Could not save timing history in local storage. Wallet processing continues.';

 renderTimings(accountId);

}

async function observeDeposit(){

 await timing(3,'start');

 try{const firstSeen=loadTimings(stateStorage).runs[accountId]?.[3]?.startedAt;if(firstSeen!==undefined)await timing(2,'finish',firstSeen);}catch(error){captureError('application callback',error);/* Timing is optional. */}

}

let incomingBusy=false,depositSeen=false;
let settlementEvidence={accountId:undefined,transactions:[]};
let spendableEvidence={accountId:undefined,commitment:undefined,target:undefined};

async function refreshIncoming(){

 if(incomingBusy||!wallet)return;incomingBusy=true;

 const observedAccount=accountId,observedWallet=wallet;

 try{

  const [transactions,coins]=await Promise.all([readWork('transactions',3,()=>observedWallet.onchainProvider.getTransactions(bitcoinAddress)),readWork('boarding-coins',3,()=>observedWallet.getBoardingUtxos())]);

  if(observedAccount!==accountId||observedWallet!==wallet||accountBusy)return;

  const rows=incomingTransactions(transactions,bitcoinAddress,coins);
  depositSeen=rows.length>0;safeRender();
  $('fund-status').textContent=rows.length?'Deposit detected · see confirmation status in Step 3.':'Waiting for faucet funding.';
  $('fund-output').textContent=rows.length?`${rows.length} incoming transaction${rows.length===1?'':'s'} detected. Details in Step 3.`:'No deposit observed yet.';

  if(coins.length&&['idle','waiting'].includes(state.phase))await observeDeposit();

  $('incoming-status').textContent=rows.length?`${rows.length} incoming transaction${rows.length===1?'':'s'} detected. ${rows.filter(r=>!r.confirmed).length} awaiting Bitcoin confirmation.`:'No incoming transaction detected for this address yet. A faucet request is not proof of a broadcast; check the faucet result for a transaction ID.';

  $('incoming-rows').replaceChildren();

  $('incoming-count').textContent=`${rows.length} incoming transaction${rows.length===1?'':'s'}`;

  if(!rows.length)$('incoming-rows').append(statusBadge('No transaction detected','neutral'));

  for(const row of rows){

   $('incoming-rows').append(incomingCard(row,bitcoinAddress,row.txid===state.commitment));

  }

  $('incoming-checked').textContent=`Bitcoin transaction check: ${new Date().toLocaleTimeString()}. Received amounts are transaction history, not an available-balance total.`;

 }catch(error){if(error?.name==='RecoveryPendingError')return;captureError('application callback',error);

  if(observedAccount!==accountId||observedWallet!==wallet||accountBusy)return;
  $('incoming-status').textContent='Bitcoin transaction lookup unavailable. This does not mean no deposit exists. Retrying automatically.';

  $('incoming-rows').replaceChildren();

  $('incoming-rows').append(statusBadge('Status unavailable','unknown'));

  $('incoming-checked').textContent='Current transaction status could not be verified.';

 }finally{incomingBusy=false;}

}

let diagnosticReplay=false;
// Persist automatic continuation with its input snapshot and capped retry delay.
let runRequested=false,recoveryAttempts=0,nextRecoveryAt=0,retryAllowed=false;
function recoveryState(){return {autoRecovery:runRequested,recoveryAttempts,nextRecoveryAt,retryAllowed};}
function restoreRecovery(){
 runRequested=state.autoRecovery===true;
 recoveryAttempts=state.recoveryAttempts??0;
 nextRecoveryAt=state.nextRecoveryAt??0;
 retryAllowed=state.retryAllowed===true;
}

function captureProgress(message){
 try{errors.push({at:new Date().toISOString(),context:'settlement progress',summary:message});errors=errors.slice(-30);renderErrors();try{stateStorage.setItem(diagnosticKey,JSON.stringify(errors));}catch{}}catch{}
}
function scheduleRecovery(error){
 const policy=nextRetry({attempts:Math.max(0,recoveryAttempts-1)},error,{mutation:true,step:5,now:Date.now()});
 retryAllowed=!policy.paused;
 nextRecoveryAt=policy.nextAt;
 if(!retryAllowed)runRequested=false;
}
let wallet, bitcoinAddress='', state={phase:'idle'}, busy=false, signing=false, accountId, timer, confirmedFunding=false, accountBusy=false;
let startupBusy=false,startupTimer,stopIncoming,connectionGeneration=0,refreshQueued=false,criticalFailure=false;
const work=new WorkCoordinator({storage:stateStorage,clock:{setTimeout:(...args)=>setTimeout(...args),clearTimeout:id=>clearTimeout(id)},now:()=>Date.now(),random:()=>Math.random()});
const workKey=name=>`${accountId??windowState.id}:${name}`;
const activeToken=()=>({accountId,revision:state.revision??0,attemptKey:state.attemptKey,leg:state.leg});
function currentToken(token,{attempt=false}={}){return token.accountId===accountId&&(!attempt||(token.attemptKey===state.attemptKey&&token.leg===state.leg));}
async function readWork(name,step,fn){
 const key=workKey(name);if(!work.due(key))throw Object.assign(new Error('Waiting for the scheduled recheck.'),{name:'RecoveryPendingError'});
 const token=activeToken();
 try{const value=await work.read(key,fn);if(!currentToken(token)||accountBusy)throw staleError();work.success(key);return value;}
 catch(error){if(!['StaleOperationError','RecoveryPendingError'].includes(error?.name))work.fail(key,error,{step});throw error;}
}
function requestRefresh(){
 if(accountBusy)return;if(busy){refreshQueued=true;return;}
 nextRefreshAt=Date.now();void tick();
}
function startScheduler(){
 clearInterval(timer);timer=setInterval(guardCallback('refresh timer',()=>{safeRenderRefresh();if(wallet&&!busy&&Date.now()>=nextRefreshAt)return tick();}),200);
}
function safeRender(){try{render();renderRecovery();}catch(error){captureError('render',error);}}
function safeRenderRefresh(){try{renderRefresh();renderRecovery();}catch(error){captureError('timing render',error);}}
function renderRecovery(){
 for(const panel of document.querySelectorAll('.step-ui')){
  const step=Number(panel.dataset.step),records=Object.entries(work.failures).filter(([key,value])=>(key.startsWith(`${accountId??windowState.id}:`)||key===`${windowState.id}:startup`)&&value.step===step).map(([,value])=>value);
  const record=records.find(r=>r.paused)??records[0];
  const status=panel.querySelector('.step-recovery');if(status)status.textContent=record?`${recoveryMessage(record)} Last checkpoint: ${state.stage??state.phase}.`:'';
  if(record){panel.classList.toggle('step-error',true);panel.querySelector('.step-completion').textContent=record.paused?'Needs attention':'Recovering';}
  const retry=panel.querySelector('.step-recheck');if(retry){retry.hidden=!record?.paused;retry.disabled=busy||accountBusy||signing;}
  if(status&&criticalFailure&&step===5)status.textContent+=' Checkpoint storage needs attention. Keep this window open until signing stops, then reload to reconcile the saved transfer.';
 }
}

const refreshIntervalMs=5000;

let nextRefreshAt=Date.now()+refreshIntervalMs;

function renderRefresh(){

 renderTimings(accountId);

 $('refresh').disabled=busy||!wallet;

 $('refresh').textContent=busy?'Refreshing…':`Refresh status (${Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000))}s)`;

}

const messages={boarded:'Original Bitcoin funds boarded. Preparing the return of the Bitcoin remainder.',idle:'No Bitcoin → Arkade transfer submitted. Step 4 starts automatically when funding is ready.',waiting:'Waiting for confirmed eligible funding to onboard automatically.',submitting:'Submitting Bitcoin → Arkade…',registered:'Bitcoin → Arkade intent registered. Waiting for the settlement batch…',uncertain:'Bitcoin → Arkade outcome uncertain. Checking the existing transfer automatically; no new submission.',committed:'Commitment received. Verifying confirmed Bitcoin change and spendable Arkade receipt…',success:'Bitcoin → Arkade settlement verified.'};

function render(){
 const activePercent=state.percent??(state.inputs?50:transferPercent);
 $('transfer-percent').disabled=!!state.inputs;
 $('transfer-percent').value=String(activePercent);$('transfer-percent-value').textContent=`${activePercent}%`;
 document.querySelector('[data-step="4"] h2').textContent=`Onboard ${activePercent}%`;

 renderSettlementOutput($('settlement-transactions'),state,accountId,settlementEvidence,settlementCard);
 renderStepCompletion({accountReady:!!wallet&&!!bitcoinAddress,depositSeen,fundingConfirmed:confirmedFunding,phase:state.phase,commitment:state.commitment});
 if(state.phase==='uncertain')document.querySelector('[data-step="5"] .step-completion').textContent=runRequested&&retryAllowed?'Recovering':'Needs attention';
 $('onboard-output').textContent=state.target?`${state.target.toLocaleString()} sats targeted for Arkade. Transfer details in Step 5.`:'Waiting for eligible funding.';
 const targetSpendable=!!accountId&&!!state.commitment&&Number.isSafeInteger(state.target)&&state.target>0&&spendableEvidence.accountId===accountId&&spendableEvidence.commitment===state.commitment&&spendableEvidence.target===state.target;
 $('ready-status').textContent=state.phase==='success'?'Complete · usable funds verified.':targetSpendable?'Arkade target spendable · waiting for Bitcoin confirmation.':state.commitment?'Underway · verifying spendable funds and Bitcoin confirmation.':'Not started · waiting for settlement';
 if($('retry-existing')){$('retry-existing').disabled=!wallet||busy||signing||runRequested||state.phase!=='uncertain'||!!state.commitment;$('retry-existing').hidden=state.phase!=='uncertain';$('retry-existing').textContent='Run to completion · including recovery';}
 if($('diagnostic-retry'))$('diagnostic-retry').disabled=!wallet||busy||signing||state.phase!=='uncertain';


 $('create').disabled=false;

 $('create').textContent='Restart';

 $('faucet').disabled=!wallet||accountBusy;

 $('reveal-recovery').disabled=!accountId||accountBusy;$('copy-recovery').disabled=!accountId||accountBusy;

 $('eligibility').textContent=state.phase==='success'?'This onboarding is complete.':!['idle','waiting'].includes(state.phase)?'The transfer is in progress.':confirmedFunding?'Incoming Bitcoin is confirmed. CPU is preparing onboarding.':'Waiting for confirmed incoming Bitcoin in Step 3. Onboarding starts automatically.';

 $('status').textContent=messages[state.phase]??'Checking existing operation…';
 if(state.phase==='uncertain'&&state.failureAt==='interrupted')$('status').textContent='Signing session interrupted or not active. Click Run to completion to recover the original transfer and continue automatically.';
 if(state.phase==='uncertain'&&state.failureAt==='registration')$('status').textContent='Intent registration did not complete. Run to completion checks the saved inputs before retrying through the SDK.';
 if(state.phase==='uncertain'&&runRequested&&retryAllowed)$('status').textContent=`Settlement interrupted. Automatic recovery in ${Math.max(0,Math.ceil((nextRecoveryAt-Date.now())/1000))}s; ${recoveryAttempts} recovery attempts so far. Temporary failures retry automatically with a delay capped at five minutes. Keep this tab open.`;
 if(state.failureSummary)$('status').textContent+=` ${state.failureSummary}`;

 $('transfer-badge').replaceChildren(transferBadge(state.phase));

 for(const key of ['target','fee','change'])$(key).textContent=Number.isSafeInteger(state[key])?`${state[key].toLocaleString()} sats`:'—';

 $('intent').textContent=state.intent??'—';$('commitment').textContent=state.commitment??state.boardingCommitment??'—';

 if(state.mode==='board-then-return')$('status').textContent+=` Phase ${state.leg==='return'?'2/2: return Bitcoin remainder':'1/2: board original inputs'}.`;
 if(state.stage)$('status').textContent+=` Last stage: ${state.stage}.`;

 $('usable').textContent=state.phase==='success'?`${state.target.toLocaleString()} sats verified as usable Arkade funds. Ready.`:targetSpendable?`${state.target.toLocaleString()} sats verified spendable in Arkade. Step 6 completes after the matching Bitcoin transaction confirms.`:'Not ready yet. CPU will verify spendable Arkade funds after the transfer settles.';

 $('ready-panel').classList.toggle('complete',state.phase==='success');

 renderTimings(accountId);

}

async function save(patch,expected=activeToken(),strict=true){
 await serialize(async()=>{
  if((await read('identity'))?.id!==expected.accountId||expected.accountId!==accountId)throw staleError();
  const before=await read('operation')??{phase:'idle'};
  if(strict&&(before.revision??0)!==expected.revision)throw staleError();
  if(!strict&&(before.attemptKey!==expected.attemptKey||before.leg!==expected.leg))throw staleError();
  if(before.phase==='success'&&patch.phase&&patch.phase!=='success')throw staleError();
  const next={...before,...patch,accountId,windowId:windowState.id,version:2,revision:(before.revision??0)+1};
  await write('operation',next);state=next;
 });
 const now=Date.now();
 if(patch.phase==='submitting')void timing(5,'start',now).catch(error=>captureError('timing',error));
 if(patch.commitment){void timing(5,'finish',now).catch(error=>captureError('timing',error));void timing(6,'start',now).catch(error=>captureError('timing',error));}
 if(patch.phase==='success')void timing(6,'finish',now).catch(error=>captureError('timing',error));
 safeRender();
}

const serialize=fn=>stateLocks.request('standalone-operation',fn);

// A saved phase is not a live signing session. The browser releases this lease
// when its owning page exits, including a Vite reload. Another tab may still own it.
const signingLease='standalone-settlement';
async function recoverInterruptedSettlement(){
 if(signing||!['submitting','registered'].includes(state.phase))return;
 await stateLocks.request(signingLease,{ifAvailable:true},async lock=>{
  if(lock){
   if(runRequested)scheduleRecovery({name:'SigningInterruptedError'});
   await save({phase:'uncertain',failureAt:'interrupted',stage:'Signing session no longer active',...recoveryState()});
  }
 });
}

function showFailure(message){$('error').textContent=message;}

// Cancel the real event source; never race settle() against a timer and leave a
// background signer running while a second attempt starts. SDK cleanup finishes
// before launchSettlement releases the signing lease and enables recovery.
function watchedSettlementStream(open,signal,topics,getIntentId){
 const controller=new AbortController();let timeout,expired=false,source,selectedBatch;
 const abort=()=>controller.abort();
 const arm=()=>{clearTimeout(timeout);timeout=setTimeout(()=>{expired=true;abort();},300000);};
 const iterator=(async function*(){
  if(signal?.aborted)return;
  signal?.addEventListener('abort',abort,{once:true});
  try{
   source=open(controller.signal,topics);arm();
   while(true){
    const next=await source.next();
    if(expired)throw Object.assign(new Error('Settlement made no matching batch progress for five minutes.'),{name:'SettlementStreamTimeoutError'});
    if(next.done)return;
    const event=next.value;
    // Background batch traffic is not progress for this intent. Keep the
    // deadline running until our batch is selected, then renew on its events.
    if(!getIntentId||(selectedBatch&&event.id===selectedBatch&&event.type!=='batch_started'))arm();
    // Topics can also deliver failures for an earlier intent using these inputs.
    // Only a batch that selected this registered intent can fail this settlement.
    if(getIntentId&&event.type==='batch_failed'&&(!selectedBatch||event.id!==selectedBatch))continue;
    yield event;
    // The SDK primes the stream before registering. Read the ID after yielding:
    // registration has finished by the time the SDK asks for the following event.
    if(getIntentId&&event.type==='batch_started'){
     const intentId=getIntentId();
     if(intentId){
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(intentId));
      const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(event.intentIdHashes?.includes(hash)){selectedBatch=event.id;arm();}
     }
    }
   }
  }finally{
   clearTimeout(timeout);abort();signal?.removeEventListener('abort',abort);
   await source?.return?.();
  }
 })();
 const finish=iterator.return.bind(iterator);
 iterator.return=value=>{abort();return finish(value);};
 return iterator;
}

async function prepare(coins,info,diagnostic=false){
 const snapshot={...state},token=activeToken(),signer=wallet,address=bitcoinAddress;
 if(info.network!=='signet')throw Error('Network mismatch; Signet required.');
 if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw Error('The operator has nonzero fees. Nothing submitted.');
 let params;
 const facade={getAddress:()=>signer.getAddress(),getBoardingAddress:()=>signer.getBoardingAddress(),settle:async p=>{params=p;return 'quote-only';}};
 await readWork('prepare-outputs',4,()=>new Ramps(facade).onboard(info.fees,coins,BigInt(snapshot.total)));
 const own=await readWork('own-address',4,()=>signer.getAddress()),change=snapshot.total-snapshot.target;
 if(!params||params.outputs.length!==1||params.outputs[0].address!==own||params.outputs[0].amount!==BigInt(snapshot.total))throw Error('SDK outputs do not match the selected transfer. Nothing submitted.');
 if(snapshot.target<Number(info.vtxoMinAmount)||(change>0&&change<Math.max(Number(info.utxoMinAmount),Number(signer.dustAmount)))||(info.vtxoMaxAmount>0n&&BigInt(snapshot.target)>info.vtxoMaxAmount)||(info.utxoMaxAmount>0n&&BigInt(change)>info.utxoMaxAmount))throw Error('The selected amount or Bitcoin change is outside operator limits. Nothing submitted.');
 if(!currentToken(token)||signer!==wallet||address!==bitcoinAddress||accountBusy)throw staleError();
 if(diagnostic)return;
 await save({change,fee:0,phase:'submitting',mode:change===0?'full-board':'board-then-return',leg:'board',attemptKey:crypto.randomUUID(),intent:undefined,failureAt:undefined,failureSummary:undefined,stage:'Board all original inputs, then return the Bitcoin remainder',...recoveryState()},token);
 launchSettlement(params,activeToken());
}
function launchSettlement(params,requested){
 if(signing||accountBusy||criticalFailure)return;signing=true;
 const signer=wallet,owner=accountId;let lastProgress=Date.now(),lastStage;
 void stateLocks.request(signingLease,{ifAvailable:true},async lock=>{
  if(!lock)return;
  const original=await read('operation');
  const attempt=requested??{accountId:owner,attemptKey:original.attemptKey,leg:original.leg};
  if(owner!==accountId||original.accountId&&original.accountId!==owner||original.attemptKey!==attempt.attemptKey)throw staleError();
  const callback=event=>{
   const stages={batch_started:'batch started',tree_signing_started:'tree signing',batch_finalization:'batch finalization',batch_finalized:'batch finalized',batch_failed:'batch failed'};
   if(!stages[event.type])return;
   if(lastStage!==event.type){lastStage=event.type;lastProgress=Date.now();}
   const handled=save({stage:stages[event.type],lastProgressAt:lastProgress},attempt,false).catch(error=>{
    if(error?.name==='StaleOperationError')return;
    criticalFailure=true;work.fail(workKey('settlement-persistence'),Object.assign(new Error('Checkpoint unavailable'),{name:'StorageError'}),{step:5});captureError('settlement event persistence',error);
   });
   return handled;
  };
  const progressTimer=setInterval(()=>{if(Date.now()-lastProgress>=300000&&owner===accountId){showFailure('Signing has not advanced for five minutes. Checking the original transfer; waiting for the current signer and cleanup to finish.');requestRefresh();}},5000);
  try{
   const commitment=await signer.settle(params,callback);
   await save(original.leg==='board'&&original.change>0?{phase:'boarded',boardingCommitment:commitment,boardingIntent:state.intent,intent:undefined,stage:'Boarding complete; preparing Bitcoin return'}:{phase:'committed',commitment},attempt,false);
  }catch(error){
   if(error?.name==='StaleOperationError')return;captureError('settlement',error);
   if(owner!==accountId)return;
   const failure=lastStage==='batch_failed'?batchFailure(error):error;
   scheduleRecovery(failure);
   try{await save({phase:'uncertain',failureCategory:failure.name,failureSummary:errorSummary(failure),...recoveryState()},attempt,false);}
   catch(persistenceError){criticalFailure=true;work.fail(workKey('settlement-persistence'),Object.assign(new Error('Checkpoint unavailable'),{name:'StorageError'}),{step:5});captureError('settlement persistence',persistenceError);}
  }finally{clearInterval(progressTimer);}
 }).finally(()=>{if(owner===accountId){signing=false;requestRefresh();}}).catch(error=>{captureError('signing lease',error);});
}
async function prepareReturn(selected,info){
 const token=activeToken(),snapshot={...state},signer=wallet,address=bitcoinAddress;
 if(!selected.length||selected.reduce((sum,v)=>sum+v.value,0)!==snapshot.total||selected.some(v=>!v.commitmentTxIds?.includes(snapshot.boardingCommitment)))throw Error('Captured Arkade inputs unavailable.');
 if(info.network!=='signet')throw Error('Network mismatch; Signet required.');
 if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw Error('The operator fee schedule changed.');
 const own=await readWork('own-address',5,()=>signer.getAddress());
 if(!currentToken(token)||signer!==wallet||accountBusy)throw staleError();
 await save({phase:'submitting',leg:'return',returnInputs:selected.map(({txid,vout,value})=>({txid,vout,value})),intent:undefined,attemptKey:crypto.randomUUID(),failureAt:undefined,failureSummary:undefined,stage:'Returning the Bitcoin remainder',...recoveryState()},token);
 launchSettlement({inputs:selected,outputs:[{address,amount:BigInt(snapshot.change)},{address:own,amount:BigInt(snapshot.target)}]},activeToken());
}
async function refreshBalances(){
 const signer=wallet,owner=accountId;if(!signer)return;
 try{
  const balance=await readWork('balance',3,()=>signer.getBalance());if(owner!==accountId||signer!==wallet||accountBusy)return;
  $('bitcoin').textContent=balance.boarding.total.toLocaleString();$('arkade').textContent=(balance.total-balance.boarding.total).toLocaleString();$('available').textContent='Spendable sats: '+balance.available.toLocaleString();
 }catch(error){if(owner===accountId&&!['StaleOperationError','RecoveryPendingError'].includes(error?.name)){$('bitcoin').textContent='—';$('arkade').textContent='—';$('available').textContent='Spendable sats: —';captureError('balance observation',error);}}
}
async function tick(){
 if(!wallet||busy||accountBusy)return;busy=true;safeRenderRefresh();
 const owner=accountId,signer=wallet;let reconciled=false;
 void refreshIncoming();void refreshBalances();
 try{
  await serialize(async()=>{
   if((await read('identity'))?.id!==owner||owner!==accountId)throw staleError();
   state=await read('operation')??{phase:'idle'};
   if(state.accountId&&state.accountId!==owner)throw staleError();
   restoreRecovery();
  });
  // Legacy batch failures were saved without a category and disabled recovery.
  // An explicit failed-batch event plus exact still-unspent inputs is recoverable;
  // bound this migration, and never apply it to validation or unknown submissions.
  if(state.phase==='uncertain'&&state.stage==='batch failed'&&!state.failureCategory&&!state.autoRecovery&&state.failureSummary?.includes('Details withheld')&&(state.legacyBatchRecoveryAttempts??0)<3){
   runRequested=true;retryAllowed=true;nextRecoveryAt=Date.now()+30000;
   await save({...recoveryState(),failureCategory:'BatchFailedError',legacyBatchRecoveryAttempts:(state.legacyBatchRecoveryAttempts??0)+1});
  }
  await recoverInterruptedSettlement();
  if(state.phase==='waiting')await save({phase:state.inputs?'prepared':'idle'});
  if(state.phase==='idle'&&state.inputs?.length)await save({phase:'prepared',stage:'Restored captured funding; validating original inputs'});
  if(['idle','prepared'].includes(state.phase)){
   const snapshot=activeToken();
   const [coins,tip,info]=await Promise.all([readWork('boarding-coins',3,()=>signer.getBoardingUtxos()),readWork('tip',3,()=>signer.onchainProvider.getChainTip()),readWork('info',4,()=>signer.arkProvider.getInfo())]);
   if(!currentToken(snapshot)||accountBusy||signer!==wallet)throw staleError();
   if(info.network!=='signet')throw Error('Network mismatch; Signet required.');
   const connection=signer.getProviderConnectionState();if(connection.mode!=='online'||connection.source!=='live')throw Object.assign(new Error('Fresh network data unavailable.'),{name:'ProviderUnavailableError'});
   const exit=CSVMultisigTapscript.decode(Uint8Array.from(signer.boardingTapscript.exitScript.match(/.{2}/g),v=>parseInt(v,16)));
   const original=state.inputs?capturedFunding(state.inputs,coins).selected:coins;
   confirmedFunding=fundingEligible(original,c=>hasBoardingTxExpired(c,exit.params.timelock,tip.height));
   if(coins.length)void observeDeposit().catch(error=>captureError('timing',error));
   if(confirmedFunding&&!signing&&!criticalFailure&&work.due(workKey('preparation'))){
    if(state.phase==='idle'){
     runRequested=true;recoveryAttempts=0;retryAllowed=false;
     await save({...half(original,transferPercent),percent:transferPercent,inputs:original.map(({txid,vout,value})=>({txid,vout,value})),phase:'prepared',stage:'Original funding captured',...recoveryState()},snapshot);
     void timing(3,'finish').catch(error=>captureError('timing',error));void timing(4,'start').catch(error=>captureError('timing',error));
    }
    try{await prepare(original,info);work.success(workKey('preparation'));void timing(4,'finish').catch(error=>captureError('timing',error));}
    catch(error){if(!['StaleOperationError','RecoveryPendingError'].includes(error?.name))work.fail(workKey('preparation'),error,{step:4});throw error;}
   }
  }
  if(state.inputs&&!['idle','waiting','prepared'].includes(state.phase)){
   const receipts=await readWork('receipts',6,()=>signer.getSpendableVtxos({withRecoverable:false,withUnrolled:false}));
   const linked=state.commitment?receipts.filter(v=>v.commitmentTxIds?.includes(state.commitment)):[];
   spendableEvidence=linked.length&&linked.every(v=>Number.isSafeInteger(v.value)&&v.value>0)&&linked.reduce((sum,v)=>sum+v.value,0)===state.target?{accountId:owner,commitment:state.commitment,target:state.target}:{};
   if(state.mode==='board-then-return'&&state.phase==='boarded'&&!signing&&!criticalFailure&&work.due(workKey('return-preparation'))){
    const selected=receipts.filter(v=>v.commitmentTxIds?.includes(state.boardingCommitment));
    if(selected.reduce((sum,v)=>sum+v.value,0)===state.total){
     const info=await readWork('info',5,()=>signer.arkProvider.getInfo());
     try{await prepareReturn(selected,info);work.success(workKey('return-preparation'));}
     catch(error){if(!['StaleOperationError','RecoveryPendingError'].includes(error?.name))work.fail(workKey('return-preparation'),error,{step:5});throw error;}
    }
   }
   const transactions=await readWork('transactions',6,()=>signer.onchainProvider.getTransactions(bitcoinAddress));
   if(owner!==accountId||signer!==wallet||accountBusy)throw staleError();
   if(!signing&&state.phase==='uncertain'&&state.leg==='board'&&state.mode==='board-then-return'&&!state.boardingCommitment){
    const candidates=transactions.filter(tx=>tx.status.confirmed&&state.inputs.length&&state.inputs.every(input=>tx.vin?.some(v=>v.txid===input.txid&&v.vout===input.vout))&&receipts.filter(v=>v.commitmentTxIds?.includes(tx.txid)).reduce((sum,v)=>sum+v.value,0)===state.total);
    if(candidates.length===1){await save({phase:'boarded',boardingCommitment:candidates[0].txid,boardingIntent:state.intent,intent:undefined,failureAt:undefined,failureSummary:undefined,stage:'Completed boarding recovered from confirmed transaction and matching Arkade funds'});refreshQueued=true;}
   }
   if(!signing&&state.phase==='uncertain'&&state.leg==='return'&&!state.commitment&&state.returnInputs?.length){
    const {vtxos}=await readWork('settled-inputs',5,()=>signer.indexerProvider.getVtxos({outpoints:state.returnInputs.map(({txid,vout})=>({txid,vout}))}));
    const settled=state.returnInputs.map(input=>vtxos.find(v=>v.txid===input.txid&&v.vout===input.vout&&v.value===input.value)),candidate=settled[0]?.settledBy;
    if(candidate&&settled.every(v=>v?.settledBy===candidate&&v.commitmentTxIds?.includes(state.boardingCommitment))&&verifiedReceipt({...state,commitment:candidate},transactions,receipts,bitcoinAddress)){
     runRequested=false;retryAllowed=false;await save({phase:'success',commitment:candidate,failureAt:undefined,failureSummary:undefined,stage:'Bitcoin return recovered from settled inputs and confirmed matching outputs',...recoveryState()});
    }
   }
   settlementEvidence={accountId:owner,transactions};
   const commitment=verifiedReceipt(state,transactions,receipts,bitcoinAddress);
   if(commitment&&state.phase!=='success'){runRequested=false;retryAllowed=false;await save({phase:'success',commitment,...recoveryState()});}
   reconciled=true;
  }
  $('checked').textContent=new Date().toLocaleTimeString();showFailure('');
 }catch(error){
  if(!['StaleOperationError','RecoveryPendingError'].includes(error?.name)){captureError('status refresh',error);confirmedFunding=false;showFailure('A check is unavailable. See the affected step for its recovery action.');}
 }finally{
  busy=false;nextRefreshAt=Date.now()+refreshIntervalMs;safeRenderRefresh();safeRender();
  if(owner!==accountId||accountBusy)return;
  if(reconciled&&runRequested&&retryAllowed&&!criticalFailure&&!signing&&state.phase==='uncertain'&&Date.now()>=nextRecoveryAt){void recoverOriginalTransfer();}
  else if(refreshQueued){refreshQueued=false;requestRefresh();}
 }
}

$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(bitcoinAddress);$('copied').textContent=' Address copied.';}catch(error){captureError('application callback',error);$('address').select();$('copied').textContent=' Select and copy the address manually.';}};

$('faucet').onclick=()=>{if(wallet){try{window.open('https://signet.2nd.dev/','_blank','noopener,noreferrer');}catch(error){captureError('faucet navigation',error);$('fund-status').textContent='Use the direct faucet link and copy the boarding address above.';}void timing(2,'start').catch(error=>captureError('timing',error));}};

async function restartAccount(manual=false){
 let manualPhrase;
 if(manual){
  manualPhrase=window.prompt('Enter your seed phrase (12, 15, 18, 21, or 24 English words). It is stored encrypted in this browser.');
  if(manualPhrase===null)return;
  try{manualPhrase=normalizeRecoveryPhrase(manualPhrase);}catch{
   manualPhrase=undefined;$('account-status').textContent='Invalid seed phrase. Enter a valid English BIP39 phrase. The current account is unchanged.';return;
  }
 }
 if(!window.confirm(`Are you sure you want to restart ${manual?'using the entered seed phrase':'with an automatically generated seed phrase'}? The steps will reset. The previous account and transfer will be archived locally. This does not move funds or cancel a submitted transfer.`)){manualPhrase=undefined;return;}
 if(accountBusy){$('account-status').textContent='Reset & Restart is already in progress.';return;}
 accountBusy=true;runRequested=false;retryAllowed=false;connectionGeneration++;safeRender();clearInterval(timer);clearTimeout(startupTimer);

 hideRecovery();

 const createdAt=Date.now();

 try{

  await serialize(async()=>{await identity(true,!!(await read('identity')),manualPhrase);});
  manualPhrase=undefined;

  try{stateStorage.setItem('standalone-transfer-percent','50');stateStorage.setItem(diagnosticKey,'[]');}catch(error){captureError('restart preferences',error);}
  transferPercent=50;errors=[];renderErrors();
  for(const panel of document.querySelectorAll('.step-ui')){panel.open=true;try{stateStorage.setItem(`standalone-step-ui-collapsed-v1:${panel.dataset.step}`,'false');}catch{}}
  try{await timing(1,'start',createdAt,(await read('identity')).id);}catch(error){captureError('restart timing',error);}

  // Keep this page bound to the old account until unload, so late settlement
  // callbacks cannot write the new account's operation. The archive is durable.
  signing=false;
  window.location.reload();

 }catch(error){captureError('application callback',error);
  try{const actual=await read('identity');if(actual?.id&&actual.id!==accountId){signing=false;window.location.reload();return;}}catch{}
  $('account-status').textContent='Reset could not finish. Account data is retained. Recheck storage before trying again.';
 }

 finally{manualPhrase=undefined;accountBusy=false;safeRender();startScheduler();}

}
$('create').onclick=()=>restartAccount($('seed-mode').value==='manual');

$('refresh').onclick=()=>void tick();

window.addEventListener('beforeunload',event=>{if(signing){event.preventDefault();event.returnValue='';}});

async function start(providedSigner){
 if(startupBusy||accountBusy)return;
 const startupKey=workKey('startup');if(!work.due(startupKey))return;
 startupBusy=true;const generation=++connectionGeneration;let connectingWallet;
 startScheduler();
 try{

  const signer=providedSigner??await work.read(workKey('identity'),()=>identity());
  if(generation!==connectionGeneration||accountBusy)throw staleError();

  if(!signer){$('account-status').textContent='Choose Auto or Manual seed phrase creation, then Restart to start a Signet account.';render();return;}

  const savedIdentity=await read('identity');accountId=savedIdentity.id;$('account-status').textContent='Connecting the saved account…';

  $('recovery-label').textContent=savedIdentity.kind==='mnemonic'?'Seed phrase':'Private key';


  const provider=new RestArkProvider('https://signet.arkade.sh');
  let registration={attempt:undefined,count:0,duplicate:false,deleted:false};
  const openStream=provider.getEventStream.bind(provider);
  provider.getEventStream=(signal,topics)=>watchedSettlementStream(openStream,signal,topics,()=>registration.intentId);

  const getInfo=provider.getInfo.bind(provider);provider.getInfo=async()=>{const info=await getInfo();if(info.network!=='signet')throw Error('Signet required.');return info;};

  await work.read(workKey('startup-info'),()=>provider.getInfo());

  const register=provider.registerIntent.bind(provider),removeIntent=provider.deleteIntent.bind(provider);
  const providerOwner=accountId;

  const confirm=provider.confirmRegistration.bind(provider);
  provider.confirmRegistration=async intentId=>{
   if(accountBusy||providerOwner!==accountId||(await read('identity'))?.id!==providerOwner)throw staleError();
   const current=await read('operation');
   if(current?.accountId!==providerOwner||current.intent!==intentId||current.phase!=='registered')throw staleError();
   captureProgress('Batch participation confirmation started.');
   try{await confirm(intentId);captureProgress('Batch participation confirmed by the operator.');}
   catch(error){captureError('batch participation confirmation',error);throw error;}
  };

  provider.registerIntent=async intent=>{

   if(accountBusy||providerOwner!==accountId||(await read('identity'))?.id!==providerOwner)throw staleError();
   if(diagnosticReplay)throw Error('Diagnostic stopped before registration');
   const attempt=(await read('operation'))?.attemptKey;
   if(registration.attempt!==attempt)registration={attempt,count:0,duplicate:false,deleted:false};
   if(registration.count>0&&!(registration.count===1&&registration.duplicate&&registration.deleted))throw Error('Repeat registration blocked.');

   const saved=await read('operation');if(saved?.phase!=='submitting'||saved.intent)throw Error('Registration is not authorized.');
   if(accountBusy||(await read('identity'))?.id!==providerOwner||saved.accountId!==providerOwner||saved.attemptKey!==attempt)throw staleError();
   registration.count++;

   let id;try{id=await register(intent);}catch(error){
    captureError('intent registration',error);
    // Persist before returning to SDK cleanup, which may wait on its event stream.
    const duplicate=error?.code===0&&error instanceof Error&&error.message.includes('duplicated input');
    registration.duplicate=duplicate;
    const current=await read('operation');
    if(current.attemptKey===attempt&&!['success','committed','boarded'].includes(current.phase))
     await save({phase:duplicate?'submitting':'uncertain',failureAt:'registration',failureSummary:errorSummary(error),stage:duplicate?'SDK replacing the previous queued intent':'Registration acknowledgement unavailable'},{accountId:providerOwner,attemptKey:attempt,leg:current.leg},false);
    throw error;
   }

   await save({phase:'registered',intent:id,failureAt:undefined,failureSummary:undefined,stage:'Intent accepted; waiting for batch'},{accountId:providerOwner,attemptKey:attempt,leg:saved.leg},false);registration.intentId=id;return id;

  };

  provider.deleteIntent=async proof=>{
   if(accountBusy||providerOwner!==accountId||(await read('identity'))?.id!==providerOwner)throw staleError();
   const current=await read('operation');
   if(diagnosticReplay||!registration.count||current?.attemptKey!==registration.attempt)throw Error('Intent cleanup is not authorized.');
   // The SDK constructs this ownership proof from this settlement's exact inputs.
   // An acknowledgement permits its one duplicate-input retry; it is not finality proof.
   await removeIntent(proof);registration.deleted=true;
  };

  connectingWallet=await work.read(workKey('wallet-connect'),()=>Wallet.create({identity:signer,arkProvider:provider,settlementConfig:false,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}}),{onLate:value=>value.dispose?.()});

  const connectedAddress=await work.read(workKey('boarding-address'),()=>connectingWallet.getBoardingAddress());
  if(generation!==connectionGeneration||accountBusy)throw staleError();
  if(wallet&&wallet!==connectingWallet)await wallet.dispose?.();
  wallet=connectingWallet;bitcoinAddress=connectedAddress;

  if(!bitcoinAddress.startsWith('tb1'))throw Error('Unexpected address network.');
  updateWindowUrl(bitcoinAddress);

  $('address').value=bitcoinAddress;$('copy').disabled=false;

  $('account-status').textContent='Account saved for this window. Refresh will keep this boarding address.';

  void timing(1,'finish').catch(error=>captureError('timing',error));

  $('address-explorer').href=`https://mempool.signet.arkade.sh/address/${bitcoinAddress}`;

  state=await read('operation')??{phase:'idle'};work.success(startupKey);work.success(workKey('startup'));safeRender();await tick();
  if(wallet.notifyIncomingFunds){
   void work.read(workKey('subscription'),()=>wallet.notifyIncomingFunds(guardCallback('incoming notification',()=>requestRefresh())),{onLate:stop=>stop?.()}).then(stop=>{if(generation===connectionGeneration){stopIncoming?.();stopIncoming=stop;}else stop?.();}).catch(error=>captureError('subscription; polling continues',error));
  }
 }catch(error){
  if(connectingWallet){try{await work.read(workKey('wallet-dispose'),()=>connectingWallet.dispose?.());}catch{criticalFailure=true;}}
  if(error?.name==='StaleOperationError')return;
  captureError('startup',error);
  wallet=undefined;
  const retry=work.fail(startupKey,error,{step:1});
  $('account-status').textContent=`Same account retained. ${recoveryMessage(retry)}`;
  clearTimeout(startupTimer);if(!retry.paused)startupTimer=setTimeout(()=>void start(),Math.max(0,retry.nextAt-Date.now()));safeRender();
 }finally{startupBusy=false;}

}


$('retry-existing').onclick=guardCallback('live retry',async()=>{
 if(busy||signing||state.phase!=='uncertain'||state.commitment)return;
 runRequested=true;recoveryAttempts=0;retryAllowed=true;
 nextRecoveryAt=Math.max(Date.now(),state.nextRecoveryAt??0);
 await save(recoveryState());
 // First reconcile receipts and transaction history; tick alone can authorize
 // recovery once it has ruled out an already completed original transfer.
 await tick();
});
async function recoverOriginalTransfer(){
 if(busy||signing||criticalFailure||accountBusy||state.phase!=='uncertain'||state.commitment)return;
 if(state.autoRecovery&&Date.now()<(state.nextRecoveryAt??0))return;
 recoveryAttempts++;retryAllowed=false;busy=true;safeRender();
 const owner=accountId,signer=wallet;
 try{
  await serialize(async()=>{
   if((await read('identity'))?.id!==owner||owner!==accountId)throw staleError();
   state=await read('operation');
  });
  if(state.phase!=='uncertain'||state.commitment)return;
  if(state.leg==='return'){
   const [receipts,info]=await Promise.all([readWork('receipts',5,()=>signer.getSpendableVtxos({withRecoverable:false,withUnrolled:false})),readWork('info',5,()=>signer.arkProvider.getInfo())]);
   const selected=state.returnInputs?.length?capturedFunding(state.returnInputs,receipts).selected:receipts.filter(v=>v.commitmentTxIds?.includes(state.boardingCommitment));
   if(owner!==accountId||accountBusy)throw staleError();
   await write('operation-attempt:'+Date.now(),state);await prepareReturn(selected,info);return;
  }
  const [coins,info,tip]=await Promise.all([readWork('boarding-coins',5,()=>signer.getBoardingUtxos()),readWork('info',5,()=>signer.arkProvider.getInfo()),readWork('tip',5,()=>signer.onchainProvider.getChainTip())]);
  const {selected}=capturedFunding(state.inputs??[],coins);
  const exit=CSVMultisigTapscript.decode(Uint8Array.from(signer.boardingTapscript.exitScript.match(/.{2}/g),v=>parseInt(v,16)));
  if(!fundingEligible(selected,c=>hasBoardingTxExpired(c,exit.params.timelock,tip.height)))throw Error('Captured funding is not confirmed and available.');
  if(selected.reduce((sum,c)=>sum+c.value,0)!==state.total)throw Error('Captured funding amount changed.');
  if(owner!==accountId||accountBusy)throw staleError();
  await write('operation-attempt:'+Date.now(),state);await prepare(selected,info);
 }catch(error){
  if(error?.name!=='StaleOperationError'&&owner===accountId){
   captureError('live retry',error);
   if(error?.name==='RecoveryPendingError'){retryAllowed=true;nextRecoveryAt=Date.now()+5000;}else scheduleRecovery(error);
   try{if(state.phase==='uncertain')await save(recoveryState());}catch(persistenceError){criticalFailure=true;captureError('recovery persistence',persistenceError);}
   showFailure('Recovery is checking the saved inputs. No replacement transfer has been created.');
  }
 }finally{busy=false;safeRender();safeRenderRefresh();if(refreshQueued){refreshQueued=false;requestRefresh();}}
}
$('diagnostic-retry').onclick=guardCallback('diagnostic replay',async()=>{
 if(busy||signing||diagnosticReplay||state.phase!=='uncertain')return;
 busy=true;diagnosticReplay=true;render();
 try{
  const [coins,info]=await Promise.all([wallet.getBoardingUtxos(),wallet.arkProvider.getInfo()]);
  const captured=state.inputs??[];
  if(!captured.length||captured.some(input=>!coins.some(c=>c.txid===input.txid&&c.vout===input.vout&&c.value===input.value)))throw Error('Captured inputs no longer available');
  await prepare(coins.filter(c=>captured.some(i=>i.txid===c.txid&&i.vout===c.vout)),info,true);
 }catch(error){captureError('diagnostic replay',error);}
 finally{diagnosticReplay=false;busy=false;render();}
});
for(const panel of document.querySelectorAll('.step-ui')){
 const recheck=panel.querySelector('.step-recheck');
 recheck.onclick=guardCallback('step recheck',async()=>{
  if(busy||accountBusy||signing)return;
  if(criticalFailure){window.location.reload();return;}
  for(const [key,record] of Object.entries(work.failures))if(record.step===Number(panel.dataset.step)&&(key.startsWith(`${accountId??windowState.id}:`)||key===`${windowState.id}:startup`))work.recheck(key);
  if(!wallet)await start();else requestRefresh();
 });
}
window.addEventListener('online',()=>{if(wallet)requestRefresh();else void start();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(wallet)requestRefresh();else void start();}});
for(const element of document.querySelectorAll('button')){if(element.onclick)element.onclick=guardCallback(`button ${element.id}`,element.onclick);}

void start().catch(error=>captureError('startup',error));





