import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBoardingRecord,writeBoardingRecord,withWalletMutation,assertNoPendingBoarding,createBoardingAttempt,recoverPreparedBoarding} from '../src/core/boarding-record.ts';
import {verifiedBoardingCommitment} from '../src/core/boarding-reconciliation.ts';
import {settlementTimeoutMs} from '../src/core/boarding-status.ts';
const tx='a'.repeat(64), commitment='b'.repeat(64);
function record(profileId='profile') {return {version:1,id:'operation',profileId,status:'pending',phase:'prepared',inputs:[{txid:tx,vout:0}],bitcoinAddress:'tb1-test',quote:{profileId,direction:'to-arkade',amountSats:1000,feeSats:0,netSats:1000,maxSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)}};}
let values,locked,failWrite;
test.beforeEach(()=>{
 values=new Map();locked=false;failWrite=false;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failWrite)throw Error('quota');values.set(key,value);}}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,options,work)=>{assert.equal(name,'bis-signet-wallet-mutation');assert.equal(options.ifAvailable,true);if(locked)return work(null);locked=true;try{return await work({name});}finally{locked=false;}}}}});
});
test('prepared recovery is safe; its old registration callback cannot submit',async()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 await withWalletMutation(async()=>recoverPreparedBoarding(readBoardingRecord()));
 assert.equal(readBoardingRecord().status,'not-submitted');assert.doesNotThrow(assertNoPendingBoarding);
 assert.throws(()=>attempt.beforeRegister());
});
test('registration marker precedes network and unknown outcomes remain blocked after reload',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 attempt.beforeRegister();assert.equal(readBoardingRecord().phase,'submitting');
 assert.throws(()=>attempt.beforeRegister());attempt.close();
 const reloaded=JSON.parse([...values.values()][0]);
 assert.equal(recoverPreparedBoarding(reloaded).status,'pending');assert.throws(assertNoPendingBoarding);
});
test('confirmed registration and late commitment survive timeout; never permit automatic replay',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 attempt.beforeRegister();attempt.close();attempt.registered('operator-intent');attempt.committed(commitment);
 assert.equal(readBoardingRecord().intentId,'operator-intent');assert.equal(readBoardingRecord().commitmentTxid,commitment);
 assert.equal(readBoardingRecord().status,'pending');assert.throws(()=>attempt.beforeRegister());
});
test('timeout before registration and account replacement reject all late registration',()=>{
 for(const isCurrent of [()=>true,()=>false]) {
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',isCurrent,2000,()=>2000);
 assert.throws(()=>attempt.beforeRegister());attempt.close();assert.equal(readBoardingRecord().status,'not-submitted');
 }
});
test('unavailable/corrupt storage or failed write prevents registration',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 failWrite=true;assert.throws(()=>attempt.beforeRegister());assert.equal(readBoardingRecord().phase,'prepared');
 failWrite=false;const key=[...values.keys()][0];values.set(key,'{broken');assert.throws(readBoardingRecord);assert.throws(assertNoPendingBoarding);
 values.set(key,JSON.stringify({...record(),inputs:[]}));assert.throws(readBoardingRecord);
});
test('same-origin operations cannot overlap; pending records block another profile too',async()=>{
 let release;const barrier=new Promise(r=>release=r);
 const first=withWalletMutation(async()=>{writeBoardingRecord(record());await barrier;});
 await assert.rejects(withWalletMutation(async()=>{}),/Another wallet operation/);
 release();await first;
 await assert.rejects(withWalletMutation(async()=>assertNoPendingBoarding()),/unresolved/);
});
test('late result cannot alter a replacement operation',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 attempt.beforeRegister();writeBoardingRecord({...record('other'),id:'new-operation'});
 attempt.committed(commitment);attempt.close();assert.equal(readBoardingRecord().id,'new-operation');assert.equal(readBoardingRecord().commitmentTxid,undefined);
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
   submits++;assert.equal(isCurrent(),true);writeBoardingRecord({...record(),phase:'submitting'});await barrier;return readBoardingRecord();
 },reconcile:async()=>{reconciles++;return readBoardingRecord();}};
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
  assert.equal(submits,0);assert.throws(assertNoPendingBoarding);
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
 try {await c.quoteAccountTransfer(1000,'to-bitcoin');assert.equal(submits,0);assert.equal(readBoardingRecord(),undefined);assert.doesNotThrow(assertNoPendingBoarding);}
 finally {c.dispose();}
});

test('interruption diagnostics survive reload but never authorize retry',()=>{
 for(const diagnostic of ['registration-unconfirmed','settlement-interrupted','deadline-exceeded']) {
  writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
  attempt.beforeRegister();attempt.registered('operator-intent');attempt.interrupted(diagnostic);attempt.close();
  assert.equal(readBoardingRecord().diagnostic,diagnostic);assert.equal(readBoardingRecord().status,'pending');
  assert.throws(assertNoPendingBoarding);
 }
 const previous=readBoardingRecord();
 for(const status of ['cancelled','expired','rejected','verified-failed']) {
  assert.throws(()=>writeBoardingRecord({...previous,status}));
  assert.deepEqual(readBoardingRecord(),previous);
 }
 assert.throws(()=>writeBoardingRecord({...previous,diagnostic:'private response'}));
});

test('late interruption cannot change a replacement or completed record',()=>{
 writeBoardingRecord(record());const attempt=createBoardingAttempt('operation',()=>true,2000,()=>1000);
 writeBoardingRecord({...record(),id:'replacement'});attempt.interrupted('deadline-exceeded');
 assert.equal(readBoardingRecord().diagnostic,undefined);
 writeBoardingRecord({...record(),status:'succeeded',commitmentTxid:commitment});attempt.interrupted('settlement-interrupted');
 assert.equal(readBoardingRecord().diagnostic,undefined);
});

test('invalid operator schedules fail before submission',()=>{
 assert.throws(()=>settlementTimeoutMs({sessionDuration:-1n}));
 assert.throws(()=>settlementTimeoutMs({sessionDuration:9007199254740993n}));
});
