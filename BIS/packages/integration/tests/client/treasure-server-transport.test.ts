import test from 'node:test';
import assert from 'node:assert/strict';
import {hex} from '@scure/base';
import {decodeSigningValue,encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createTreasureServerTransport} from '../../src/client/wallet-layer-arkade/treasure-server-transport.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,advanceTreasureServerJournal,
  type TreasureServerJournal} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {fundFixture,spendFixture,game,operator,player,common,clock,connection,plan,receipt,token,wireArgs} from './fixtures/treasure-server-transport-fixture.ts';

// HTTP is a closed deterministic fixture. Plans below are format placeholders;
// result signatures are real SDK signatures from public test scalars. These
// tests prove client persistence/transport, not hosted or network acceptance.
async function fixture(authority:'owner'|'player-proof'='player-proof',spend=false){
  const f=spend?await spendFixture():fundFixture(authority);
  let journal=createTreasureServerJournal({...f.binding,authority}),time=spend?clock:common.terms.startedAtMs+1000,current=true,owner='private-runtime-fixture-owner';
  let failCommit=false,drop=false,corrupt=false;
  const calls:{path:string;body:any;authorization:string|null}[]=[],writes:string[]=[],stored=new Map<string,unknown>();
  const account={profileId:common.profileId,network:'mutinynet' as const,server:{endpoint:common.endpoint,gameId:common.gameId,publicKey:common.publicKey}};
  const fetcher:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname.replace('/api/bis/',''),body=JSON.parse(String(init?.body));
    calls.push({path,body,authorization:new Headers(init?.headers).get('authorization')});
    if(path.endsWith('/plan'))return Response.json(path.includes('/actor/')?{treasureActorPlan:token('actor-plan')}:
      authority==='owner'?{ownerPlan:plan}:{paymentPlan:plan});
    if(path.endsWith('/authorize'))return Response.json({grant:token('grant')});
    if(path==='treasure/recover'){
      assert.equal(body.requestJson,journal.requests.find(r=>r.id===body.requestId)!.bodyJson);
      assert.equal(body.connectionToken,connection);
      const value=stored.get(body.requestId);return value?Response.json(value):Response.json({error:'unavailable'},{status:409});
    }
    const checkpoint=path==='treasure/checkpoint/complete'||path==='owner/treasure/checkpoint/complete';
    if(checkpoint){
      assert.equal(body.connectionToken,connection);
      assert.equal(body.version,1);
      assert.equal(new Headers(init?.headers).has('X-BIS-Signing-Grant'),false);
      assert.equal(body.playerToken!==undefined,authority==='player-proof');
    }else assert.equal(path,'sign');
    const signingBody=checkpoint?JSON.parse(body.requestJson):body;
    const saved=journal.requests.find(r=>r.id===signingBody.id)!;
    assert.equal(saved.phase,'sign-pending','persist original body before the signing HTTP call');
    assert.equal(saved.bodyJson,JSON.stringify(signingBody));
    if(checkpoint)assert.equal(body.requestDigest,saved.bodyDigest);
    const args=decodeSigningValue(signingBody.args);
    const result=signingBody.method==='signMessage'?await game.signMessage(args[0],args[1]):corrupt?args[0]:await game.sign(args[0],args[1]);
    const value={result:encodeSigningValue(result),...(saved.purpose==='root'?{treasureRootReceipt:receipt}:{})};
    stored.set(signingBody.id,value);if(drop){drop=false;throw Error('Lost original signing response');}return Response.json(value);
  };
  const options={account,authority,connectionToken:connection,ownerToken:()=>owner,signal:new AbortController().signal,
    isCurrent:()=>current,now:()=>++time,fetcher,read:async()=>structuredClone(journal),
    commit:async(before:TreasureServerJournal,after:TreasureServerJournal)=>{
      if(failCommit)throw Error('Encrypted CAS unavailable');
      assert.deepEqual(before,journal);advanceTreasureServerJournal(before,after);journal=structuredClone(after);
      writes.push(after.requests.at(-1)!.phase);
    },playerProof:async()=>({token:token('player-proof'),expires:time+600_000,
      playerPublicKey:hex.encode(await player.compressedPublicKey()),assertCurrent:()=>assert.equal(current,true)})};
  function prepare(id='root-request',purpose:'root'|'checkpoint'|'actor-proof'='root',argsJson?:string,index?:number){
    journal=prepareTreasureServerRequest(journal,{purpose,id,argsJson:argsJson??wireArgs((f as ReturnType<typeof fundFixture>).pair.arkTx),
      ...(index===undefined?{}:{checkpointIndex:index})},++time);
  }
  return {f,options,calls,writes,stored,prepare,read:()=>structuredClone(journal),transport:()=>createTreasureServerTransport(options),
    elapse:(ms:number)=>{time+=ms;},drop:()=>{drop=true;},corrupt:()=>{corrupt=true;},failCommit:()=>{failCommit=true;},retire:()=>{current=false;},forget:()=>{owner='';}};
}

for(const authority of ['owner','player-proof'] as const)test(`${authority} persists ROOT and both checkpoint requests before signing and reuses only original ROOT authority`,async()=>{
  const f=await fixture(authority),pair=(f.f as ReturnType<typeof fundFixture>).pair;f.prepare();
  await f.transport().request('root-request');
  for(let index=0;index<pair.checkpoints.length;index++){
    const cp=await operator.sign(pair.checkpoints[index],[0]);
    f.prepare('cp-'+index,'checkpoint',wireArgs(cp),index);await f.transport().request('cp-'+index);
  }
  assert.deepEqual(f.read().requests.map(r=>r.phase),['completed','completed','completed']);
  assert.equal(f.calls.filter(r=>r.path.endsWith('/plan')).length,1);
  assert.equal(f.calls.filter(r=>r.path==='sign').length,1);
  assert.equal(f.calls.filter(r=>r.path.endsWith('treasure/checkpoint/complete')).length,2);
  assert.equal(f.calls.filter(r=>r.path.endsWith('/authorize')).length,1);
  assert.deepEqual(f.writes,['planned','sign-pending','completed','planned','sign-pending','completed','planned','sign-pending','completed']);
  assert.equal(JSON.stringify(f.read()).includes('private-runtime-fixture-owner'),false);
  for(const call of f.calls.filter(row=>row.path==='sign'))assert.equal(call.authorization,`Bearer ${authority==='owner'?'private-runtime-fixture-owner':connection}`);
});

for(const authority of ['owner','player-proof'] as const)test(`${authority} completes the exact original checkpoint after expiry and recovers its lost response without another signature`,async()=>{
  const f=await fixture(authority),pair=(f.f as ReturnType<typeof fundFixture>).pair;f.prepare();
  await f.transport().request('root-request');f.elapse(24*60*60*1000);
  const cp=await operator.sign(pair.checkpoints[0],[0]);f.prepare('expired-cp','checkpoint',wireArgs(cp),0);f.drop();
  await assert.rejects(f.transport().request('expired-cp'));
  assert.equal(f.read().requests.at(-1)!.phase,'sign-unknown');
  const calls=f.calls.length;await f.transport().recover('expired-cp');
  assert.deepEqual(f.calls.slice(calls).map(row=>row.path),['treasure/recover']);
  assert.equal(f.calls.filter(row=>row.path.endsWith('/plan')).length,1);
  assert.equal(f.calls.filter(row=>row.path.endsWith('/authorize')).length,1);
  assert.equal(f.calls.filter(row=>row.path.endsWith('treasure/checkpoint/complete')).length,1);
});

test('a lost response survives a new adapter and recovers the exact saved body without another plan, grant or signature',async()=>{
  const f=await fixture();f.prepare();f.drop();await assert.rejects(f.transport().request('root-request'));
  const unknown=f.read().requests[0];assert.equal(unknown.phase,'sign-unknown');
  const before=f.calls.length;
  const restored=createTreasureServerTransport({...f.options,connectionToken:token('new-current-connection')});
  await restored.request('root-request');assert.equal(f.read().requests[0].phase,'completed');
  assert.deepEqual(f.calls.slice(before).map(row=>row.path),['treasure/recover']);
  assert.equal(f.read().requests[0].bodyJson,unknown.bodyJson);
  assert.equal(f.calls.at(-1)!.authorization,`Bearer ${connection}`);
  await restored.request('root-request');assert.equal(f.calls.length,before+1,'completed local result requires no HTTP call');
});

test('persist failure prevents even authorization and signing; a corrupt signature remains unknown',async()=>{
  const failed=await fixture();failed.prepare();failed.failCommit();await assert.rejects(failed.transport().request('root-request'));
  assert.equal(failed.calls.filter(row=>row.path.endsWith('/authorize')||row.path==='sign').length,0);
  const corrupt=await fixture();corrupt.prepare();corrupt.corrupt();await assert.rejects(corrupt.transport().request('root-request'));
  assert.equal(corrupt.read().requests[0].phase,'sign-unknown');
  assert.equal(corrupt.read().requests[0].responseJson,undefined);
});

test('concurrent calls share one request and changed account/authority/retired lease cannot recover',async()=>{
  const f=await fixture();f.prepare();const transport=f.transport(),first=transport.request('root-request'),second=transport.request('root-request');
  assert.equal(first,second);await first;assert.equal(f.calls.filter(row=>row.path==='sign').length,1);
  const before=f.calls.length;
  await assert.rejects(createTreasureServerTransport({...f.options,account:{...f.options.account,profileId:'ef'.repeat(32)}}).recover('root-request'));
  await assert.rejects(createTreasureServerTransport({...f.options,authority:'owner'}).recover('root-request'));
  f.retire();await assert.rejects(transport.recover('root-request'));assert.equal(f.calls.length,before);
});

test('owner recovery requires runtime owner access and public actor requests carry only the exact typed contract digest',async()=>{
  const owner=await fixture('owner');owner.prepare();owner.drop();await assert.rejects(owner.transport().request('root-request'));
  const before=owner.calls.length;owner.forget();await assert.rejects(owner.transport().recover('root-request'));assert.equal(owner.calls.length,before);
  const actor=await fixture('player-proof',true),f=actor.f as Awaited<ReturnType<typeof spendFixture>>;
  actor.prepare('actor-request','actor-proof',JSON.stringify(encodeSigningValue([f.message,'schnorr'])));
  const proof=await actor.transport().request('actor-request');assert.ok(proof instanceof Uint8Array);assert.equal(proof.length,64);
  assert.deepEqual(actor.calls.map(row=>row.path),['treasure/actor/plan','treasure/actor/authorize','sign']);
  assert.deepEqual(actor.calls[0].body.request.treasureActorProof,f.actorRequest);
  assert.deepEqual(actor.calls[2].body.args,encodeSigningValue([f.message,'schnorr']));
});
