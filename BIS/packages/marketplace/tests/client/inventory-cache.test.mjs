import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketplaceInventoryCoordinator, MARKETPLACE_INVENTORY_CACHE_TTL_MS, readMarketplaceInventoryCache, writeMarketplaceInventoryCache } from '../../src/client/inventory-layer/inventory-cache.ts';

const item = (assetId='asset-1') => ({catalogId:'stealth-steel-shoes-1',name:'Shoes I',ticker:'SHO1',family:'Shoes',tier:1,priceSats:1000,description:'Increases movement speed by 10%.',attributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}],iconUrl:'https://example.com/shoes-1.png',assetId,quantity:'1'});
const store = () => { const values = new Map(); return { getItem(key){return values.get(key) ?? null;}, setItem(key,value){values.set(key,value);}, removeItem(key){values.delete(key);}, values }; };

test('cache round trips public items and applies the five-minute freshness boundary', () => {
  const local = store();
  writeMarketplaceInventoryCache('player','player-1','mutinynet',[item()],1000,local);
  assert.equal(readMarketplaceInventoryCache('player','player-1','mutinynet',1000 + MARKETPLACE_INVENTORY_CACHE_TTL_MS - 1,local).status,'ready');
  assert.equal(readMarketplaceInventoryCache('player','player-1','mutinynet',1000 + MARKETPLACE_INVENTORY_CACHE_TTL_MS,local),undefined);
});

test('cache rejects wrong wallet, network, malformed, expired, oversized, and secret-bearing records', () => {
  const local = store();
  writeMarketplaceInventoryCache('player','player-1','signet',[item()],1000,local);
  assert.equal(readMarketplaceInventoryCache('player','player-2','signet',1001,local),undefined);
  assert.equal(readMarketplaceInventoryCache('player','player-1','mutinynet',1001,local),undefined);
  local.setItem([...local.values.keys()][0], JSON.stringify({version:1,role:'player',walletId:'player-1',network:'signet',fetchedAt:1000,items:[{...item(),secret:'never'}]}));
  assert.equal(readMarketplaceInventoryCache('player','player-1','signet',1001,local),undefined);
  local.setItem('bis-marketplace-inventory-v1:player:signet:bad', '{');
  assert.equal(readMarketplaceInventoryCache('player','bad','signet',1001,local),undefined);
});

test('coordinator resolves both wallets independently and never serializes provider errors', async () => {
  const local = store(), now = 1000, coordinator = createMarketplaceInventoryCoordinator({now:()=>now,store:local});
  let releasePlayer, releaseGame;
  const playerRead = new Promise(resolve => { releasePlayer = resolve; });
  const gameRead = new Promise(resolve => { releaseGame = resolve; });
  const sources = [
    {role:'player',walletId:'player-1',network:'signet',read:async()=>{await playerRead;return[item('player-item')]}},
    {role:'game',walletId:'game-1',network:'signet',read:async()=>{await gameRead;throw Error('private sdk details');}},
  ];
  const refresh = coordinator.refresh(sources);
  assert.equal(coordinator.getState().player.status,'loading');
  assert.equal(coordinator.getState().game.status,'loading');
  releaseGame();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(coordinator.getState().game.status,'unavailable');
  releasePlayer();
  await refresh;
  assert.equal(coordinator.getState().player.status,'ready');
  assert.equal(coordinator.getState().game.status,'unavailable');
  assert.equal(coordinator.getState().game.error,'This wallet’s item inventory is unavailable. Try again.');
  assert.doesNotMatch(JSON.stringify([...local.values.values()]),/private sdk details/);
});

test('fresh cache prevents another provider read until expiry', async() => {
  const local = store(), coordinator = createMarketplaceInventoryCoordinator({now:()=>2000,store:local});
  let calls=0;
  const source={role:'game',walletId:'game-1',network:'signet',read:async()=>{calls++;return[item()]}};
  await coordinator.refresh([source]);
  await coordinator.refresh([source]);
  assert.equal(calls,1);
});

test('explicit retry bypasses a fresh cache after a completed wallet operation', async() => {
  const local = store(), coordinator = createMarketplaceInventoryCoordinator({now:()=>2000,store:local});
  let calls=0;
  const source={role:'game',walletId:'game-1',network:'signet',read:async()=>{calls++;return[item(`asset-${calls}`)]}};
  await coordinator.refresh([source]);
  await coordinator.retry(source);
  assert.equal(calls,2);
  assert.equal(coordinator.getState().game.items[0].assetId,'asset-2');
});
