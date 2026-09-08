import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoardingRecord,writeBoardingRecord,assertNoPendingBoarding,createBoardingAttempt,assertPendingTransfersAcknowledged} from '../src/core/boarding-record.ts';

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
