import test from 'node:test';
import assert from 'node:assert/strict';
import { getSharedAssetInventory, invalidateSharedAssetInventory, prepareSharedAssetInventory } from '../../src/client/state-layer-core/shared-asset-inventory.ts';

const asset = (assetId='asset-1') => ({assetId, name:'Dagger I', ticker:'DAG1', quantity:'1'});

test('BIS joins compatible inventory preparation and keeps wallet roles separate', async () => {
  invalidateSharedAssetInventory(); let calls=0, release;
  const pending=new Promise(resolve=>{release=resolve});
  const player={role:'player',profileId:'player-1',network:'mutinynet',load:async()=>{calls++;await pending;return[asset()]}};
  const first=prepareSharedAssetInventory(player), second=prepareSharedAssetInventory(player);
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(calls,1); release(); assert.deepEqual((await first).assets.map(value=>value.assetId),['asset-1']); assert.deepEqual((await second).assets.map(value=>value.assetId),['asset-1']);
  const game=await prepareSharedAssetInventory({role:'game',profileId:'game-1',network:'mutinynet',load:async()=>[asset('game-asset')]});
  assert.deepEqual(game.assets.map(value=>value.assetId),['game-asset']); assert.deepEqual(getSharedAssetInventory('player','player-1','mutinynet').assets.map(value=>value.assetId),['asset-1']);
});
