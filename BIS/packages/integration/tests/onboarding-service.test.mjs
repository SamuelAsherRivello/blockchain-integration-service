import test from 'node:test';
import assert from 'node:assert/strict';
import {startOnboarding} from '../src/core/onboarding-service.ts';
import {readOnboardingRecord,writeOnboardingRecord} from '../src/core/onboarding-record.ts';
import {walletReservations,eligibleUnreservedCoins} from '../src/core/wallet-reservations.ts';
import {pendingLogoutOperations,clearBrowserPreferences} from '../src/core/logout-cleanup.ts';
import {scope,coin,receipt,finalReceipt,draft,facts,storage,flush,queuedLock} from './onboarding-fixture.mjs';

test('two coordinators share one frozen parent and cannot replay a submitted leg',async t=>{
 storage();const lock=queuedLock(),stop=new AbortController();t.after(()=>stop.abort());let registrations=0;
 const adapter={inspect:async()=>facts(),submit:async(r,leg,signal,save)=>save(current=>{if(current[leg].phase!=='prepared')return current;registrations++;return {...current,[leg]:{...current[leg],phase:'submitting'}};})};
 const a=startOnboarding(scope,adapter,()=>{},lock,stop.signal),b=startOnboarding(scope,adapter,()=>{},lock,stop.signal);
 await flush();a.refresh();b.refresh();await flush();assert.equal(registrations,1);assert.equal(readOnboardingRecord(scope).plan.totalSats,12001);
});
test('reload continues only the prepared return and completes before either Bitcoin confirmation',async t=>{
 storage();let r=draft();r.boarding={...r.boarding,phase:'receipt-verified',receipts:[receipt],commitmentTxid:'e'.repeat(64)};writeOnboardingRecord(scope,r,0);
 const stop=new AbortController();t.after(()=>stop.abort());let calls=[],latest,changed=0;
 const adapter={inspect:async record=>{const f=facts();f.transactions=['boarding','return'].map((kind,i)=>({kind,txid:(i?'f':'e').repeat(64),confirmed:false,value:i?6001:12001}));if(record.returning.phase==='registered')f.reconciled={...record,status:'complete',completedAt:Date.now(),returning:{...record.returning,phase:'receipt-verified',commitmentTxid:'f'.repeat(64),receipts:[finalReceipt]}};return f;},submit:async(record,leg,signal,save)=>{calls.push(leg);await save(r=>({...r,[leg]:{...r[leg],phase:'registered',intentId:'return-intent'}}));}};
 const worker=startOnboarding(scope,adapter,v=>latest=v,queuedLock(),stop.signal,()=>changed++);await flush();worker.refresh();await flush();
 assert.deepEqual(calls,['returning']);assert.equal(latest.status,'complete');assert.ok(latest.nextCheckAt);assert.equal(changed,1);
 assert.deepEqual(eligibleUnreservedCoins([finalReceipt],walletReservations(scope.profileId)),[finalReceipt]);
 worker.refresh();await flush();assert.equal(changed,1);assert.deepEqual(calls,['returning']);
});
test('new intermediate receipts are held before outpoint persistence; baseline funds remain usable',()=>{
 storage();const own={txid:'9'.repeat(64),vout:1,value:2000},r=draft();r.independent=[own];writeOnboardingRecord(scope,r,0);
 assert.deepEqual(eligibleUnreservedCoins([coin,receipt,own],walletReservations(scope.profileId)),[own]);
 assert.deepEqual(eligibleUnreservedCoins([receipt],walletReservations('different-player')),[receipt]);
});
test('failed final save retains holds and cannot announce Complete',async t=>{
 const db=storage(),r=draft();r.boarding={...r.boarding,phase:'receipt-verified',commitmentTxid:'e'.repeat(64),receipts:[receipt]};r.returning={...r.returning,phase:'registered',attemptId:'return',intentId:'intent',inputs:[receipt]};writeOnboardingRecord(scope,r,0);
 db.setItem=()=>{throw Error('disk full');};const stop=new AbortController();t.after(()=>stop.abort());let latest;
 startOnboarding(scope,{inspect:async()=>({...facts(),reconciled:{...r,status:'complete',completedAt:Date.now(),returning:{...r.returning,phase:'receipt-verified',commitmentTxid:'f'.repeat(64),receipts:[finalReceipt]}}}),submit:async()=>assert.fail('replay')},v=>latest=v,queuedLock(),stop.signal);
 await flush();assert.equal(latest.status,'pending');assert.equal(readOnboardingRecord(scope).status,'pending');assert.deepEqual(eligibleUnreservedCoins([finalReceipt],walletReservations(scope.profileId)),[]);
});
test('polls coalesce and aborted account responses cannot write or publish',async()=>{
 storage();const stop=new AbortController();let release,reads=0,views=0;const held=new Promise(r=>release=r);
 const worker=startOnboarding(scope,{inspect:async()=>{reads++;await held;return facts();},submit:async()=>assert.fail('obsolete signing')},()=>views++,queuedLock(),stop.signal);
 worker.refresh();worker.refresh();assert.equal(reads,1);stop.abort();const before=views;release();await flush();assert.equal(views,before);assert.equal(readOnboardingRecord(scope),undefined);
});
test('a completed account stays complete after spending and stops confirmation polling',async t=>{
 storage();const r=draft();writeOnboardingRecord(scope,{version:1,id:r.id,...scope,revision:1,createdAt:100,status:'complete',allocationPercent:50,readyReason:'existing-funds',completedAt:200},0);
 const stop=new AbortController();t.after(()=>stop.abort());let latest;
 startOnboarding(scope,{inspect:async()=>{const f=facts();f.snapshot.boarding=[];return f;},submit:async()=>assert.fail('rebalance')},v=>latest=v,queuedLock(),stop.signal);await flush();assert.equal(latest.status,'complete');assert.equal(latest.nextCheckAt,undefined);
});
test('pending parent counts once for logout; cleanup removes its journal and leaves spike keys',()=>{
 const db=storage();writeOnboardingRecord(scope,draft(),0);db.setItem('standalone-wallet','preserved');assert.equal(pendingLogoutOperations().count,1);clearBrowserPreferences(db);assert.equal(readOnboardingRecord(scope),undefined);assert.equal(db.getItem('standalone-wallet'),'preserved');
});
test('submitted checkpoints cannot regress phases, replace identifiers, or retire uncertain work',()=>{
 storage();const r=draft();r.boarding.phase='submitting';writeOnboardingRecord(scope,r,0);
 for(const patch of [{boarding:{...r.boarding,phase:'prepared'}},{boarding:{...r.boarding,attemptId:'other'}},{status:'not-submitted'}])assert.throws(()=>writeOnboardingRecord(scope,{...r,...patch,revision:2},1));
});
test('restart honors a durable cooldown before reading; observer exceptions cannot stop the worker',async t=>{
 storage();const r=draft();r.progress={stage:'checking',at:Date.now(),failure:'connection',retryAt:Date.now()+60000};writeOnboardingRecord(scope,r,0);
 const stop=new AbortController();t.after(()=>stop.abort());let reads=0;
 const worker=startOnboarding(scope,{inspect:async()=>{reads++;return facts();},submit:async()=>assert.fail('cooldown')},()=>{throw Error('host renderer');},queuedLock(),stop.signal);await flush();worker.refresh();await flush();assert.equal(reads,0);assert.equal(readOnboardingRecord(scope).interrupted,true);
});
test('completion remains immutable while later Bitcoin confirmation timestamps can be added',()=>{
 storage();const r=draft();r.boarding={...r.boarding,phase:'receipt-verified',receipts:[receipt],commitmentTxid:'e'.repeat(64)};r.returning={...r.returning,phase:'receipt-verified',attemptId:'return',inputs:[receipt],receipts:[finalReceipt],commitmentTxid:'f'.repeat(64)};r.status='complete';r.completedAt=200;writeOnboardingRecord(scope,r,0);
 const later={...r,revision:2,boarding:{...r.boarding,bitcoinConfirmedAt:300}};writeOnboardingRecord(scope,later,1);assert.equal(readOnboardingRecord(scope).completedAt,200);assert.equal(walletReservations(scope.profileId).length,0);
 assert.throws(()=>writeOnboardingRecord(scope,{...later,revision:3,completedAt:400},2));assert.throws(()=>writeOnboardingRecord(scope,{...later,revision:3,boarding:{...later.boarding,bitcoinConfirmedAt:301}},2));
});
