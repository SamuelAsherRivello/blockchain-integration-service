import test from 'node:test';
import assert from 'node:assert/strict';
import * as status from '../src/core/boarding-status.ts';

const operationId='43eb8d6e-a4a0-403f-b759-44cdb0673ef3';
const intentId='21bb686b-ef2e-4654-87eb-999e3e9ee716';
const pending={status:'pending',phase:'registered',direction:'to-bitcoin',amountSats:1000,operationId,intentId,verification:'live'};
const report = value => {assert.equal(typeof status.formatTransferRecoveryReport,'function','recovery report formatter exists');return status.formatTransferRecoveryReport(value);};

test('pending report contains exact public identifiers, facts and investigation questions',()=>{
 const result=report(pending);
 for(const text of ['Network: Signet','Direction: Arkade → Bitcoin','Amount: 1000 sats',operationId,intentId,'Recorded phase: Registered','Verification: Latest check returned; completion remains unverified','batch/commitment outcome','cannot subsequently settle','Do not resubmit','not proof of cancellation'])assert.ok(result.includes(text),text);
 assert.match(report({...pending,direction:'to-arkade',commitmentTxid:'a'.repeat(64)}),/Direction: Bitcoin → Arkade/);
 assert.ok(report({...pending,commitmentTxid:'a'.repeat(64)}).includes('a'.repeat(64)));
});
test('unavailable and missing data never claim live verification or invented facts',()=>{
 assert.match(report({...pending,verification:'unavailable'}),/Verification: Unavailable/);
 const result=report({status:'pending'});
 for(const field of ['Direction','Amount','Transfer ID','Operator intent','Recorded phase','Verification'])assert.ok(result.includes(`${field}: Unknown`),field);
 assert.match(result,/Bitcoin transaction: Not recorded/);
});
test('report projects allowlisted data and rejects malformed values without leaking raw strings',()=>{
 const secret='PRIVATE_SENTINEL';
 const result=report({...pending,phase:secret,direction:secret,diagnostic:secret,verification:secret,operationId:secret,intentId:secret,commitmentTxid:secret,amountSats:-1,phrase:secret,rawError:secret,bitcoinAddress:secret,balance:secret});
 assert.ok(!result.includes(secret));assert.ok(!result.includes('-1 sats'));
 for(const amountSats of [NaN,Infinity,0,1.5,Number.MAX_SAFE_INTEGER+1])assert.match(report({...pending,amountSats}),/Amount: Unknown/);
});
test('terminal or absent operations never generate pending recovery reports',()=>{
 for(const state of ['idle','succeeded','not-submitted',undefined])assert.equal(report({status:state}),'');
});
