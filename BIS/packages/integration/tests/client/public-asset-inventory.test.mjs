import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress, RestIndexerProvider } from '@arkade-os/sdk';
import { createPublicAssetInventory, invalidatePublicAssetInventory } from '../../src/client/state-layer-core/public-asset-inventory.ts';
import { loadPublicAssetInventory } from '../../src/client/wallet-layer-arkade/public-asset-inventory.ts';
import { invalidateSharedAssetInventory, getSharedAssetInventory } from '../../src/client/state-layer-core/shared-asset-inventory.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const scope={role:'game',profileId:'public-game',address:'public-address',network:'mutinynet'};
const item=assetId=>({assetId,quantity:'1'});

test('public preparation joins current live work, bypasses only completed values, and isolates exact scope',async()=>{
  invalidateSharedAssetInventory();let calls=0;let gate=deferred();
  const prepare=createPublicAssetInventory(async()=>{calls++;await gate.promise;return [item('first')];});
  const first=prepare(scope),second=prepare(scope,true);
  assert.equal(first,second);await tick();assert.equal(calls,1);gate.resolve();await first;
  await prepare(scope);assert.equal(calls,1);
  gate=deferred();const fresh=prepare(scope,true);await tick();assert.equal(calls,2);gate.resolve();await fresh;
  for(const patch of [{role:'player'},{profileId:'other'},{address:'other-address'},{network:'signet'}])await prepare({...scope,...patch});
  assert.equal(calls,6);
  assert.equal(getSharedAssetInventory('game',scope.profileId,scope.network),undefined,'Address queries cannot alias account inventory');
});

test('five-minute expiry is measured from successful completion, never cache access',async t=>{
  invalidateSharedAssetInventory();let now=1000,calls=0;t.mock.method(Date,'now',()=>now);
  const prepare=createPublicAssetInventory(async()=>[item(String(++calls))]);
  await prepare(scope);now+=299999;await prepare(scope);assert.equal(calls,1);
  now++;await prepare(scope);assert.equal(calls,2);
});

test('invalidation excludes a late abort-ignoring result without disturbing another role',async()=>{
  invalidateSharedAssetInventory();const gate=deferred();let calls=0;
  const prepare=createPublicAssetInventory(async()=>++calls===1?gate.promise:[item('new')]);
  const old=prepare(scope);await tick();invalidatePublicAssetInventory(scope);
  assert.equal((await old).status,'error');await prepare(scope);gate.resolve([item('obsolete')]);await tick();
  assert.equal((await prepare(scope)).assets[0].assetId,'new');
  await prepare({...scope,role:'player'});invalidatePublicAssetInventory(scope);
  assert.equal(getSharedAssetInventory('player',scope.profileId,scope.network,scope.address).status,'success');
});

test('unavailable public reads are sanitized, never cached, and invalid inputs never call the adapter',async()=>{
  invalidateSharedAssetInventory();let calls=0;
  const prepare=createPublicAssetInventory(async()=>{calls++;throw Error('private-provider-sentinel');});
  for(let i=0;i<2;i++){const result=await prepare(scope);assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('private-provider-sentinel'));}
  assert.equal(calls,2);
  for(const patch of [{role:'other'},{network:'mainnet'},{profileId:''},{address:''}])assert.equal((await prepare({...scope,...patch})).code,'invalid-input');
  assert.equal(calls,2);
});

test('real public adapter aggregates only active holdings and waits for all parallel metadata',async t=>{
  const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
  const address=new ArkAddress(point,point,'tark').encode();let server;const detailCalls=[];const gates={a:deferred(),b:deferred()};
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async function({scripts}){
    server=this.serverUrl;assert.equal(scripts.length,1);
    return {vtxos:[{assets:[{assetId:'a',amount:2n},{assetId:'b',amount:1n}]},{assets:[{assetId:'a',amount:3n}]},...['isSwept','isUnrolled'].map(flag=>({[flag]:true,assets:[{assetId:'b',amount:1n}]})),...['isSpent','spentBy','settledBy'].map(flag=>({[flag]:flag==='isSpent'?true:'terminal-transaction',assets:[{assetId:'ignored',amount:1n}]}))]};
  });
  t.mock.method(RestIndexerProvider.prototype,'getAssetDetails',async id=>{detailCalls.push(id);await gates[id].promise;return {assetId:id,metadata:{name:id}};});
  let settled=false;const work=loadPublicAssetInventory(address,new AbortController().signal,'mutinynet').then(result=>{settled=true;return result;});
  await tick();assert.deepEqual(detailCalls,['a','b']);assert.match(server,/mutiny/);
  gates.b.resolve();await tick();assert.equal(settled,false);gates.a.resolve();
  assert.deepEqual((await work).map(({assetId,quantity})=>({assetId,quantity})),[{assetId:'a',quantity:'5'},{assetId:'b',quantity:'3'}]);
});

test('a missing or mismatched metadata response never becomes a reusable partial inventory',async t=>{
  invalidateSharedAssetInventory();
  const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
  const request={...scope,address:new ArkAddress(point,point,'tark').encode()};let calls=0;
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>{calls++;return {vtxos:[{assets:[{assetId:'a',amount:1n},{assetId:'b',amount:1n}]}]};});
  t.mock.method(RestIndexerProvider.prototype,'getAssetDetails',async id=>({assetId:id==='b'?'wrong':id,metadata:{name:id}}));
  const prepare=createPublicAssetInventory();assert.equal((await prepare(request)).status,'error');assert.equal((await prepare(request)).status,'error');assert.equal(calls,2);
});
