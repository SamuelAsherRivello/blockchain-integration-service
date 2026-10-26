import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium,type Browser} from 'playwright';
import {hex} from '@scure/base';
import {schnorr} from '@noble/curves/secp256k1.js';
import {verifyTapscriptSignatures,type Transaction} from '@arkade-os/sdk';
import {createStagedTreasureState,validateStagedTreasureBinding,validateStagedTreasureState,advanceStagedTreasureState,
  transitionStagedTreasureState} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {treasureStagedBranches} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {decodeTreasurePsbtMaps,encodeTreasurePsbtMaps} from '../../src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {stagedFixture,signFixtureEmulator,signFixtureActors,signFixtureOperator,fixtureEmulatorSecret,decode,encode,type StagedFixture} from './treasure-staged-fixture.ts';

function prepared(f:StagedFixture){return createStagedTreasureState(f.binding,f.binding.branch==='refund'?f.deadlineMs:f.binding.terms.startedAtMs);}
function admitted(f:StagedFixture){
  const initial=prepared(f),pending=transitionStagedTreasureState(initial,{type:'emulator-request',atMs:initial.authorization.authorizedAtMs},f.binding);
  return transitionStagedTreasureState(pending,{type:'emulator-response',atMs:f.deadlineMs+(f.binding.branch==='refund'?1:-15000),response:signFixtureEmulator(f)},f.binding);
}
async function submitPending(f:StagedFixture){
  const first=admitted(f),signed=await signFixtureActors(f,first.emulator!.signedArkTx);
  const at=f.deadlineMs+(f.binding.branch==='refund'?1000:-13000);
  const root=transitionStagedTreasureState(first,{type:'actor-root',atMs:at,arkTx:signed},f.binding);
  return transitionStagedTreasureState(root,{type:'submit',atMs:at+1},f.binding);
}

test('typed staged protocol verifies actual signatures for all branches while withholding checkpoint actors until operator admission',async()=>{
  for(const branch of treasureStagedBranches){
    const f=await stagedFixture(branch),b=f.binding;validateStagedTreasureBinding(b);
    const pending=await submitPending(f),unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:pending.history.at(-1)!.atMs+1},b);
    assert.equal(unknown.phase,'submit-unknown');assert.deepEqual(unknown.submitRequest,pending.submitRequest);
    assert.deepEqual(decode(pending.submitRequest!.checkpointTxs[0]).getInput(0).tapScriptSig!.map(([key])=>hex.encode(key.pubKey)),[hex.encode(f.leaf.signerKeys[1])]);
    const response=await signFixtureOperator(f),operator=transitionStagedTreasureState(unknown,
      {type:'operator-response',atMs:f.deadlineMs+(branch==='refund'?2000:-11000),response},b);
    const restored:unknown=JSON.parse(JSON.stringify(operator));validateStagedTreasureState(restored,b);
    assert.throws(()=>transitionStagedTreasureState(operator,{type:'finalize',atMs:f.deadlineMs+3000},b));
    const cp=await signFixtureActors(f,operator.operator!.signedCheckpointTxs[0]);
    const completed=transitionStagedTreasureState(restored,{type:'actor-checkpoints',atMs:f.deadlineMs+3000,checkpoints:[cp]},b);
    const final=transitionStagedTreasureState(completed,{type:'finalize',atMs:f.deadlineMs+3001},b);
    assert.equal(final.finalizeRequest!.arkTxid,decode(b.original.arkTx).id);
    assert.equal(decode(final.finalizeRequest!.finalCheckpointTxs[0]).id,decode(b.original.checkpoints[0]).id);
    assert.equal(final.observationClock,'local-observation-not-signed-server-time');
    const finalUnknown=transitionStagedTreasureState(final,{type:'unknown',atMs:f.deadlineMs+3002},b);
    assert.throws(()=>transitionStagedTreasureState(finalUnknown,{type:'finalize',atMs:f.deadlineMs+3003},b));
    assert.throws(()=>transitionStagedTreasureState(unknown,{type:'submit',atMs:f.deadlineMs+1},b));
    assert.throws(()=>advanceStagedTreasureState(final,pending,b));
  }
});

test('restored stage validation binds full originals, authorization, history and strong admission without retry/downgrade',async()=>{
  const f=await stagedFixture(),b=f.binding,initial=prepared(f);
  assert.throws(()=>transitionStagedTreasureState(initial,{type:'emulator-response',atMs:f.deadlineMs-1,response:signFixtureEmulator(f)},b));
  const pending=transitionStagedTreasureState(initial,{type:'emulator-request',atMs:b.terms.startedAtMs},b);
  const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:b.terms.startedAtMs+1},b);
  assert.throws(()=>transitionStagedTreasureState(unknown,{type:'emulator-request',atMs:b.terms.startedAtMs+2},b));
  const first=transitionStagedTreasureState(unknown,{type:'emulator-response',atMs:f.deadlineMs-15000,response:signFixtureEmulator(f)},b);
  const actor=await signFixtureActors(f,first.emulator!.signedArkTx);
  assert.throws(()=>transitionStagedTreasureState(first,{type:'actor-root',atMs:f.deadlineMs,arkTx:actor},b));
  const root=transitionStagedTreasureState(first,{type:'actor-root',atMs:f.deadlineMs-13000,arkTx:actor},b);
  assert.throws(()=>transitionStagedTreasureState(root,{type:'submit',atMs:f.deadlineMs},b));
  const submit=transitionStagedTreasureState(root,{type:'submit',atMs:f.deadlineMs-12000},b),response=await signFixtureOperator(f);
  assert.throws(()=>transitionStagedTreasureState(submit,{type:'operator-response',atMs:f.deadlineMs,response},b));
  for(const patch of [{artifactVersion:2},{contractId:'different'},{operationId:'different'},{funding:{...b.funding,value:999}},
    {previousTransaction:'00'},{terms:{...b.terms,hostReference:'different'}}])
    assert.throws(()=>validateStagedTreasureState(submit,{...b,...patch} as typeof b));
  for(const patch of [{phase:'prepared'},{history:[]},{bindingCommitment:'00'},
    {authorization:{...submit.authorization,deadlineMs:f.deadlineMs+1000}},{original:{...b.original,checkpoints:[b.original.arkTx]}},
    {observationClock:'signed-server-time'},{admissionRequirement:'browser-policy'}])
    assert.throws(()=>validateStagedTreasureState({...submit,...patch},b));
  assert.throws(()=>{(submit.original.checkpoints as unknown as string[])[0]='replacement';},TypeError);
  assert.equal(Object.isFrozen(submit.authorization),true);assert.equal(Object.isFrozen(submit.history),true);
  assert.doesNotThrow(()=>advanceStagedTreasureState(root,submit,b));
  assert.throws(()=>advanceStagedTreasureState(submit,submit,b));
});

test('staged signature policy rejects global changes, missing/wrong actors, duplicate keys and early complete checkpoints',async()=>{
  const f=await stagedFixture(),b=f.binding,first=admitted(f),pending=await submitPending(f),response=await signFixtureOperator(f);
  const mutable=(encoded:string,inputs=1,outputs=3)=>decodeTreasurePsbtMaps(encoded,inputs,outputs).map(entries=>entries.map(e=>({key:e.key.slice(),value:e.value.slice()})));
  const global=mutable(response.finalArkTx);global[0].push({key:new Uint8Array([0xfa]),value:new Uint8Array([1])});
  const accept=(reply:typeof response)=>transitionStagedTreasureState(pending,{type:'operator-response',atMs:f.deadlineMs-11000,response:reply},b);
  assert.throws(()=>accept({...response,finalArkTx:encodeTreasurePsbtMaps(global)}));
  const cp=mutable(response.signedCheckpointTxs[0],1,2);cp[1].push(cp[1].find(({key})=>key[0]===0x14)!);
  assert.throws(()=>accept({...response,signedCheckpointTxs:[encodeTreasurePsbtMaps(cp)]}));
  const earlyActor=await signFixtureActors(f,response.signedCheckpointTxs[0]);
  assert.throws(()=>accept({...response,signedCheckpointTxs:[earlyActor]}));
  assert.throws(()=>transitionStagedTreasureState(first,{type:'actor-root',atMs:f.deadlineMs-13000,arkTx:response.finalArkTx},b));
  const badLeaf=mutable(response.signedCheckpointTxs[0],1,2);badLeaf[1].find(({key})=>key[0]===0x14)!.key[64]^=1;
  assert.throws(()=>accept({...response,signedCheckpointTxs:[encodeTreasurePsbtMaps(badLeaf)]}));
  const badSighash=mutable(response.signedCheckpointTxs[0],1,2),sig=badSighash[1].find(({key})=>key[0]===0x14)!;
  sig.value=new Uint8Array([...sig.value,2]);assert.throws(()=>accept({...response,signedCheckpointTxs:[encodeTreasurePsbtMaps(badSighash)]}));
  for(const mutate of [(tx:Transaction)=>tx.updateOutput(0,{amount:999n}),(tx:Transaction)=>tx.updateOutput(0,{script:hex.decode('5120'+b.terms.game)}),(tx:Transaction)=>tx.updateInput(0,{index:1})]){
    const changed=decode(b.original.arkTx);mutate(changed);changed.updateInput(0,{tapScriptSig:decode(response.finalArkTx).getInput(0).tapScriptSig});
    assert.throws(()=>accept({...response,finalArkTx:encode(changed)}));
  }
  try{accept({...response,finalArkTx:'private-invalid-psbt'});assert.fail();}catch(error){
    assert.equal((error as Error).message,'Staged treasure recovery could not be verified. Original funds remain reserved.');
  }
});

test('a different valid ALL signature cannot replace the retained DEFAULT emulator signature',async()=>{
  const f=await stagedFixture(),b=f.binding,pending=await submitPending(f),plain=await signFixtureOperator(f);
  const originalCp=signFixtureEmulator(f).signedCheckpointTxs[0],cp=await f.identities[2].sign(decode(originalCp),[0]);
  const input=cp.getInput(0),script=input.tapLeafScript![0][1];
  const digest=cp.preimageWitnessV1(0,[input.witnessUtxo!.script],1,[input.witnessUtxo!.amount],undefined,script.subarray(0,-1),script.at(-1));
  const entries=decodeTreasurePsbtMaps(encode(cp),1,2).map(map=>map.map(entry=>({key:entry.key.slice(),value:entry.value.slice()})));
  const entry=entries[1].find(({key})=>key[0]===0x14&&hex.encode(key.subarray(1,33))===hex.encode(f.leaf.signerKeys[1]))!;
  entry.value=new Uint8Array([...schnorr.sign(digest,fixtureEmulatorSecret(f),new Uint8Array(32)),1]);
  assert.doesNotThrow(()=>verifyTapscriptSignatures(decode(encodeTreasurePsbtMaps(entries)),0,
    [b.terms.operator,hex.encode(f.leaf.signerKeys[1])],[],[0,1]));
  assert.throws(()=>transitionStagedTreasureState(pending,{type:'operator-response',atMs:f.deadlineMs-11000,
    response:{...plain,signedCheckpointTxs:[encodeTreasurePsbtMaps(entries)]}},b));
});

test('typed staged modules run in an actual browser without Node globals or remote access',{timeout:60000},async t=>{
  const f=await stagedFixture();
  const built=await build({configFile:false,envDir:false,root:process.cwd(),logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'},
    build:{write:false,minify:false,lib:{entry:resolve('BIS/packages/integration/src/client/wallet-layer-arkade/treasure-staged-state.ts'),formats:['es']},rolldownOptions:{external:[]}}});
  const outputs=(Array.isArray(built)?built:[built]).flatMap(result=>'output' in result?result.output:[]);
  assert.equal(outputs.length,1);const chunk=outputs[0];assert.equal(chunk.type,'chunk');
  if(chunk.type!=='chunk')throw Error('Expected one self-contained browser bundle');
  assert.deepEqual(chunk.imports,[]);assert.deepEqual(chunk.dynamicImports,[]);
  const server=createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    if(request.url==='/staged.js'){response.setHeader('Content-Type','text/javascript');response.end(chunk.code);}
    else if(request.url==='/typed-staged-test/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Offline staged modules</title>');}
    else{response.statusCode=404;response.end();}
  });let browser:Browser|undefined;
  t.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});
    await new Promise<void>((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
    browser=await chromium.launch({headless:true});const page=await browser.newPage();let remote=0;
    await page.route('https://**',route=>{remote++;return route.abort();});
    const address=server.address();assert.ok(address&&typeof address!=='string');
    const url=`http://127.0.0.1:${address.port}/typed-staged-test/`;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async binding=>{
      const api=await import(new URL('/staged.js',location.href).href);
      api.validateStagedTreasureBinding(binding);
      const initial=api.createStagedTreasureState(binding,binding.terms.startedAtMs);
      const pending=api.transitionStagedTreasureState(initial,{type:'emulator-request',atMs:binding.terms.startedAtMs},binding);
      return {phase:pending.phase,version:pending.artifactVersion,buffer:typeof globalThis.Buffer,frozen:Object.isFrozen(pending.original)};
    },f.binding);
    assert.deepEqual(result,{phase:'emulator-pending',version:3,buffer:'undefined',frozen:true});assert.equal(remote,0);
});
