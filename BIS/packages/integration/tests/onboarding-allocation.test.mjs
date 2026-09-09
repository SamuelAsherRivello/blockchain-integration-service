import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOnboarding} from '../src/core/onboarding-allocation.ts';
const scope={profileId:'player',network:'signet',operator:'https://signet.arkade.sh'};
const script='5120'+'d'.repeat(64);
const coin=(n,value,extra={})=>({txid:n.repeat(64),vout:0,value,confirmed:true,expired:false,reserved:false,...extra});
const snapshot=(extra={})=>({...scope,complete:true,boarding:[],spendable:[],unresolvedOnboarding:false,
  policy:{zeroFees:true,arkadeMinimum:330,bitcoinMinimum:330,arkadeMaximum:0,bitcoinMaximum:0},bitcoinScript:script,arkadeScript:script,...extra});
test('empty and undersized funding wait without inventing a transfer',()=>{
  assert.equal(assessOnboarding(scope,snapshot()).status,'funding-needed');
  assert.equal(assessOnboarding(scope,snapshot({boarding:[coin('a',659)]})).status,'funding-needed');
});
test('confirmed eligible set is sorted and frozen with exact floor rounding',()=>{
  const s=snapshot({boarding:[coin('b',11111),coin('a',890),coin('c',9999,{confirmed:false}),coin('e',2000,{reserved:true}),coin('f',2000,{expired:true})]});
  const result=assessOnboarding(scope,s);
  assert.equal(result.status,'ready');
  assert.deepEqual(result.plan.inputs.map(c=>c.txid),['a'.repeat(64),'b'.repeat(64)]);
  assert.equal(result.plan.totalSats,12001);assert.equal(result.plan.targetSats,6000);assert.equal(result.plan.returnSats,6001);
  s.boarding[0].value=1;assert.equal(result.plan.inputs[1].value,11111);
});
test('pending and completed journals take priority over later funding and spent balances',()=>{
  const base={...scope,version:1,id:'parent',revision:1,allocationPercent:50,createdAt:10};
  assert.equal(assessOnboarding(scope,snapshot(),{...base,status:'pending'}).status,'resume');
  assert.equal(assessOnboarding(scope,snapshot({boarding:[coin('a',10000)]}),{...base,status:'complete',readyReason:'existing-funds',completedAt:20}).status,'complete');
});
test('existing fresh independent funds qualify without treating reserved funds as ready',()=>{
  assert.equal(assessOnboarding(scope,snapshot({spendable:[coin('a',500)]})).status,'already-ready');
  assert.equal(assessOnboarding(scope,snapshot({spendable:[coin('a',500,{reserved:true})]})).status,'funding-needed');
  assert.equal(assessOnboarding(scope,snapshot({spendable:[coin('a',500)],unresolvedOnboarding:true})).status,'reconcile');
});
test('incomplete wrong-account and invalid data cannot become zero or a ready plan',()=>{
  for(const s of [snapshot({complete:false}),snapshot({profileId:'other'}),snapshot({boarding:[coin('a',NaN)]}),snapshot({boarding:[coin('a',1000),coin('a',1000)]})])
    assert.equal(assessOnboarding(scope,s).status,'unavailable');
});
test('operator limits and nonzero fees never silently shrink the full allocation',()=>{
  const s=snapshot({boarding:[coin('a',10000)]});
  assert.equal(assessOnboarding(scope,{...s,policy:{...s.policy,zeroFees:false}}).status,'unsupported');
  assert.equal(assessOnboarding(scope,{...s,policy:{...s.policy,arkadeMaximum:6000}}).status,'unsupported');
  assert.equal(assessOnboarding(scope,{...s,policy:{...s.policy,bitcoinMaximum:4000}}).status,'unsupported');
});
