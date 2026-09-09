import test from 'node:test';
import assert from 'node:assert/strict';
import {MnemonicIdentity,SingleKey,CSVMultisigTapscript,RestArkProvider,RestIndexerProvider,VtxoScript} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {prepareLtoRecovery,submitLtoSpend,reconcileLtoSpend,resumeLtoFinalization} from '../src/arkade/lto-contract.ts';
import {startLto,emptyContractLedger,beginContractOperation} from '../src/core/contracts.ts';

async function fixture(t){
  // Public, unfunded deterministic test identities. Every network boundary is mocked.
  const keys=[1,2,3].map(n=>SingleKey.fromPrivateKey(new Uint8Array(32).fill(n)));
  const operator=await keys[0].xOnlyPublicKey(),game={profileId:'game',phrase:'test-game'},player={profileId:'player',phrase:'test-player'};
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected test network');});
  t.mock.method(MnemonicIdentity,'fromMnemonic',phrase=>phrase==='test-game'?keys[1]:keys[2]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  const state={fee:'0',calls:0,coins:[],saved:[],evidence:false};
  const info={network:'signet',fees:{txFeeRate:'0',intentFee:{}},signerPubkey:hex.encode(operator),unilateralExitDelay:512n,vtxoMinAmount:1n,vtxoMaxAmount:0n,
    checkpointTapscript:hex.encode(CSVMultisigTapscript.encode({pubkeys:[operator],timelock:{type:'seconds',value:512n}}).script)};
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({...info,fees:{...info.fees,txFeeRate:state.fee}}));
  t.mock.method(RestArkProvider.prototype,'submitTx',async()=>{state.calls++;assert.ok(state.saved.at(-1).record.operation.submission==='submitted');throw Error('Acknowledgement lost');});
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async query=>{
    if(query.scripts)return {vtxos:state.coins};
    const spend=state.saved.at(-1)?.recovery.spend;
    if(!state.evidence||!spend)return {vtxos:[]};
    return {vtxos:query.outpoints[0].txid===spend.transactionId?
      [{txid:spend.transactionId,vout:0,value:1000,script:spend.destinationScript},...(spend.change?[{txid:spend.transactionId,vout:1,value:spend.change.value,script:spend.change.script}]:[])]:
      spend.inputs.map(input=>({...input,spentBy:'ef'.repeat(32),arkTxId:spend.transactionId}))};
  });
  const recovery=await prepareLtoRecovery(game,player);
  state.coins=[{txid:'ab'.repeat(32),vout:0,value:2000,script:hex.encode(VtxoScript.decode(hex.decode(recovery.gameScript)).pkScript)}];
  const now=Date.now(),record=startLto(emptyContractLedger(),{id:'contract',sessionId:'session',operationId:'fund',purpose:'test',hostReference:'test',amountSats:1000,startedAt:now,expiresAt:now+90000,scope:{playerId:'player',gameId:'game',operator:'https://signet.arkade.sh',network:'signet',exclusivityKey:'test'}},now).contract;
  return {state,game,player,record,recovery,commit:async(record,recovery)=>state.saved.push({record,recovery})};
}
test('changed fees, insufficient eligible funds and a replaced account are explicitly not submitted',async t=>{
  const f=await fixture(t);
  for(const kind of ['fees','assets','account']){
    f.state.fee=kind==='fees'?'1':'0';f.state.coins[0].assets=kind==='assets'?[{assetId:'asset'}]:[];
    const result=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>kind!=='account');
    assert.equal(result.record.operation.submission,'not-submitted');assert.equal(f.state.calls,0);
    assert.equal(result.record.operation.failure,{fees:'fee-change',assets:'invalid-assets',account:'account-changed'}[kind]);
  }
});
test('real SDK construction journals exact inputs/change before a lost submission and reconciles only receipt evidence',async t=>{
  const f=await fixture(t);
  const unknown=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>true);
  assert.equal(f.state.calls,1);assert.equal(unknown.record.financial,'unknown');
  assert.equal(unknown.recovery.spend.change.value,1000);
  assert.equal((await reconcileLtoSpend(unknown.record,unknown.recovery)).record.financial,'unknown');
  f.state.evidence=true;const funded=await reconcileLtoSpend(unknown.record,unknown.recovery);
  assert.equal(funded.record.financial,'funded');assert.equal(funded.recovery.fundingOutput.txid,unknown.recovery.spend.transactionId);
});
test('finalization recovery retries exactly the journaled transaction and never submits a competing spend',async t=>{
  const f=await fixture(t);const unknown=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>true);
  const material={...unknown.recovery,finalization:{transactionId:unknown.recovery.spend.transactionId,checkpoints:['dGVzdA==']}};
  let finalized=0;t.mock.method(RestArkProvider.prototype,'finalizeTx',async(id,checkpoints)=>{finalized++;assert.equal(id,material.spend.transactionId);assert.deepEqual(checkpoints,material.finalization.checkpoints);});
  f.state.evidence=true;const result=await resumeLtoFinalization(unknown.record,material);
  assert.equal(result.record.financial,'funded');assert.equal(finalized,1);assert.equal(f.state.calls,1);
  const claim=beginContractOperation(result.record,'claim','claim',Date.now());
  assert.throws(()=>beginContractOperation({...claim,financial:'unknown',operation:{...claim.operation,submission:'unknown'}},'refund','refund',Date.now()));
});
