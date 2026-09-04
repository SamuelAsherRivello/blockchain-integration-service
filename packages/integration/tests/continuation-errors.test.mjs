import test from 'node:test';
import assert from 'node:assert/strict';
import {sendAmounts} from '../src/core/sending.ts';
import {continueResult} from '../src/core/continuation.ts';
import {reconcileContinuation} from '../src/arkade/continuation.ts';
const request={operationId:'old-failure',sats:1000,context:'original-run'};
test('valid 1000-sat price reports eligible available and required funds separately from total',()=>{
 assert.throws(()=>sendAmounts(0,1000,330),{message:'Insufficient eligible spendable funds: 0 sats available; 1,000 sats required. Total balance may include ineligible outputs.'});
});
test('invalid amounts, operator minimum and subdust change retain distinct explanations',()=>{
 assert.throws(()=>sendAmounts(5000,1000.5,330),/positive whole-sats amount/);
 assert.throws(()=>sendAmounts(5000,1000,1500),/operator minimum is 1,500 sats/);
 assert.throws(()=>sendAmounts(1100,1000,330),/remaining change is below the minimum/);
});
test('legacy failed result displays corrected validation explanation without mutating history or touching network',async t=>{
 const record={request,profileId:'player',status:'failed',message:'Enter an affordable whole-sats amount above the minimum.'};
 const original=JSON.stringify(record);
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Must not fetch or submit for historical failure');});
 const result=await reconcileContinuation({profileId:'player',phrase:'fixture-only'},record,new AbortController().signal);
 assert.equal(result.message,'Insufficient eligible spendable funds for this 1,000-sat payment. No payment was submitted. Total balance may include ineligible outputs.');
 assert.equal(result.status,'failed');assert.equal(result.operationId,request.operationId);assert.equal(JSON.stringify(record),original);
});
test('specific current failure explanations are preserved',()=>{
 const message='The remaining change is below the minimum. Use Max or a smaller amount.';
 assert.equal(continueResult({request,profileId:'player',status:'failed',message}).message,message);
});
