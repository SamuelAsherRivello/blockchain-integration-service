import {testLocks} from './locks-fixture.mjs';
import {pendingLogoutOperations,withBrowserMutation} from '../src/core/logout-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBoardingRecord,writeBoardingRecord,withWalletMutation,assertNoPendingBoarding,createBoardingAttempt,recoverPreparedBoarding} from '../src/core/boarding-record.ts';
import {verifiedBoardingCommitment} from '../src/core/boarding-reconciliation.ts';
import {settlementTimeoutMs} from '../src/core/boarding-status.ts';
import {createAccountStorage} from '../src/core/account-storage.ts';
const tx='a'.repeat(64), commitment='b'.repeat(64);
function record(profileId='profile') {return {version:1,id:'operation',profileId,status:'pending',phase:'prepared',inputs:[{txid:tx,vout:0}],bitcoinAddress:'tb1-test',quote:{profileId,direction:'to-arkade',amountSats:1000,feeSats:0,netSats:1000,maxSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)}};}
let values,failWrite;
test.beforeEach(()=>{
 values=new Map();failWrite=false;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:i=>[...values.keys()][i]??null,removeItem:key=>values.delete(key),getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failWrite)throw Error('quota');values.set(key,value);}}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:testLocks()}});
});
test('prepared recovery is safe; its old registration callback cannot submit',async()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 await withWalletMutation(async()=>recoverPreparedBoarding(readBoardingRecord('profile')),'profile');
 assert.equal(readBoardingRecord('profile').status,'not-submitted');assert.doesNotThrow(()=>assertNoPendingBoarding('profile'));
 assert.throws(()=>attempt.beforeRegister());
});

test('complete logout cannot overlap a mutation for any wallet',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const active=withWalletMutation(()=>gate,'other-wallet');
 try {await assert.rejects(withBrowserMutation(async()=>{},true),/Another wallet operation/);}
 finally {release();await active;}
 await withBrowserMutation(async()=>{
  await assert.rejects(withWalletMutation(async()=>{},'profile'),/Another wallet operation/);
 },true);
});

test('storage cleanup rechecks pending consent and account identity inside its lock',async()=>{
 const storage=createAccountStorage();
 storage.load=async()=>({generation:0,account:{profileId:'profile'}});
 const approved=pendingLogoutOperations();
 writeBoardingRecord(record());
 await assert.rejects(storage.reset(0,{purpose:'logout',profileId:'profile',operations:approved}),/Pending operations changed/);
 await assert.rejects(storage.reset(0,{purpose:'logout',profileId:'replacement',operations:pendingLogoutOperations()}),/account changed/);
 assert.equal(readBoardingRecord('profile').status,'pending');
});

test('acknowledged logout clears all account rows and journals; administrative reset still blocks', async () => {
 const pending={...record(),phase:'registered',intentId:'operator-intent'};
 writeBoardingRecord(pending);
 const before=[...values.entries()];
 const stored=new Map([['generation',0],['identity','encrypted-test-double']]);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){
  const request={};
  queueMicrotask(()=>{
   request.result={close(){},transaction(){
    const tx={objectStore(){return {
     get(key){const result={result:stored.get(key)};queueMicrotask(()=>{result.onsuccess?.();if(key==='generation')queueMicrotask(()=>tx.oncomplete());});return result;},
     put(value,key){stored.set(key,value);},delete(key){stored.delete(key);},clear(){stored.clear();}
    };},abort(){tx.onabort();}};
    return tx;
   }};
   request.onsuccess();
  });return request;
 }}});
 try {
  const storage=createAccountStorage();
  storage.load=async()=>({generation:stored.get('generation'),account:stored.has('identity')?{profileId:'profile'}:null});
  await assert.rejects(storage.reset(0),/unresolved/);
  await storage.reset(0,{purpose:'logout',profileId:'profile',operations:pendingLogoutOperations()});
  assert.equal(stored.has('identity'),false);
  assert.equal(stored.size,0);
  assert.equal(values.size,0);
  assert.equal(readBoardingRecord('profile'),undefined);
 } finally {
  if(previous)Object.defineProperty(globalThis,'indexedDB',previous);
  else Reflect.deleteProperty(globalThis,'indexedDB');
 }
});
test('registration marker precedes network and unknown outcomes remain blocked after reload',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 attempt.beforeRegister();assert.equal(readBoardingRecord('profile').phase,'submitting');
 assert.throws(()=>attempt.beforeRegister());attempt.close();
 const reloaded=JSON.parse([...values.values()][0]);
 assert.equal(recoverPreparedBoarding(reloaded).status,'pending');assert.throws(()=>assertNoPendingBoarding('profile'));
});
test('confirmed registration and late commitment survive timeout; never permit automatic replay',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 attempt.beforeRegister();attempt.close();attempt.registered('operator-intent');attempt.committed(commitment);
 assert.equal(readBoardingRecord('profile').intentId,'operator-intent');assert.equal(readBoardingRecord('profile').commitmentTxid,commitment);
 assert.equal(readBoardingRecord('profile').status,'pending');assert.throws(()=>attempt.beforeRegister());
});
test('timeout before registration and account replacement reject all late registration',()=>{
 for(const isCurrent of [()=>true,()=>false]) {
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',isCurrent,2000,'profile',()=>2000);
 assert.throws(()=>attempt.beforeRegister());attempt.close();assert.equal(readBoardingRecord('profile').status,'not-submitted');
 }
});
test('unavailable/corrupt storage or failed write prevents registration',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 failWrite=true;assert.throws(()=>attempt.beforeRegister());assert.equal(readBoardingRecord('profile').phase,'prepared');
 failWrite=false;const key=[...values.keys()][0];values.set(key,'{broken');assert.throws(()=>readBoardingRecord('profile'));assert.throws(()=>assertNoPendingBoarding('profile'));
 values.set(key,JSON.stringify({...record(),inputs:[]}));assert.throws(()=>readBoardingRecord('profile'));
});
test('same-origin operations cannot overlap; pending records block another profile too',async()=>{
 let release;const barrier=new Promise(r=>release=r);
 const first=withWalletMutation(async()=>{writeBoardingRecord(record());await barrier;},'profile');
 await assert.rejects(withWalletMutation(async()=>{},'profile'),/Another wallet operation/);
 release();await first;
 await assert.rejects(withWalletMutation(async()=>assertNoPendingBoarding('profile'),'profile'),/unresolved/);
});
test('late result cannot alter a replacement operation',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 attempt.beforeRegister();writeBoardingRecord({...record(),id:'new-operation'});
 attempt.committed(commitment);attempt.close();assert.equal(readBoardingRecord('profile').id,'new-operation');assert.equal(readBoardingRecord('profile').commitmentTxid,undefined);
 assert.throws(()=>attempt.registered('old-intent'));
});
test('completion requires confirmed input spend, exact owned receipt and exact Bitcoin change',()=>{
 const r=record();const transaction={txid:commitment,status:{confirmed:true},vin:[{txid:tx,vout:0}],vout:[{scriptpubkey_address:'tb1-test',value:'1000'}]};
 const receipt={value:1000,commitmentTxIds:[commitment]};
 assert.equal(verifiedBoardingCommitment(r,[transaction],[receipt]),commitment);
 assert.equal(verifiedBoardingCommitment(r,[],[receipt]),undefined);
 for(const changed of [{status:{confirmed:false}},{vin:[]},{vout:[]}])assert.equal(verifiedBoardingCommitment(r,[{...transaction,...changed}],[receipt]),undefined);
 for(const changed of [{value:999},{value:1001},{commitmentTxIds:[]}])assert.equal(verifiedBoardingCommitment(r,[transaction],[{...receipt,...changed}]),undefined);
 assert.equal(verifiedBoardingCommitment({...r,commitmentTxid:'d'.repeat(64)},[transaction],[receipt]),undefined);
});
test('all account readers use read-only identities; sole signing adapter disables automatic settlement',()=>{
 for(const name of ['account','balance','addresses','funding','activity']) {
  const source=readFileSync(new URL(`../src/arkade/${name}.ts`,import.meta.url),'utf8');
  assert.match(source,/ReadonlyWallet\.create\(/,name);assert.match(source,/\.toReadonly\(\)/,name);assert.doesNotMatch(source,/(?<!Readonly)Wallet\.create\(/,name);
 }
 const source=readFileSync(new URL('../src/arkade/boarding.ts',import.meta.url),'utf8');assert.match(source,/settlementConfig:false/);
});


test('reverse completion requires exact Bitcoin output, Arkade change and consumed VTXO evidence',()=>{
 const r=record();r.quote.direction='to-bitcoin';
 const transaction={txid:commitment,status:{confirmed:true},vin:[],vout:[{scriptpubkey_address:'tb1-test',value:'1000'}]};
 const receipt={value:1000,commitmentTxIds:[commitment]};
 const consumed={txid:tx,vout:0,isSpent:true,settledBy:commitment};
 assert.equal(verifiedBoardingCommitment(r,[transaction],[receipt],[consumed]),commitment);
 for(const changed of [{isSpent:false},{settledBy:'wrong'},{txid:'wrong'}])assert.equal(verifiedBoardingCommitment(r,[transaction],[receipt],[{...consumed,...changed}]),undefined);
 const max={...r,quote:{...r.quote,amountSats:2000,netSats:2000}};
 assert.equal(verifiedBoardingCommitment(max,[{...transaction,vout:[{scriptpubkey_address:'tb1-test',value:'2000'}]}],[],[consumed]),commitment);
});

test('public confirmation serializes duplicate callers and reload resumes status without submission',async()=>{
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'profile',phrase:'private-test-placeholder'};
 const storage={load:async()=>({generation:0,account}),subscribe:()=>()=>{}};
 let submits=0,reconciles=0,release;
 const barrier=new Promise(r=>release=r);
 const transfers={quote:async()=>record().quote,submit:async(_account,_quote,isCurrent)=>{
   submits++;assert.equal(isCurrent(),true);writeBoardingRecord({...record(),phase:'submitting'});await barrier;return readBoardingRecord('profile');
 },reconcile:async()=>{reconciles++;return readBoardingRecord('profile');}};
 const make=()=>createContext(storage,undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,transfers);
 const c=make();await c.ready();
 const first=c.confirmAccountTransfer(record().quote);
 await new Promise(r=>setImmediate(r));
 await assert.rejects(c.confirmAccountTransfer(record().quote),/Another wallet operation/);
 release();await first;assert.equal(submits,1);
 await assert.rejects(c.confirmAccountTransfer(record().quote),/unresolved/);
 c.dispose();const reloaded=make();await reloaded.ready();await new Promise(r=>setImmediate(r));
 assert.ok(reconciles>=1);assert.equal(submits,1);reloaded.dispose();
});

test('settlement lifetime covers the advertised session end and signing grace',()=>{
 const now=1000000;
 const timeout=settlementTimeoutMs({sessionDuration:60n,scheduledSession:{nextEndTime:1300n}},now);
 assert.ok(now+timeout >= 1420000, 'must not dispose the signing wallet before the advertised session finishes');
 assert.ok(settlementTimeoutMs({sessionDuration:60n},now)>=180000);
});

test('status failure retains the recorded attempt and its phase without resubmitting',async()=>{
 writeBoardingRecord({...record(),phase:'registered',intentId:'operator-intent'});
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'profile',phrase:'private-test-placeholder'};
 let submits=0;
 const c=createContext({load:async()=>({generation:0,account}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,
 {quote:async()=>record().quote,submit:async()=>{submits++;throw Error('unexpected');},reconcile:async()=>{throw Error('private provider response');}});
 await c.ready();await new Promise(r=>setImmediate(r));
 try {
  const status=await c.checkAccountTransfer();
  assert.equal(status.status,'pending');assert.equal(status.phase,'registered');assert.equal(status.verification,'unavailable');assert.equal(status.intentId,'operator-intent');
  assert.equal(submits,0);assert.throws(()=>assertNoPendingBoarding('profile'));
  assert.doesNotMatch(JSON.stringify(status),/private provider/);
 } finally {c.dispose();}
});

test('quote review neither submits nor creates a pending journal',async()=>{
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'profile',phrase:'private-test-placeholder'};
 let submits=0;
 const c=createContext({load:async()=>({generation:0,account}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,
 {quote:async()=>record().quote,submit:async()=>{submits++;throw Error('unexpected');},reconcile:async()=>undefined});
 await c.ready();
 try {await c.quoteAccountTransfer(1000,'to-bitcoin');assert.equal(submits,0);assert.equal(readBoardingRecord('profile'),undefined);assert.doesNotThrow(()=>assertNoPendingBoarding('profile'));}
 finally {c.dispose();}
});

test('interruption diagnostics survive reload but never authorize retry',()=>{
 for(const diagnostic of ['registration-unconfirmed','settlement-interrupted','deadline-exceeded']) {
  writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
  attempt.beforeRegister();attempt.registered('operator-intent');attempt.interrupted(diagnostic);attempt.close();
  assert.equal(readBoardingRecord('profile').diagnostic,diagnostic);assert.equal(readBoardingRecord('profile').status,'pending');
  assert.throws(()=>assertNoPendingBoarding('profile'));
 }
 const previous=readBoardingRecord('profile');
 for(const status of ['cancelled','expired','rejected','verified-failed']) {
  assert.throws(()=>writeBoardingRecord({...previous,status}));
  assert.deepEqual(readBoardingRecord('profile'),previous);
 }
 assert.throws(()=>writeBoardingRecord({...previous,diagnostic:'private response'}));
});

test('late interruption cannot change a replacement or completed record',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,'profile',()=>1000);
 writeBoardingRecord({...record(),id:'replacement'});attempt.interrupted('deadline-exceeded');
 assert.equal(readBoardingRecord('profile').diagnostic,undefined);
 writeBoardingRecord({...record(),status:'succeeded',commitmentTxid:commitment});attempt.interrupted('settlement-interrupted');
 assert.equal(readBoardingRecord('profile').diagnostic,undefined);
});

test('invalid operator schedules fail before submission',()=>{
 assert.throws(()=>settlementTimeoutMs({sessionDuration:-1n}));
 assert.throws(()=>settlementTimeoutMs({sessionDuration:9007199254740993n}));
});
