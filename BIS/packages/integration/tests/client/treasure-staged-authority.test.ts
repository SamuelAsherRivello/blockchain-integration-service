import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {authorizedAdapterFixture} from './treasure-authorized-adapter-fixture.ts';
import {createTreasureStagedAuthority} from '../../src/client/wallet-layer-arkade/treasure-staged-authority.ts';
import {createStagedTreasureState,transitionStagedTreasureState} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';
import type {TreasureStagedSigningIntent} from '../../src/client/wallet-layer-arkade/treasure-staged-submit.ts';

for(const branch of ['claim','reject','cancel','refund'] as const)test(`local ${branch} composes actual SDK signatures without manufacturing a Game signing journal`,async()=>{
  const f=await authorizedAdapterFixture(branch),b=f.binding;
  const authority=createTreasureStagedAuthority({binding:b,player:f.identities[0],localGame:f.identities[1],isCurrent:()=>true});
  let state=createStagedTreasureState(b,f.at);
  const step=(event:Parameters<typeof transitionStagedTreasureState>[1])=>{state=transitionStagedTreasureState(state,event,b);};
  const intent=(kind:'root'|'checkpoint'):TreasureStagedSigningIntent=>({artifactVersion:4,kind,contractId:b.contractId,
    operationId:b.operationId,bindingCommitment:state.bindingCommitment,actors:branch==='claim'?['player']:branch==='refund'?['game']:['player','game'],
    arkTx:kind==='root'?state.emulator!.signedArkTx:state.operator!.finalArkTx,
    checkpoints:kind==='root'?state.emulator!.signedCheckpointTxs:state.operator!.signedCheckpointTxs});
  step({type:'emulator-request',atMs:f.at});step({type:'emulator-response',response:f.emulator(),atMs:f.at});
  const root=intent('root');assert.deepEqual(await authority.claimSigning(root,b),{status:'granted'});
  const rootResult=await authority.sign(root,b);assert.ok('arkTx' in rootResult);
  await authority.completeSigning(root,rootResult,b);step({type:'actor-root',arkTx:rootResult.arkTx,atMs:f.at});
  step({type:'submit',atMs:f.at});step({type:'operator-response',response:await f.operator(),atMs:f.at});
  const checkpoint=intent('checkpoint');assert.deepEqual(await authority.claimSigning(checkpoint,b),{status:'granted'});
  const checkpointResult=await authority.sign(checkpoint,b);assert.ok('checkpoints' in checkpointResult);
  await authority.completeSigning(checkpoint,checkpointResult,b);
  step({type:'actor-checkpoints',checkpoints:checkpointResult.checkpoints,atMs:f.at});
  assert.equal(state.phase,'actor-checkpoints-signed');
});

test('local signing refuses changed payout metadata and a foreign Player identity before producing a signature',async t=>{
  const f=await authorizedAdapterFixture('claim'),b=f.binding,state=createStagedTreasureState(b,f.at);
  const original:TreasureStagedSigningIntent={artifactVersion:4,kind:'root',contractId:b.contractId,operationId:b.operationId,
    bindingCommitment:state.bindingCommitment,actors:['player'],arkTx:b.original.arkTx,checkpoints:b.original.checkpoints};
  let signatures=0;
  const player=f.identities[0];t.mock.method(player,'sign',async()=>{signatures++;throw Error('unexpected signer call');});
  const authority=createTreasureStagedAuthority({binding:b,player,isCurrent:()=>true});
  const changed=Transaction.fromPSBT(base64.decode(original.arkTx));changed.updateOutput(0,{script:hex.decode('5120'+b.terms.gameDestination)});
  await assert.rejects(authority.sign({...original,arkTx:base64.encode(changed.toPSBT())},b));assert.equal(signatures,0);
  const foreign=createTreasureStagedAuthority({binding:b,player:f.identities[1],isCurrent:()=>true});
  await assert.rejects(foreign.sign(original,b));
});

test('staged authority refuses a missing Game journal, changed actor requirements, foreign operation and retired context',async()=>{
  for(const branch of ['reject','cancel','refund'] as const){
    const f=await authorizedAdapterFixture(branch),b=f.binding,state=createStagedTreasureState(b,f.at);
    let current=true;
    const authority=createTreasureStagedAuthority({binding:b,player:f.identities[0],isCurrent:()=>current});
    const original:TreasureStagedSigningIntent={artifactVersion:4,kind:'root',contractId:b.contractId,operationId:b.operationId,
      bindingCommitment:state.bindingCommitment,actors:branch==='refund'?['game']:['player','game'],
      arkTx:b.original.arkTx,checkpoints:b.original.checkpoints};
    await assert.rejects(authority.claimSigning(original,b));
    await assert.rejects(authority.sign({...original,actors:['player']},b));
    await assert.rejects(authority.claimSigning({...original,operationId:'replacement'},b));
    current=false;await assert.rejects(authority.sign(original,b));
  }
});
