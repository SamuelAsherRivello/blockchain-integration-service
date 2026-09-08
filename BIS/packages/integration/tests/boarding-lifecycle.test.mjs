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
