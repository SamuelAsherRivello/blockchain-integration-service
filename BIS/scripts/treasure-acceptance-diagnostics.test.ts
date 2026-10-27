import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAcceptanceFailure,publicAcceptanceUiError,publicAcceptanceBrowserFailure} from './treasure-acceptance-diagnostics.ts';

test('acceptance failures never echo code-shaped secrets, raw messages, signed data or unknown properties',()=>{
  const canary='test-only-private-token';
  const error={name:canary,code:canary,message:`Failed to fetch ${canary}`,request:{signedArkTx:canary},stack:canary};
  const result=publicAcceptanceFailure(error);
  assert.equal(result.reason,'live-admin-acceptance-incomplete');
  assert.deepEqual(result.errorFlags,['Failed to fetch']);
  assert.equal(JSON.stringify(result).includes(canary),false);
  for(const value of [null,undefined,canary,{},42])assert.equal(publicAcceptanceFailure(value).reason,'live-admin-acceptance-incomplete');
});

test('fixed preflight and original-recovery reasons remain useful without exposing attached private errors',()=>{
  for(const code of ['vault-protection-unavailable','test-identity-reserved','coordinator-financial-slot-required','player-not-empty',
    'game-not-empty','asset-carrier-only-precondition','original-admin-run-requires-reconciliation','original-operation-observation-timeout']){
    assert.equal(publicAcceptanceFailure({code,message:'test-only-private-token'}).reason,code);
    assert.equal(publicAcceptanceFailure(new Error(code)).reason,code);
  }
  const timed=publicAcceptanceFailure({name:'TimeoutError',message:'Content Security Policy test-only-private-token'});
  assert.equal(timed.timeout,true);assert.deepEqual(timed.errorFlags,['Content Security Policy']);
  assert.equal(JSON.stringify(timed).includes('test-only-private-token'),false);
});

test('UI classifications expose flags without extracted identifiers, property names or custom error names',()=>{
  const canary='testOnlyPrivateIdentifier';
  for(const message of [`${canary} is not defined`,`Cannot read properties of undefined (reading '${canary}')`]){
    const result=publicAcceptanceUiError(message,canary);
    assert.equal(result.name,'other');assert.equal(JSON.stringify(result).includes(canary),false);
    assert.ok(result.flags['is not defined']||result.flags['Cannot read properties']);
  }
  assert.equal(publicAcceptanceUiError('failure','ReferenceError').name,'ReferenceError');
  assert.equal(publicAcceptanceUiError(null).name,'console-error');
});

test('owned-browser failure projection drops private fields and allows only known stages and flags',()=>{
  const canary='test-only-private-token';
  const input={stage:canary,errorType:canary,code:canary,timeout:true,flags:['CSP',canary,'CSP'],undefinedName:canary,
    phrase:canary,request:{signedArkTx:canary}};
  assert.deepEqual(publicAcceptanceBrowserFailure(input),{stage:'other',timeout:true,errorType:'other',flags:['CSP']});
  const known=publicAcceptanceBrowserFailure({...input,stage:'private-clear',errorType:'TypeError',code:'vault-locked'});
  assert.deepEqual(known,{stage:'private-clear',timeout:true,errorType:'TypeError',code:'vault-locked',flags:['CSP']});
  assert.equal(JSON.stringify(known).includes(canary),false);
  assert.deepEqual(publicAcceptanceBrowserFailure(null),{stage:'other',timeout:false,errorType:'other',flags:[]});
});

test('owned-browser operator transport diagnostics retain only fixed endpoint, status and error classes',()=>{
  const secret='private-address-or-token';
  const result=publicAcceptanceBrowserFailure({stage:'server-game-identity',operatorRequests:[
    {kind:'failed',path:'/v1/info',errorClass:'network',body:secret},
    {kind:'http',path:'/v1/info',status:503,body:secret},
    {kind:'http',path:`/${secret}`,status:200},
    {kind:'failed',path:'/v1/info',errorClass:secret},
  ]});
  assert.deepEqual(result.operatorRequests,[{kind:'failed',endpoint:'info',errorClass:'network'},
    {kind:'http',endpoint:'info',status:503},{kind:'http',endpoint:'other'},
    {kind:'failed',endpoint:'info'}]);
  assert.equal(JSON.stringify(result).includes(secret),false);
});

test('diagnostic projection does not enumerate or read unrelated private properties',()=>{
  const input={name:'Error',code:'vault-locked',message:'original error'};
  Object.defineProperty(input,'phrase',{enumerable:true,get(){throw Error('must not read private input');}});
  Object.defineProperty(input,'signedArkTx',{enumerable:true,get(){throw Error('must not read signed request');}});
  assert.equal(publicAcceptanceFailure(input).reason,'vault-locked');
  assert.doesNotThrow(()=>publicAcceptanceBrowserFailure(input));
});
