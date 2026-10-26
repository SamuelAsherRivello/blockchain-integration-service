import test from 'node:test';
import assert from 'node:assert/strict';
import {contractValidationOptions,contractValidationDescription,selectContractValidation} from '../../src/client/state-layer-core/contract-validation.ts';
test('Admin exposes one Signet mode and two Mutinynet modes with clear defaults',()=>{
  assert.deepEqual(contractValidationOptions('signet'),['browser-policy-v1']);
  assert.deepEqual(contractValidationOptions('mutinynet'),['arkade-covenant-v2','browser-policy-v1']);
  assert.match(contractValidationDescription('browser-policy-v1'),/Real Arkade/);
  assert.match(contractValidationDescription('browser-policy-v1'),/bypassed/);
  assert.match(contractValidationDescription('arkade-covenant-v2'),/not fully qualified/);
});
test('automatic host policy selects the best preflight mode but explicit Admin choices stay explicit',()=>{
  assert.equal(selectContractValidation('mutinynet','auto',true),'arkade-covenant-v2');
  assert.equal(selectContractValidation('mutinynet','auto',false),'browser-policy-v1');
  assert.equal(selectContractValidation('signet','auto',false),'browser-policy-v1');
  assert.equal(selectContractValidation('mutinynet','browser-policy-v1',true),'browser-policy-v1');
  assert.throws(()=>selectContractValidation('signet','arkade-covenant-v2',true));
  assert.throws(()=>selectContractValidation('mutinynet','arkade-covenant-v2',false));
});
