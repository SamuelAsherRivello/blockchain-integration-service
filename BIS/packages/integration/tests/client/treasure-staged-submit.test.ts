import test from 'node:test';
import assert from 'node:assert/strict';
import type {ArkInfo,VirtualCoin} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {authorizedAdapterFixture} from './treasure-authorized-adapter-fixture.ts';
import {createStagedTreasureState,advanceStagedTreasureState,type StagedTreasureState} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {createTreasureStagedSubmitter,type TreasureStagedSubmitControls,type TreasureStagedSubmitTestDependencies} from '../../src/client/wallet-layer-arkade/treasure-staged-submit.ts';

async function setup(branch:'claim'|'reject'|'cancel'|'refund'='claim',checkpointDelay=4096n){
  const f=await authorizedAdapterFixture(branch,checkpointDelay),b=f.binding;
  let now=f.at,state=createStagedTreasureState(b,now),current=true;
  const calls:string[]=[],claims=new Map<string,unknown>();
  const info={network:'mutinynet',signerPubkey:hex.encode(await f.identities[2].compressedPublicKey()),forfeitPubkey:f.forfeit,
    checkpointTapscript:b.checkpointTapscript,fees:{txFeeRate:'0'},dust:'330',vtxoMinAmount:'330',vtxoMaxAmount:'-1'} as unknown as ArkInfo;
  const coin={...b.funding,script:hex.encode(f.built.script.pkScript),createdAt:new Date(now-1000),isSpent:false,isSwept:false,isUnrolled:false,
    isPreconfirmed:false,expiresAt:new Date(now+86400000),spentBy:'',status:{confirmed:true},virtualStatus:{state:'settled'}} as VirtualCoin;
  const controls:TreasureStagedSubmitControls={
    load:async()=>state,persist:async next=>{advanceStagedTreasureState(state,next,b);calls.push('persist:'+next.phase);state=next;},
    claimSigning:async intent=>{calls.push('claim:'+intent.kind);if(claims.has(intent.kind))return {status:'pending'};claims.set(intent.kind,intent);return {status:'granted'};},
    completeSigning:async intent=>{calls.push('complete:'+intent.kind);},markSigningUnknown:async intent=>{calls.push('unknown:'+intent.kind);},
    sign:async intent=>{calls.push('sign:'+intent.kind);assert.ok(claims.has(intent.kind));
      return intent.kind==='root'?{arkTx:await f.actors(intent.arkTx)}:{checkpoints:await Promise.all(intent.checkpoints.map(f.actors))};},
    isCurrent:()=>current,now:()=>now,observationMs:10000,
  };
  const deps:TreasureStagedSubmitTestDependencies={testOnly:true,emulatorPublicKey:f.emulatorPin,providers:{
    ark:{getInfo:async()=>info,submitTx:async()=>{calls.push('submit');assert.equal(state.phase,'submit-pending');return f.operator();},
      finalizeTx:async()=>{calls.push('finalize');assert.equal(state.phase,'finalize-pending');}},
    indexer:{getVtxos:async()=>({vtxos:[coin]}),getVirtualTxs:async()=>({txs:[b.previousTransaction]})},
    emulator:{getInfo:async()=>({signerPubkey:f.emulatorPin}),submitTx:async()=>{calls.push('emulator');assert.equal(state.phase,'emulator-pending');return f.emulator();}},
  }};
  return {f,b,controls,deps,calls,claims,info,coin,state:()=>state,setNow:(n:number)=>{now=n;},setCurrent:(v:boolean)=>{current=v;}};
}
test('all four staged SDK branches persist before signing and submission, stop at receipt observation and never replay',async()=>{
  for(const branch of ['claim','reject','cancel','refund'] as const){
    const t=await setup(branch),runner=createTreasureStagedSubmitter(t.controls,t.deps);
    const pending=runner.run(t.b);assert.equal(runner.run(t.b),pending);
    const result=await pending;assert.equal(result.status,'awaiting-receipt');assert.equal(result.state.phase,'finalize-pending');
    assert.deepEqual(t.calls,['persist:emulator-pending','emulator','persist:emulator-signed','claim:root','sign:root','complete:root',
      'persist:actor-root-signed','persist:submit-pending','submit','persist:operator-signed','claim:checkpoint','sign:checkpoint','complete:checkpoint',
      'persist:actor-checkpoints-signed','persist:finalize-pending','finalize']);
    assert.equal((await runner.run(t.b)).status,'unknown');assert.equal(t.calls.filter(c=>c==='emulator').length,1);
    assert.deepEqual(result.state.original,t.b.original);
  }
});
test('fresh checkpoint metadata rejects wrong forfeit key and never treats signer as the checkpoint authority',async()=>{
  const t=await setup();t.info.forfeitPubkey=t.b.terms.operator;
  const result=await createTreasureStagedSubmitter(t.controls,t.deps).run(t.b);
  assert.equal(result.reason,'preflight-unavailable');assert.deepEqual(t.calls,[]);
});
test('first expired admission, changed context, spent funding and failed durable write make no mutation request',async()=>{
  for(const mode of ['expired','context','spent','persist'] as const){
    const t=await setup();if(mode==='expired')t.setNow(t.f.built.deadlineSeconds*1000);
    if(mode==='context')t.setCurrent(false);if(mode==='spent')t.coin.isSpent=true;
    const controls=mode==='persist'?{...t.controls,persist:async()=>{throw Error('synthetic storage failure');}}:t.controls;
    await createTreasureStagedSubmitter(controls,t.deps).run(t.b);
    assert.equal(t.calls.some(c=>['emulator','submit','finalize','sign:root','sign:checkpoint'].includes(c)),false);
  }
});
test('lost original emulator response stays reserved; its valid late response is adopted without replay after expiry',async()=>{
  const t=await setup();let resolve!:(value:ReturnType<typeof t.f.emulator>)=>void;
  const deferred=new Promise<ReturnType<typeof t.f.emulator>>(r=>{resolve=r;});
  const deps={...t.deps,providers:{...t.deps.providers,emulator:{...t.deps.providers.emulator,submitTx:async()=>{t.calls.push('emulator');return deferred;}}}};
  const runner=createTreasureStagedSubmitter({...t.controls,observationMs:5},deps);
  assert.equal((await runner.run(t.b)).status,'unknown');assert.equal(t.state().phase,'emulator-unknown');
  assert.equal((await runner.run(t.b)).status,'unknown');assert.equal(t.calls.filter(c=>c==='emulator').length,1);
  t.setNow(t.f.built.deadlineSeconds*1000+1000);resolve(t.f.emulator());await deferred;await Promise.resolve();
  const adopted=await runner.adoptCompletedResponse(t.b);assert.equal(adopted.state.phase,'emulator-signed');
  assert.equal(t.calls.filter(c=>c==='emulator').length,1);assert.deepEqual(adopted.state.original,t.b.original);
  // A new instance cannot manufacture the original emulator signature.
  const reopened=createTreasureStagedSubmitter(t.controls,t.deps);
  assert.equal((await reopened.adoptCompletedResponse(t.b)).status,'unknown');
});
test('a durable pending signing claim never signs again or submits',async()=>{
  const t=await setup();t.claims.set('root',{});
  const result=await createTreasureStagedSubmitter(t.controls,t.deps).run(t.b);
  assert.equal(result.reason,'signing-unresolved');assert.equal(result.state.phase,'emulator-signed');
  assert.equal(t.calls.includes('sign:root'),false);assert.equal(t.calls.includes('submit'),false);
});
test('invalid emulator signature cannot authorize actor signing or operator submission',async()=>{
  const t=await setup(),deps={...t.deps,providers:{...t.deps.providers,emulator:{...t.deps.providers.emulator,
    submitTx:async()=>({signedArkTx:t.b.original.arkTx,signedCheckpointTxs:[...t.b.original.checkpoints]})}}};
  const result=await createTreasureStagedSubmitter(t.controls,deps).run(t.b);
  assert.equal(result.status,'unknown');assert.equal(t.state().phase,'emulator-unknown');
  assert.equal(t.calls.some(c=>c.startsWith('sign:')||c==='submit'),false);
});
test('unknown operator and finalize acknowledgements preserve the original and prohibit duplicate financial requests',async()=>{
  for(const phase of ['submit','finalize'] as const){
    const t=await setup(),ark={...t.deps.providers.ark};
    if(phase==='submit')ark.submitTx=async()=>{t.calls.push('submit');throw Error('synthetic lost acknowledgement');};
    else ark.finalizeTx=async()=>{t.calls.push('finalize');throw Error('synthetic lost acknowledgement');};
    const runner=createTreasureStagedSubmitter(t.controls,{...t.deps,providers:{...t.deps.providers,ark}});
    const first=await runner.run(t.b);assert.equal(first.status,'unknown');assert.equal(first.state.phase,phase+'-unknown');
    const calls=[...t.calls];assert.equal((await runner.run(t.b)).status,'unknown');assert.deepEqual(t.calls,calls);
    assert.deepEqual(first.state.original,t.b.original);
  }
});
test('unknown signing result retains its durable claim and never calls the signer twice',async()=>{
  const t=await setup(),controls={...t.controls,sign:async()=>{t.calls.push('lost-sign');throw Error('synthetic signing acknowledgement loss');}};
  const runner=createTreasureStagedSubmitter(controls,t.deps);
  assert.equal((await runner.run(t.b)).status,'unknown');assert.equal(t.state().phase,'emulator-signed');
  assert.equal((await runner.run(t.b)).reason,'signing-unresolved');assert.equal(t.calls.filter(c=>c==='lost-sign').length,1);
  assert.ok(t.calls.includes('unknown:root'));assert.equal(t.calls.includes('submit'),false);
});
test('context replacement preserves the original emulator response but stops subsequent signing',async()=>{
  const t=await setup(),deps={...t.deps,providers:{...t.deps.providers,emulator:{...t.deps.providers.emulator,
    submitTx:async()=>{t.setCurrent(false);return t.f.emulator();}}}};
  const result=await createTreasureStagedSubmitter(t.controls,deps).run(t.b);
  assert.equal(result.reason,'context-changed');assert.equal(t.state().phase,'emulator-signed');
  assert.equal(t.calls.some(c=>c.startsWith('sign:')||c==='submit'),false);
});
test('undersized checkpoint delay is refused by the real SDK policy before any mutation',async()=>{
  const t=await setup('claim',512n),result=await createTreasureStagedSubmitter(t.controls,t.deps).run(t.b);
  assert.equal(result.reason,'preflight-unavailable');assert.deepEqual(t.calls,[]);
});
test('completed signing journal result is cryptographically adopted without another ROOT signing callback',async()=>{
  const t=await setup(),saved={arkTx:await t.f.actors(t.f.emulator().signedArkTx)};
  const controls:TreasureStagedSubmitControls={...t.controls,
    claimSigning:async(intent,binding)=>intent.kind==='root'?{status:'completed',result:saved}:t.controls.claimSigning(intent,binding),
    sign:async(intent,binding)=>{assert.notEqual(intent.kind,'root');return t.controls.sign(intent,binding);},
  };
  const result=await createTreasureStagedSubmitter(controls,t.deps).run(t.b);
  assert.equal(result.status,'awaiting-receipt');assert.equal(t.calls.includes('sign:root'),false);
  assert.ok(t.calls.includes('complete:root'));assert.deepEqual(result.state.original,t.b.original);
});
