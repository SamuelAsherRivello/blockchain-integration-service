import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketplaceInventoryCoordinator } from '../../src/client/inventory-layer/inventory-cache.ts';
const item = (assetId='asset-1') => ({catalogId:'stealth-steel-shoes-1',name:'Shoes I',ticker:'SHO1',family:'Shoes',tier:1,priceSats:1000,description:'Increases movement speed by 10%.',attributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}],iconUrl:'https://example.com/shoes-1.png',assetId,quantity:'1'});
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
