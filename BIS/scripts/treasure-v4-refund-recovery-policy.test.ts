import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV4RefundRecoveryAdmission,type RefundRecoveryOperation,type RefundRecoveryRun} from './treasure-v4-refund-recovery-policy.ts';

const runId='treasure-b2-261026-1125',fundingTxid='ab'.repeat(32),gameProfileId='profile-game';
const now=1_800_000_000_000;
function fixture():{runId:string;now:number;run:RefundRecoveryRun;fundingOperation:RefundRecoveryOperation;
  refundOperation:RefundRecoveryOperation|undefined;gameProfileId:string;hasConflictingOperation:boolean}{
  const run:RefundRecoveryRun={artifactVersion:4,network:'mutinynet',scenario:'b2',pair:'treasure-empty-game-mutinynet',
    sourceSha256:'f702ab5e51b7e2836d95dbb9f01a0d402ec087974a707ad77d34d6c72f813bae',
    phase:'stopped-fund',outcome:'original-unresolved',game:gameProfileId,deadlineMs:now-1,
    reconciliationAtMs:now-2,fundingTxid};
  const fundingOperation:RefundRecoveryOperation={state:'settled',providerId:fundingTxid,intent:{id:`${runId}-fund`,kind:'arkade-send',amountSats:1000,feeSats:0}};
  return {runId,now,run,fundingOperation,refundOperation:undefined,gameProfileId,hasConflictingOperation:false};
}

test('admits only the reconciled, expired, settled and exact original B2 funding output',()=>{
  assert.deepEqual(assertV4RefundRecoveryAdmission(fixture()),{runId,fundingTxid,operationId:`${runId}-refund`,deadlineMs:now-1});
});

test('allows only an unsubmitted prepared refund reservation to resume',()=>{
  const input=fixture();input.refundOperation={state:'prepared',intent:{id:`${runId}-refund`,kind:'refund',amountSats:1000,feeSats:0}};
  assert.equal(assertV4RefundRecoveryAdmission(input).operationId,`${runId}-refund`);
});

test('rejects a changed run, unexpired offer, altered funding or any previous spend binding',()=>{
  const changes=[
    {run:{...fixture().run,sourceSha256:'00'.repeat(32)}},
    {run:{...fixture().run,outcome:'verified-b2-payout'}},
    {run:{...fixture().run,deadlineMs:now+1}},
    {run:{...fixture().run,fundingTxid:'cd'.repeat(32)}},
    {run:{...fixture().run,binding:{}}},
    {run:{...fixture().run,stage:{}}},
    {run:{...fixture().run,spendTxid:'cd'.repeat(32)}},
    {run:{...fixture().run,receipt:{}}},
  ];
  for(const change of changes)assert.throws(()=>assertV4RefundRecoveryAdmission({...fixture(),...change}));
});

test('rejects any unsettled original funding operation or competing account operation',()=>{
  const input=fixture();input.fundingOperation={...input.fundingOperation!,state:'pending'};
  assert.throws(()=>assertV4RefundRecoveryAdmission(input));
  assert.throws(()=>assertV4RefundRecoveryAdmission({...fixture(),hasConflictingOperation:true}));
});

test('never resumes a submitted, unknown, settled or altered refund reservation',()=>{
  for(const state of ['submitting','pending','unknown','settled','failed','cancelled']){
    const input=fixture();input.refundOperation={state,providerId:state==='prepared'?undefined:'ef'.repeat(32),
      intent:{id:`${runId}-refund`,kind:'refund',amountSats:1000,feeSats:0}};
    assert.throws(()=>assertV4RefundRecoveryAdmission(input));
  }
  const altered=fixture();altered.refundOperation={state:'prepared',intent:{id:`${runId}-refund`,kind:'refund',amountSats:5000,feeSats:0}};
  assert.throws(()=>assertV4RefundRecoveryAdmission(altered));
});
