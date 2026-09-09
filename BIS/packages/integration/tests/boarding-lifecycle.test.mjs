import test from 'node:test';
import assert from 'node:assert/strict';
import {writeBoardingRecord,readBoardingRecord,createBoardingAttempt,recordBoardingProgress} from '../src/core/boarding-record.ts';
import {runBoardingWorker,boardingWorkerActive} from '../src/core/boarding-execution.ts';
import {transferStatus,settlementDiagnostic,formatTransferRecoveryReport} from '../src/core/boarding-status.ts';
const quote={profileId:'lifecycle',direction:'to-bitcoin',amountSats:1000,feeSats:0,netSats:1000,maxSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)};
test.beforeEach(()=>{
 const values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
 writeBoardingRecord({version:1,id:'operation',profileId:'lifecycle',status:'pending',phase:'prepared',quote,inputs:[{txid:'a'.repeat(64),vout:0}],bitcoinAddress:'tb1-test'});
});
test('interrupted signing must not continue to present as actively registered',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');attempt.interrupted('settlement-interrupted');attempt.close();
 const status=transferStatus(readBoardingRecord('lifecycle'));
 assert.equal(status.status,'pending');assert.equal(status.execution,'interrupted');
 assert.equal(status.stage,'registered');assert.equal(status.commitmentTxid,undefined);
});
test('legacy registration never claims a live worker',()=>{
 writeBoardingRecord({...readBoardingRecord('lifecycle'),phase:'registered',intentId:'legacy'});
 const status=transferStatus(readBoardingRecord('lifecycle'));
 assert.equal(status.execution,'unknown');assert.equal(status.stage,'registered');
});
test('SDK interruption classification projects codes without raw error payloads',()=>{
 const error=new Error('PRIVATE_SENTINEL');error.name='ServerResponseMismatchError';
 assert.equal(settlementDiagnostic(error),'response-mismatch');
 assert.equal(settlementDiagnostic(new Error('event stream closed')),'event-stream-closed');
 assert.equal(settlementDiagnostic(new Error('PRIVATE_SENTINEL')),'settlement-interrupted');
 const report=formatTransferRecoveryReport({status:'pending',diagnostic:settlementDiagnostic(error)});
 assert.match(report,/mismatching operator response/);assert.ok(!report.includes('PRIVATE_SENTINEL'));
});

test('failure detail survives reload with the last observed signing boundary',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');
 recordBoardingProgress('lifecycle','operation','batch-selected','running','validate-tree',1000);
 attempt.interrupted('settlement-interrupted',new Error('Sweep tap tree root not set'));
 const status=transferStatus(readBoardingRecord('lifecycle'));
 assert.deepEqual(status.failure,{code:'sweep-root-missing',stage:'batch-selected',action:'validate-tree',observedAt:1000,endReason:'settlement-interrupted'});
 assert.match(formatTransferRecoveryReport(status),/Sweep tree initialization missing/);
 assert.equal(status.status,'pending');assert.equal(status.commitmentTxid,undefined);
});

test('asset index mismatch retains a specific safe code instead of losing the validator reason',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');
 const error=new Error(`asset output not found in asset group ${'a'.repeat(64)}0000 at index 0`);error.name='ServerResponseMismatchError';
 attempt.interrupted('response-mismatch',error);
 assert.equal(readBoardingRecord('lifecycle').failure.code,'asset-output-missing');
 assert.ok(!JSON.stringify(readBoardingRecord('lifecycle').failure).includes('a'.repeat(64)));
 error.message+=' PRIVATE_SENTINEL';attempt.interrupted('response-mismatch',error);
 assert.equal(readBoardingRecord('lifecycle').failure.code,'response-mismatch');
 assert.ok(!JSON.stringify(readBoardingRecord('lifecycle').failure).includes('PRIVATE_SENTINEL'));
});

test('failure metadata is an allowlisted projection, including adversarial payloads',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');
 const error=new Error('PRIVATE_SENTINEL');error.proof='PRIVATE_SENTINEL';
 attempt.interrupted('settlement-interrupted',error);
 assert.equal(readBoardingRecord('lifecycle').failure.code,'unknown');
 const record=readBoardingRecord('lifecycle');
 writeBoardingRecord({...record,failure:{...record.failure,proof:'PRIVATE_SENTINEL'}});
 assert.ok(!localStorage.getItem(localStorage.key(0)).includes('PRIVATE_SENTINEL'));
 assert.ok(!formatTransferRecoveryReport({...transferStatus(record),failure:{code:'PRIVATE_SENTINEL',action:'PRIVATE_SENTINEL',observedAt:Infinity}}).includes('PRIVATE_SENTINEL'));
 writeBoardingRecord({...record,failure:{code:'unknown',stage:'PRIVATE_SENTINEL',observedAt:1000}});
 assert.equal(readBoardingRecord('lifecycle').failure,undefined);
 const hostile=new Error();Object.defineProperty(hostile,'message',{get(){throw Error('PRIVATE_SENTINEL');}});
 assert.doesNotThrow(()=>attempt.interrupted('settlement-interrupted',hostile));
 assert.equal(readBoardingRecord('lifecycle').failure.code,'unknown');
});

test('failure provenance contains only valid public SDK and batch identifiers',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');
 const batchId='11111111-1111-4111-8111-111111111111';
 attempt.interrupted('event-stream-closed',new Error('event stream closed'),{sdkVersion:'0.4.67',batchId});
 const report=formatTransferRecoveryReport(transferStatus(readBoardingRecord('lifecycle')));
 assert.match(report,/Arkade SDK: 0.4.67/);assert.ok(report.includes(batchId));
 attempt.interrupted('settlement-interrupted',new Error('Shared output not found'),{sdkVersion:'PRIVATE_SENTINEL',batchId:'PRIVATE_SENTINEL'});
 const failure=readBoardingRecord('lifecycle').failure;
 assert.equal(failure.code,'shared-output-missing');assert.equal(failure.sdkVersion,undefined);
 assert.ok(!JSON.stringify(failure).includes('PRIVATE_SENTINEL'));
});
test('late lower-stage observations cannot erase broadcast evidence',()=>{
 const attempt=createBoardingAttempt('operation',()=>true,2000,'lifecycle',()=>1000);
 attempt.beforeRegister();attempt.registered('intent');attempt.committed('b'.repeat(64));
 recordBoardingProgress('lifecycle','operation','signing','running','tree-signatures',900);
 attempt.interrupted('settlement-interrupted');
 const status=transferStatus(readBoardingRecord('lifecycle'));
 assert.equal(status.stage,'broadcast');assert.equal(status.execution,'awaiting-confirmation');
 assert.equal(status.commitmentTxid,'b'.repeat(64));
});
test('session worker outlives foreground reads and rejects duplicate ownership',async()=>{
 let finish;let starts=0;
 const worker=runBoardingWorker('lifecycle','operation',()=>{starts++;return new Promise(resolve=>{finish=resolve;});});
 await Promise.resolve();
 for(let i=0;i<3;i++)assert.equal(transferStatus(readBoardingRecord('lifecycle')).execution,'running');
 await assert.rejects(runBoardingWorker('lifecycle','operation',async()=>{starts++;}),/already processing/);
 assert.equal(starts,1);assert.equal(boardingWorkerActive('lifecycle','operation'),true);
 finish();await worker;
 assert.equal(boardingWorkerActive('lifecycle','operation'),false);
 assert.equal(transferStatus(readBoardingRecord('lifecycle')).execution,'unknown');
});
test('rejected background worker relinquishes active ownership',async()=>{
 await assert.rejects(runBoardingWorker('lifecycle','operation',async()=>{throw Error('fixture');}),/fixture/);
 assert.equal(boardingWorkerActive('lifecycle','operation'),false);
});
test('progress is operation-specific and timestamps do not regress',()=>{
 writeBoardingRecord({...readBoardingRecord('lifecycle'),id:'second'});
 recordBoardingProgress('lifecycle','operation','signing','running','tree-nonces',1500);
 recordBoardingProgress('lifecycle','operation','signing','running','tree-signatures',1000);
 assert.equal(readBoardingRecord('lifecycle','operation').progress.observedAt,1500);
 assert.equal(readBoardingRecord('lifecycle','second').progress,undefined);
});
