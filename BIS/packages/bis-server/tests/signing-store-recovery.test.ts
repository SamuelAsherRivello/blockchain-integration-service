import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRedisSigningStore,type SigningResultLookup,type SigningStore} from '../src/server/signing-store.ts';

// Public synthetic transport fixtures. The real Upstash client serializes the
// EVAL and decodes its response; no Redis, signing key or provider is contacted.
const endpoint='https://signing-store-fixture.invalid',token='public-synthetic-read-token';
const lookup:SigningResultLookup={scope:'stealth-and-steel:mutinynet:'+'11'.repeat(32),id:'original-root-1',digest:'22'.repeat(32)};
const readFailure='Hosted signing result could not be read. Reconcile before retrying.';
type Call={key:string;field:string;script:string};
function fixture(t:TestContext){
  const calls:Call[]=[];
  let reply:()=>Response|Promise<Response>=()=>Response.json({result:null});
  t.mock.method(globalThis,'fetch',async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    assert.equal(String(url),endpoint);assert.equal(init?.method,'POST');assert.equal(init?.cache,'no-store');
    const headers=new Headers(init?.headers);assert.equal(headers.get('authorization'),`Bearer ${token}`);
    assert.equal(headers.get('upstash-encoding'),'base64');assert.equal(typeof init?.body,'string');
    const command:unknown=JSON.parse(init!.body as string);
    assert.ok(Array.isArray(command));assert.equal(command.length,5);assert.equal(command[0],'eval');assert.equal(command[2],1);
    const [,script,,key,field]=command as [string,string,number,string,string];
    // Inspect the actual outbound program, not a fake Lua implementation.
    assert.deepEqual([...script.matchAll(/redis\.call\(\s*['"]([A-Z]+)['"]/g)].map(match=>match[1]),['HGET']);
    assert.equal(script.trim(),"return redis.call('HGET', KEYS[1], ARGV[1])");
    calls.push({key,field,script});return reply();
  });
  return {calls,row(value:string|null){reply=()=>Response.json({result:value===null?null:Buffer.from(value).toString('base64')});},
    response(use:()=>Response|Promise<Response>){reply=use;},
    store(env:NodeJS.ProcessEnv={}){const store=createRedisSigningStore({UPSTASH_REDIS_REST_URL:endpoint,UPSTASH_REDIS_REST_TOKEN:token,...env});
      assert.ok(store.readCompleted);return store.readCompleted;}};
}

test('primary result lookup distinguishes missing, pending and exact completed envelopes without a write',async t=>{
  const f=fixture(t),read=f.store(),result={result:{$type:'transaction',value:'public-fixture-bytes'},treasureRootReceipt:'public-original-receipt'};
  f.row(null);assert.deepEqual(await read(lookup),{status:'missing'});
  f.row(JSON.stringify({digest:lookup.digest,batchReservation:'',batchDigest:''}));assert.deepEqual(await read(lookup),{status:'unresolved'});
  f.row(JSON.stringify({digest:lookup.digest,done:false}));assert.deepEqual(await read(lookup),{status:'unresolved'});
  const serialized=JSON.stringify({digest:lookup.digest,done:true,result:JSON.stringify(result),batchReservation:'',batchDigest:''});
  f.row(serialized);assert.deepEqual(await read(lookup),{status:'completed',result});
  assert.deepEqual(await read(lookup),{status:'completed',result});
  assert.equal(f.calls.length,5);
  const expectedKey='bis:signer:v1:preview:'+createHash('sha256').update(lookup.scope).digest('hex');
  for(const call of f.calls){assert.equal(call.key,expectedKey);assert.equal(call.field,'request:'+lookup.id);}
});

test('completed result lookup preserves existing JSON result serialization and batch metadata',async t=>{
  const f=fixture(t),read=f.store();
  for(const result of [null,false,0,'public-signature-result',['one',2],{unicode:'original \u2713',nested:{value:1000}}]){
    f.row(JSON.stringify({digest:lookup.digest,done:true,result:JSON.stringify(result),batchReservation:'33'.repeat(32),batchDigest:'44'.repeat(32)}));
    assert.deepEqual(await read(lookup),{status:'completed',result});
  }
  assert.equal(f.calls.length,6);
});

test('lookup uses the original wallet scope and configured environment namespace',async t=>{
  const f=fixture(t);f.row(null);
  const production=f.store({VERCEL_ENV:'production'}),preview=f.store({VERCEL_ENV:'preview'});
  await production(lookup);await preview(lookup);
  await preview({...lookup,scope:lookup.scope.replace(':mutinynet:',':signet:')});
  await preview({...lookup,scope:lookup.scope.replace('11'.repeat(32),'55'.repeat(32))});
  assert.equal(f.calls[0].key.replace(':production:',':preview:'),f.calls[1].key);
  assert.equal(new Set(f.calls.map(call=>call.key)).size,4);
});

test('invalid or extra lookup fields fail before the Redis transport',async t=>{
  const f=fixture(t),read=f.store();
  const invalid:unknown[]=[null,[],{}, {...lookup,unexpected:'not-authority'},
    {...lookup,scope:1},{...lookup,scope:'bad-scope'},{...lookup,scope:lookup.scope.replace('mutinynet','mainnet')},
    {...lookup,scope:lookup.scope.replace('stealth-and-steel','x'.repeat(101))},
    {...lookup,scope:lookup.scope+'\n'},{...lookup,id:undefined},{...lookup,id:''},{...lookup,id:'x'.repeat(101)},
    {...lookup,id:'request:other'},{...lookup,digest:undefined},{...lookup,digest:'AB'.repeat(32)},{...lookup,digest:'22'.repeat(31)}];
  for(const value of invalid)await assert.rejects(read(value as SigningResultLookup),{message:'Invalid signing result lookup.'});
  assert.equal(f.calls.length,0);
});

test('an in-flight lookup retains its original request and digest when the caller object changes',async t=>{
  const f=fixture(t),read=f.store(),mutable={...lookup},result={result:'public-original-result'};
  let entered!:()=>void,release!:(response:Response)=>void;
  const requested=new Promise<void>(resolve=>{entered=resolve;});
  f.response(()=>{entered();return new Promise<Response>(resolve=>{release=resolve;});});
  const pending=read(mutable);await requested;
  mutable.scope='different-game:signet:'+'77'.repeat(32);mutable.id='another-root';mutable.digest='88'.repeat(32);
  const row=JSON.stringify({digest:lookup.digest,done:true,result:JSON.stringify(result)});
  release(Response.json({result:Buffer.from(row).toString('base64')}));
  assert.deepEqual(await pending,{status:'completed',result});assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].field,'request:'+lookup.id);
  assert.equal(f.calls[0].key,'bis:signer:v1:preview:'+createHash('sha256').update(lookup.scope).digest('hex'));
});

test('changed and malformed stored rows are refused without returning a result or issuing a write',async t=>{
  const f=fixture(t),read=f.store();
  const rows:unknown[]=[null,[],{},{digest:'66'.repeat(32),done:true,result:'"foreign"'},
    {digest:lookup.digest,done:'true',result:'"wrong-type"'}, {digest:lookup.digest,done:null},
    {digest:lookup.digest,done:true},{digest:lookup.digest,done:true,result:1},
    {digest:lookup.digest,done:true,result:'not-json'}, {digest:lookup.digest,done:false,result:'"premature"'},
    {digest:lookup.digest,done:true,result:'null',unexpected:'field'},
    {digest:lookup.digest,batchReservation:'33'.repeat(32)},
    {digest:lookup.digest,batchReservation:'',batchDigest:'44'.repeat(32)},
    {digest:lookup.digest,batchReservation:'bad',batchDigest:'bad'}];
  for(const row of rows){f.row(JSON.stringify(row));await assert.rejects(read(lookup),{message:readFailure});}
  f.row('{');await assert.rejects(read(lookup),{message:readFailure});
  assert.equal(f.calls.length,rows.length+1);
});

test('transport and malformed-response failures remain sanitized and each issues only one read attempt',async t=>{
  const f=fixture(t),read=f.store();
  for(const respond of [
    ()=>{throw Error('public-fixture transport detail '+token);},
    ()=>Response.json({error:'public-fixture HTTP detail '+token},{status:503}),
    ()=>new Response('not-json',{status:200}),
    ()=>Response.json({result:42}),
  ]){
    const before=f.calls.length;f.response(respond);
    await assert.rejects(read(lookup),{message:readFailure});assert.equal(f.calls.length,before+1);
  }
});

test('legacy stores retain an explicitly absent optional completed-result capability',()=>{
  const legacy:SigningStore={claim:async()=>({status:'acquired',owner:'public-fixture-owner'}),complete:async()=>{},
    session:async()=>null,ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{}};
  assert.equal(legacy.readCompleted,undefined);
});
