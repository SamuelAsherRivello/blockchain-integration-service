import test from 'node:test';
import assert from 'node:assert/strict';
import {hasLiveBoardingWait} from '../src/core/live-boarding-wait.ts';
const record={quote:{direction:'to-arkade'},inputs:[{txid:'deposit',vout:0}],commitmentTxid:'batch'};
const tx={txid:'batch',status:{confirmed:false},vin:[{txid:'deposit',vout:0}]};
test('F3 waits only on live unconfirmed spending of its boarding inputs',()=>{
 assert.equal(hasLiveBoardingWait([record],[]),false);
 assert.equal(hasLiveBoardingWait([record],[tx]),true);
 assert.equal(hasLiveBoardingWait([record],[{...tx,status:{confirmed:true}}]),false);
 assert.equal(hasLiveBoardingWait([record],[{...tx,vin:[{txid:'other',vout:0}]}]),false);
 assert.equal(hasLiveBoardingWait([{...record,quote:{direction:'to-bitcoin'}}],[tx]),false);
 assert.equal(hasLiveBoardingWait([record],[{...tx,status:{}}]),false);
});

 test('confirmed boarding requires fresh matching network evidence',async()=>{
 const {liveBoardingState}=await import('../src/core/live-boarding-wait.ts');
 assert.equal(liveBoardingState([record],[{...tx,status:{confirmed:true}}]),'boarded');
 assert.equal(liveBoardingState([record],[tx]),'waiting');
 assert.equal(liveBoardingState([record],[]),'unknown');
 assert.equal(liveBoardingState([] ,[]),'ready');
 assert.equal(liveBoardingState([record],[{...tx,status:{confirmed:true},vin:[]}]),'unknown');
 assert.equal(liveBoardingState([{...record,quote:{direction:'to-bitcoin'}}],[{...tx,status:{confirmed:true}}]),'ready');
 });
