import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingReadiness,onboardingStage} from '../../src/client/state-layer-core/onboarding-stage.ts';

const view=(extra={})=>({status:'start',detail:'fixture',transactions:[],...extra});
const balance=(extra={})=>({status:'ready',availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0,...extra});

test('onboarding stages are ordered by the strongest observed account state',()=>{
  assert.equal(onboardingStage(view(),balance()),1);
  assert.equal(onboardingStage(view(),balance({totalSats:100})),1);
  assert.equal(onboardingStage(view({transactions:[{txid:'a',confirmed:false,value:1,kind:'incoming'}]}),balance()),2);
  assert.equal(onboardingStage(view(),balance({bitcoinSats:100,totalSats:100})),2);
  assert.equal(onboardingStage(view({record:{status:'pending',plan:{}}}),balance()),3);
  assert.equal(onboardingStage(view({record:{status:'pending',plan:{},returning:{phase:'receipt-verified'}}}),balance()),4);
  assert.equal(onboardingStage(view({record:{status:'complete'}}),balance()),5);
  assert.equal(onboardingStage(view(),balance({availableSats:100,totalSats:100,arkadeSats:100})),5);
  assert.deepEqual(onboardingReadiness(view(),balance({availableSats:100,totalSats:100,arkadeSats:100})),{stage:5,label:'Complete'});
  assert.deepEqual(onboardingReadiness(view(),balance({bitcoinSats:100,totalSats:100})),{stage:2,label:'Pending'});
  assert.deepEqual(onboardingReadiness(view(),balance()),{stage:1,label:'Start?'});
});
