import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coordinatedTreasureCheckpointSigning,createRedisSigningStore,type SigningClaim,type SigningStore,type TreasureCheckpointClaim} from '../src/server/signing-store.ts';

const endpoint='https://signing-store-fixture.invalid',token='public-synthetic-checkpoint-read-token';
const rootId='33'.repeat(32),sourceOutpoint='11'.repeat(32)+':0',checkpointOutpoint=rootId+':0';
const parent:SigningClaim={scope:'stealth-and-steel:mutinynet:'+'11'.repeat(32),id:'original-root-1',digest:'22'.repeat(32),
  inputs:[sourceOutpoint,checkpointOutpoint],transactionId:rootId,operationId:'treasure-operation-1',exposureSats:1000,dailyCapSats:10000,
  operationCapSats:5000,day:'2026-10-26',exposureId:rootId,contractPolicy:true};
const checkpoint:SigningClaim={...parent,id:'original-checkpoint-1',digest:'44'.repeat(32),inputs:[sourceOutpoint,checkpointOutpoint]};
const parentResult={result:{$type:'transaction',value:'public-synthetic-signed-root'},treasureRootReceipt:'public-synthetic-root-receipt'};
const checkpointOutpointBinding={txid:rootId,index:0};
const input:TreasureCheckpointClaim={parent,parentResult,checkpoint,checkpointOutpoint:checkpointOutpointBinding,
  rootRequestDigest:parent.digest,rootClaimDay:parent.day,checkpointFamilyDigest:'55'.repeat(32)};
type EvalCall={script:string;keys:string[];args:string[]};
function fixture(t:TestContext){
  const calls:EvalCall[]=[];
  let result:unknown=['acquired'];
  t.mock.method(globalThis,'fetch',async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    const pipeline=String(url)===`${endpoint}/pipeline`;
    assert.ok(String(url)===endpoint||pipeline);assert.equal(init?.method,'POST');
    const headers=new Headers(init?.headers);assert.equal(headers.get('authorization'),`Bearer ${token}`);
    assert.equal(headers.get('upstash-encoding'),'base64');assert.equal(typeof init?.body,'string');
    const body:unknown=JSON.parse(init!.body as string);assert.ok(Array.isArray(body));
    const commands=pipeline?body as unknown[][]:[body as unknown[]];assert.equal(commands.length,1,'checkpoint claim is exactly one atomic Redis command');
    const command:unknown=commands[0];assert.ok(Array.isArray(command));
    const [verb,script,keyCount,...parts]=command as [string,string,number,...string[]];
    assert.equal(verb,'eval');assert.equal(keyCount,2);assert.equal(typeof script,'string');
    assert.equal(parts.length,2+16);
    calls.push({script,keys:parts.slice(0,2),args:parts.slice(2)});
    const encoded=encodeRestStrings(result);
    return pipeline?Response.json([{result:encoded,error:null}]):Response.json({result:encoded});
  });
  return {calls,setResult(value:unknown){result=value;},
    store(env:NodeJS.ProcessEnv={}){return createRedisSigningStore({UPSTASH_REDIS_REST_URL:endpoint,UPSTASH_REDIS_REST_TOKEN:token,...env});}};
}
function encodeRestStrings(value:unknown):unknown{
  if(typeof value==='string')return Buffer.from(value,'utf8').toString('base64');
  if(Array.isArray(value))return value.map(encodeRestStrings);
  return value;
}
const invalidInput=(value:TreasureCheckpointClaim)=>({...value});

test('V4 checkpoint claim validates the immutable parent and exact linked family before Redis',async t=>{
  const f=fixture(t),store=f.store(),invalid:TreasureCheckpointClaim[]=[
    invalidInput({...input,rootRequestDigest:'66'.repeat(32)}),
    invalidInput({...input,rootClaimDay:'2026-10-25'}),
    invalidInput({...input,checkpointOutpoint:{txid:'66'.repeat(32),index:0}}),
    invalidInput({...input,checkpointFamilyDigest:'bad'}),
    invalidInput({...input,unexpected:'field'} as TreasureCheckpointClaim),
    invalidInput({...input,parent:{...parent,unexpected:'field'} as SigningClaim}),
    invalidInput({...input,checkpoint:{...checkpoint,day:'2026-02-30'}}),
    invalidInput({...input,checkpoint:{...checkpoint,scope:checkpoint.scope.replace('mutinynet','signet')}}),
    invalidInput({...input,checkpoint:{...checkpoint,operationId:'other-operation'}}),
    invalidInput({...input,checkpoint:{...checkpoint,transactionId:'66'.repeat(32)}}),
    invalidInput({...input,parent:{...parent,exposureId:undefined}}),
    invalidInput({...input,checkpoint:{...checkpoint,exposureSats:0}}),
    invalidInput({...input,checkpoint:{...checkpoint,inputs:[checkpointOutpoint]}}),
    invalidInput({...input,parent:{...parent,settlementBatch:{reservationId:rootId,digest:'77'.repeat(32)}}}),
    invalidInput({...input,parentResult:undefined}),
  ];
  for(const value of invalid)await assert.rejects(store.claimTreasureCheckpoint!(value),{message:'Invalid Treasure checkpoint claim.'});
  assert.equal(f.calls.length,0);
});

test('checkpoint acquisition uses one Redis-primary EVAL with all parent checks before writes',async t=>{
  const f=fixture(t),store=f.store();
  assert.ok(store.claimTreasureCheckpoint);
  const acquired=await store.claimTreasureCheckpoint(input);
  assert.equal(acquired.status,'acquired');if(acquired.status==='acquired')assert.match(acquired.owner,/^[a-f0-9-]{36}$/);
  assert.equal(f.calls.length,1);
  const call=f.calls[0],budget=`bis:signer:v1:preview:budgets:stealth-and-steel:mutinynet`;
  assert.deepEqual(call.keys,[`bis:signer:v1:preview:${createHash('sha256').update(parent.scope).digest('hex')}`,budget]);
  assert.deepEqual(call.args.slice(0,5),[parent.id,parent.digest,JSON.stringify(parentResult),JSON.stringify(parent.inputs),parent.transactionId]);
  assert.deepEqual(call.args.slice(7,9),[parent.day,parent.operationId]);
  assert.equal(call.args[9],`treasure-checkpoint:${rootId}:${rootId}:0`);
  assert.equal(call.args[11],checkpoint.id);assert.equal(call.args[12],checkpoint.digest);
  assert.equal(call.args[13],JSON.stringify(checkpoint.inputs));assert.equal(call.args[14],checkpoint.transactionId);
  const script=call.script;
  const reads=[
    "redis.call('HGET', KEYS[1], 'request:' .. ARGV[1])",
    "parent.done ~= true",
    "parent.result ~= ARGV[3]",
    "redis.call('HGET', KEYS[1], 'input:' .. input)",
    "redis.call('HGET', KEYS[2], ARGV[6])",
    "family ~= ARGV[11]",
    "redis.call('HGET', KEYS[1], 'request:' .. ARGV[12])",
    "redis.call('HGET', KEYS[1], 'input:' .. input) and redis.call('HGET', KEYS[1], 'input:' .. input) ~= ARGV[15]",
  ];
  const writeAt=script.indexOf("redis.call('HSET'");assert.ok(writeAt>0);
  for(const fragment of reads){const at=script.indexOf(fragment);assert.ok(at>=0,`missing atomic guard: ${fragment}`);assert.ok(at<writeAt,`guard follows first write: ${fragment}`);}
  assert.match(script,/local family = redis\.call\('HGET', KEYS\[1\], ARGV\[10\]\)/);
  assert.match(script,/return \{'replay', child\.result\}/);
  assert.match(script,/return \{'unresolved'\}/);
  assert.match(script,/redis\.call\('HSET', KEYS\[1\], ARGV\[10\], ARGV\[11\]\)/);
  assert.doesNotMatch(script,/redis\.call\('HSET', KEYS\[2\]/);
});

test('the atomic store returns only exact completed replay and refuses changed or unresolved children',async t=>{
  const f=fixture(t),store=f.store();
  f.setResult(['replay',JSON.stringify({$type:'bytes',value:'public-synthetic-signature'})]);
  assert.deepEqual(await store.claimTreasureCheckpoint!(input),{status:'replay',result:{$type:'bytes',value:'public-synthetic-signature'}});
  f.setResult(['unresolved']);
  await assert.rejects(store.claimTreasureCheckpoint!(input),{message:'Hosted signing refused: unresolved.'});
  f.setResult(['changed']);
  await assert.rejects(store.claimTreasureCheckpoint!(input),{message:'Hosted signing refused: changed.'});
  assert.equal(f.calls.length,3);
});

test('legacy signing stores without the atomic checkpoint primitive fail closed',async()=>{
  const store:SigningStore={claim:async()=>({status:'acquired',owner:'fixture-owner'}),complete:async()=>{},session:async()=>null,
    ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{}};
  await assert.rejects(coordinatedTreasureCheckpointSigning(store,input,async()=>{throw Error('must not sign');}),
    {message:'Hosted signing refused: checkpoint-recovery-unavailable.'});
});

test('coordinated checkpoint signing persists once, replays without signing, and leaves unknown outcomes quarantined',async()=>{
  const events:string[]=[],row:{done:boolean;result?:unknown}={done:false};
  const store:SigningStore={
    claim:async()=>({status:'acquired',owner:'ordinary-owner'}),session:async()=>null,ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{},
    claimTreasureCheckpoint:async()=>{events.push('atomic-child-claim');if(row.done)return {status:'replay' as const,result:row.result};return {status:'acquired' as const,owner:'checkpoint-owner'};},
    complete:async(claim,owner,result)=>{assert.equal(claim.id,checkpoint.id);assert.equal(owner,'checkpoint-owner');events.push('persist-child');row.done=true;row.result=result;},
  };
  const signed={result:{$type:'transaction',value:'public-synthetic-signed-checkpoint'}};
  assert.deepEqual(await coordinatedTreasureCheckpointSigning(store,input,async owner=>{assert.equal(owner,'checkpoint-owner');events.push('sign-exact-checkpoint');return signed;}),signed);
  assert.deepEqual(events,['atomic-child-claim','sign-exact-checkpoint','persist-child']);
  events.length=0;
  assert.deepEqual(await coordinatedTreasureCheckpointSigning(store,input,async()=>{throw Error('replay must not sign');}),signed);
  assert.deepEqual(events,['atomic-child-claim']);
  row.done=false;events.length=0;
  const interrupted:SigningStore={...store,claimTreasureCheckpoint:async()=>{events.push('atomic-child-claim');return {status:'acquired' as const,owner:'checkpoint-owner'};},
    complete:async()=>{events.push('persist-child');throw Error('synthetic commit uncertainty');}};
  await assert.rejects(coordinatedTreasureCheckpointSigning(interrupted,input,async()=>{events.push('sign-exact-checkpoint');return signed;}),{message:'synthetic commit uncertainty'});
  assert.deepEqual(events,['atomic-child-claim','sign-exact-checkpoint','persist-child']);assert.equal(row.done,false);
});
