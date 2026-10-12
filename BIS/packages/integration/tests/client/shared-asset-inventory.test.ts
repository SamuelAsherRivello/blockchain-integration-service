import test from 'node:test';
import assert from 'node:assert/strict';
import { getSharedAssetInventory, invalidateSharedAssetInventory, prepareSharedAssetInventory } from '../../src/client/state-layer-core/shared-asset-inventory.ts';

const asset = (assetId='asset-1') => ({assetId, name:'Dagger I', ticker:'DAG1', quantity:'1'});

test('timed out shared work settles every caller, releases pending, and cannot cache late data', async () => {
  invalidateSharedAssetInventory(); let release, signal;
  const options={role:'game',profileId:'timeout-wallet',network:'mutinynet',timeoutMs:5,load:s=>{signal=s;return new Promise(resolve=>{release=resolve;});}};
  const first=prepareSharedAssetInventory(options), second=prepareSharedAssetInventory(options);
  assert.equal(first,second);
  assert.equal((await first).status,'error'); assert.equal((await second).status,'error');
  assert.equal(signal.aborted,true);
  const retry=await prepareSharedAssetInventory({...options,load:async()=>[asset('fresh')]});
  assert.equal(retry.status,'success'); release([asset('obsolete')]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(getSharedAssetInventory('game','timeout-wallet','mutinynet').assets[0].assetId,'fresh');
});

test('invalidating pending inventory prevents obsolete scope publication', async () => {
  invalidateSharedAssetInventory(); let release;
  const first=prepareSharedAssetInventory({role:'player',profileId:'old',network:'signet',load:()=>new Promise(resolve=>{release=resolve;})});
  await new Promise(resolve=>setImmediate(resolve)); invalidateSharedAssetInventory('old','signet','player');
  assert.equal((await first).status,'error'); release([asset()]);
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(getSharedAssetInventory('player','old','signet'),undefined);
});

test('BIS joins compatible inventory preparation and keeps wallet roles separate', async () => {
  invalidateSharedAssetInventory(); let calls=0, release;
  const pending=new Promise(resolve=>{release=resolve});
  const player={role:'player',profileId:'player-1',network:'mutinynet',load:async()=>{calls++;await pending;return[asset()]}};
  const first=prepareSharedAssetInventory(player), second=prepareSharedAssetInventory(player);
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(calls,1); release(); assert.deepEqual((await first).assets.map(value=>value.assetId),['asset-1']); assert.deepEqual((await second).assets.map(value=>value.assetId),['asset-1']);
  const game=await prepareSharedAssetInventory({role:'game',profileId:'game-1',network:'mutinynet',load:async()=>[asset('game-asset')]});
  assert.deepEqual(game.assets.map(value=>value.assetId),['game-asset']); assert.deepEqual(getSharedAssetInventory('player','player-1','mutinynet').assets.map(value=>value.assetId),['asset-1']);
});
