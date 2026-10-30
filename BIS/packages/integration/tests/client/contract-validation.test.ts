import test from 'node:test';
import assert from 'node:assert/strict';
import {contractNetworkSupport,contractValidationOptions,contractValidationDescription,selectContractValidation} from '../../src/client/state-layer-core/contract-validation.ts';
test('new offers expose Browser validation on both test networks with its actual limitations',()=>{
  for(const network of ['signet','mutinynet'] as const){
    assert.deepEqual(contractValidationOptions(network),['browser-policy-v1']);
    assert.equal(contractNetworkSupport(network).supported,true);
  }
  assert.equal(contractNetworkSupport(undefined).supported,false);
  assert.match(contractNetworkSupport(undefined).reason,/Choose a test network/);
  assert.match(contractValidationDescription('browser-policy-v1'),/Real Arkade/);
  assert.match(contractValidationDescription('browser-policy-v1'),/bypassed/);
  assert.match(contractValidationDescription('arkade-covenant-v2'),/not fully qualified/);
});
test('co-signer availability cannot promote or enable a stronger mode for new offers',()=>{
  for(const network of ['signet','mutinynet'] as const){
    for(const available of [false,true]){
      assert.equal(selectContractValidation(network,'auto',available),'browser-policy-v1');
      assert.equal(selectContractValidation(network,'browser-policy-v1',available),'browser-policy-v1');
      assert.throws(()=>selectContractValidation(network,'arkade-covenant-v2',available),/unavailable for new offers/);
    }
  }
});
