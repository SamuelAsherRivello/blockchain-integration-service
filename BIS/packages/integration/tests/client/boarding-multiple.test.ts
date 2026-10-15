import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoardingRecord,writeBoardingRecord,assertNoPendingBoarding,createBoardingAttempt,assertPendingTransfersAcknowledged,recordBoardingProgress,withBoardingRecordLock} from '../../src/client/state-layer-core/boarding-record.ts';

function record(id,amountSats=1000) {return {version:1,id,profileId:'p',status:'pending',phase:'registered',intentId:id,inputs:[{txid:(id==='first'?'a':'b').repeat(64),vout:0}],bitcoinAddress:'tb1-test',quote:{profileId:'p',direction:'to-bitcoin',amountSats,feeSats:0,netSats:amountSats,maxSats:2000,bitcoinAfterSats:amountSats,arkadeAfterSats:2000-amountSats,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)}};}
test.beforeEach(()=>{
 const values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
});
test('a second transfer retains the first pending transfer and its independent status',()=>{
 writeBoardingRecord(record('first'));writeBoardingRecord({...record('second'),status:'succeeded',commitmentTxid:'d'.repeat(64)});
 assert.equal(readBoardingRecord('p','first').id,'first');
 assert.equal(readBoardingRecord('p','first').status,'pending');
 assert.equal(readBoardingRecord('p','second').status,'succeeded');
 assert.throws(()=>assertNoPendingBoarding('p'),/unresolved/);
});
test('late updates are addressed to their own transfer after a newer transfer starts',()=>{
 writeBoardingRecord({...record('first'),phase:'prepared',intentId:undefined});
 const first=createBoardingAttempt('first',()=>true,2000,'p',()=>1000);first.beforeRegister();
 writeBoardingRecord(record('second'));
 first.registered('first-intent');first.committed('e'.repeat(64));first.close();
 assert.equal(readBoardingRecord('p','first').intentId,'first-intent');
 assert.equal(readBoardingRecord('p','second').commitmentTxid,undefined);
});
test('every additional transfer requires acknowledgement of all currently pending transfers in either direction',()=>{
 writeBoardingRecord(record('first'));
 assert.throws(()=>assertPendingTransfersAcknowledged('p'),/Pending transfers changed/);
 assert.doesNotThrow(()=>assertPendingTransfersAcknowledged('p',['first']));
 writeBoardingRecord({...record('second'),quote:{...record('second').quote,direction:'to-arkade'}});
 assert.throws(()=>assertPendingTransfersAcknowledged('p',['first']),/Pending transfers changed/);
 assert.doesNotThrow(()=>assertPendingTransfersAcknowledged('p',['first','second']));
 assert.throws(()=>assertPendingTransfersAcknowledged('p'),/Pending transfers changed/);
});

for(const network of ['signet','mutinynet'])test(`${network} attempt updates only its original journal with a colliding ID on the other network`,()=>{
 const other=network==='signet'?'mutinynet':'signet';
 const initial={...record('first'),network,phase:'prepared',intentId:undefined};
 writeBoardingRecord(initial);writeBoardingRecord({...initial,network:other});
 const untouched=JSON.stringify(readBoardingRecord('p','first',other));
 let now=1000;
 const attempt=createBoardingAttempt('first',()=>true,2000,'p',()=>now,network);
 attempt.beforeRegister();assert.equal(readBoardingRecord('p','first',network).phase,'submitting');
 attempt.registered('original-intent');now++;
 recordBoardingProgress('p','first','signing','running','tree-signatures',now,network);
 attempt.interrupted('settlement-interrupted',Error('private-sentinel'));
 assert.equal(readBoardingRecord('p','first',network).progress.execution,'interrupted');
 attempt.committed('d'.repeat(64));attempt.close();
 const result=readBoardingRecord('p','first',network);
 assert.equal(result.intentId,'original-intent');assert.equal(result.commitmentTxid,'d'.repeat(64));
 assert.equal(result.progress.stage,'broadcast');assert.equal(result.phase,'registered');
 assert.equal(JSON.stringify(readBoardingRecord('p','first',other)),untouched);
 assert.equal(JSON.stringify(result).includes('private-sentinel'),false);
});

test('prepared recovery and pending acknowledgements are network scoped',()=>{
 writeBoardingRecord({...record('first'),network:'mutinynet',phase:'prepared',intentId:undefined});
 assert.doesNotThrow(()=>assertPendingTransfersAcknowledged('p',[],'signet'));
 assert.throws(()=>assertPendingTransfersAcknowledged('p',[],'mutinynet'),/Pending transfers changed/);
 assert.doesNotThrow(()=>assertPendingTransfersAcknowledged('p',['first'],'mutinynet'));
 createBoardingAttempt('first',()=>true,2000,'p',()=>1000,'mutinynet').close();
 assert.equal(readBoardingRecord('p','first','mutinynet').status,'not-submitted');
 assert.equal(readBoardingRecord('p','first','signet'),undefined);
});

test('transfer record locks separate the same public identity and operation on both networks',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks'),keys=[];
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(key,_options,work)=>{keys.push(key);return work();}}});
 try {
  for(const network of ['signet','mutinynet'])assert.equal(await withBoardingRecordLock('p','first',()=>42,network),42);
  assert.deepEqual(keys,['bis-signet-transfer-record:p:first','bis-mutinynet-transfer-record:p:first']);
 }finally{if(descriptor)Object.defineProperty(globalThis.navigator,'locks',descriptor);else delete globalThis.navigator.locks;}
});
