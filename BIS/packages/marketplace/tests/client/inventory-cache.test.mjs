import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketplaceInventoryCoordinator } from '../../src/client/inventory-layer/inventory-cache.ts';
import { createPublicAssetInventory, invalidatePublicAssetInventory } from '../../../integration/src/client/state-layer-core/public-asset-inventory.ts';
const item = (assetId='asset-1') => ({catalogId:'stealth-steel-shoes-1',name:'Shoes I',ticker:'SHO1',family:'Shoes',tier:1,priceSats:1000,description:'Increases movement speed by 10%.',attributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}],iconUrl:'https://example.com/shoes-1.png',assetId,quantity:'1'});

test('wallet evidence during an active forced public read starts replacement work and rejects late publication',async()=>{
 const coordinator=createMarketplaceInventoryCoordinator();const scope={role:'game',profileId:'invalidation-race',address:'public-address',network:'mutinynet'};
 const releases=[];let calls=0;
 const prepare=createPublicAssetInventory(async()=>{calls++;return new Promise(resolve=>releases.push(resolve));});
 const source={role:'game',walletId:scope.address,network:scope.network,read:async force=>{
  const result=await prepare(scope,force);if(result.status!=='success')throw Error('Unavailable');return result.assets.map(asset=>item(asset.assetId));
 }};
 const original=coordinator.refresh([source],true);await new Promise(resolve=>setImmediate(resolve));
 invalidatePublicAssetInventory(scope);const replacement=coordinator.invalidate([source]);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,2);assert.equal(coordinator.getState().game.status,'loading');
 releases[1]([{assetId:'replacement',quantity:'1'}]);await replacement;
 releases[0]([{assetId:'obsolete',quantity:'1'}]);await original;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(coordinator.getState().game.status,'ready');assert.equal(coordinator.getState().game.items[0].assetId,'replacement');
 invalidatePublicAssetInventory(scope);coordinator.dispose();
});

test('overlapping refreshes share a deadline and Retry clears the failed attempt', async()=>{
  const coordinator=createMarketplaceInventoryCoordinator({readTimeoutMs:5}); let calls=0;
  const source={role:'game',walletId:'one',network:'mutinynet',read:()=>{calls++;return new Promise(()=>{});}};
  await Promise.all([coordinator.refresh([source]),coordinator.refresh([source])]);
  assert.equal(calls,1);assert.equal(coordinator.getState().game.status,'unavailable');
  let release;
  const retry=coordinator.retry({...source,read:()=>{calls++;return new Promise(resolve=>{release=resolve;});}});
  assert.equal(coordinator.getState().game.error,undefined);assert.equal(coordinator.getState().game.status,'loading');
  release([item()]);await retry;assert.equal(calls,2);assert.equal(coordinator.getState().game.status,'ready');
});
test('post-trade refresh forces both sources, replaces older pending work, and deduplicates forced callers',async()=>{
 const c=createMarketplaceInventoryCoordinator();let releaseOld,releaseFresh;const calls=[];
 const source={role:'player',walletId:'player',network:'mutinynet',read:force=>{calls.push(force);return new Promise(resolve=>{if(force)releaseFresh=resolve;else releaseOld=resolve;});}};
 const old=c.refresh([source]);const fresh=c.refresh([source],true),joined=c.refresh([source],true);
 assert.deepEqual(calls,[false,true]);releaseFresh([item('purchased')]);await Promise.all([fresh,joined]);
 releaseOld([]);await old;assert.equal(c.getState().player.items[0].assetId,'purchased');
 const roles=[];await c.refresh(['player','game'].map(role=>({role,walletId:role,network:'mutinynet',read:async force=>{roles.push([role,force]);return [];}})),true);
 assert.deepEqual(roles,[['player',true],['game',true]]);c.dispose();
});

test('coordinator resolves both wallets independently', async() => {
  const coordinator = createMarketplaceInventoryCoordinator(); let releasePlayer, releaseGame;
  const playerRead = new Promise(resolve => { releasePlayer = resolve; }), gameRead = new Promise(resolve => { releaseGame = resolve; });
  const sources = [{role:'player',walletId:'player-1',network:'signet',read:async()=>{await playerRead;return[item('player-item')]}},{role:'game',walletId:'game-1',network:'signet',read:async()=>{await gameRead;throw Error('private sdk details')}}];
  const refresh = coordinator.refresh(sources); assert.equal(coordinator.getState().player.status,'loading'); assert.equal(coordinator.getState().game.status,'loading'); releaseGame(); await new Promise(resolve => setImmediate(resolve)); assert.equal(coordinator.getState().game.status,'unavailable'); releasePlayer(); await refresh; assert.equal(coordinator.getState().player.status,'ready');
});
test('repeated coordinator refresh delegates cache ownership to BIS', async() => {
  const coordinator = createMarketplaceInventoryCoordinator(); let calls=0; const source={role:'game',walletId:'game-1',network:'signet',read:async()=>{calls++;return[item()]}};
  await coordinator.refresh([source]); await coordinator.refresh([source]); assert.equal(calls,2);
});
test('explicit retry replaces a result and retains prior items while pending', async() => {
  const coordinator = createMarketplaceInventoryCoordinator(); const source={role:'player',walletId:'player-1',network:'signet',read:async()=>[item('player-item-1')]};
  await coordinator.refresh([source]); let release; const pending=new Promise(resolve=>{release=resolve}); const refresh=coordinator.retry({role:'player',walletId:'player-1',network:'signet',read:async()=>{await pending;return[item('player-item-2')]}});
  assert.equal(coordinator.getState().player.status,'loading'); assert.deepEqual(coordinator.getState().player.items.map(value=>value.assetId),['player-item-1']); release(); await refresh; assert.deepEqual(coordinator.getState().player.items.map(value=>value.assetId),['player-item-2']);
});
test('metadata states remain distinct from empty and unavailable', async() => {
  const coordinator = createMarketplaceInventoryCoordinator();
  await coordinator.refresh([{role:'game',walletId:'game-1',network:'signet',read:async()=>({items:[],migrationRequiredCount:2})}]);
  assert.equal(coordinator.getState().game.status,'migration-required');
  assert.equal(coordinator.getState().game.migrationRequiredCount,2);
  await coordinator.refresh([{role:'game',walletId:'game-1',network:'signet',read:async()=>({items:[],invalidMetadataCount:1})}]);
  assert.equal(coordinator.getState().game.status,'invalid-metadata');
  assert.equal(coordinator.getState().game.invalidMetadataCount,1);
  await coordinator.refresh([{role:'game',walletId:'game-1',network:'signet',read:async()=>({items:[]})}]);
  assert.equal(coordinator.getState().game.status,'empty');
});
test('a stalled inventory read becomes unavailable instead of loading forever', async() => {
  const coordinator = createMarketplaceInventoryCoordinator({readTimeoutMs:5});
  await coordinator.refresh([{role:'game',walletId:'game-1',network:'signet',read:()=>new Promise(()=>{})}]);
  assert.equal(coordinator.getState().game.status,'unavailable');
  assert.match(coordinator.getState().game.error,/Try again/);
});
