import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceCatalogItems, marketplaceMintRequest } from '../src/admin/marketplace-catalog.ts';
import { mintAndVerifyMarketplaceCatalog } from '../src/admin/marketplace-mint-batch.ts';

function chainAssets() {
  return marketplaceCatalogItems.map((item, index) => ({
    assetId: `asset-${index + 1}`, quantity: '1', iconUrl: item.iconUrl,
    metadata: {
      bisSchemaVersion:'1', bisGameId:'stealth-and-steel', bisAssetType:'item',
      bisCatalogId:item.id, bisEquipmentFamily:item.family,
      bisTier:String(item.tier), bisPriceSats:String(item.priceSats),
    },
  }));
}

test('a repeated batch uses the same v2 IDs and publishes only after a fresh complete read', async () => {
  const calls = [], issued = new Map();
  const wallet = {
    async mint(request) {
      calls.push(request.operationId);
      const prior = issued.get(request.operationId);
      if (prior) return {status:'already-minted',profileId:'game',operationId:request.operationId,asset:prior};
      const asset = {assetId:`asset-${issued.size + 1}`,quantity:'1'}; issued.set(request.operationId,asset);
      return {status:'minted',profileId:'game',operationId:request.operationId,asset};
    },
    async listAssets() { return {status:'success',profileId:'game',assets:chainAssets()}; },
  };
  assert.equal((await mintAndVerifyMarketplaceCatalog(wallet,()=>true)).status,'verified');
  assert.equal((await mintAndVerifyMarketplaceCatalog(wallet,()=>true)).status,'verified');
  assert.deepEqual(calls.slice(0,9),marketplaceCatalogItems.map(item=>marketplaceMintRequest(item).operationId));
  assert.deepEqual(calls.slice(9),calls.slice(0,9));
  assert.equal(issued.size,9);
});

test('an interrupted or incomplete batch never returns verified publication records', async () => {
  let count=0;
  const paused = await mintAndVerifyMarketplaceCatalog({
    async mint(request) { count++; return count===4?{status:'error',code:'outcome-unknown',message:'unknown'}:{status:'minted',profileId:'game',operationId:request.operationId,asset:{assetId:`a${count}`,quantity:'1'}}; },
    async listAssets() { throw Error('must not publish'); },
  },()=>true);
  assert.deepEqual(paused,{status:'error',itemName:'Dagger I',code:'outcome-unknown'});
  const incomplete = await mintAndVerifyMarketplaceCatalog({
    async mint(request) { return {status:'already-minted',profileId:'game',operationId:request.operationId,asset:{assetId:'a',quantity:'1'}}; },
    async listAssets() { return {status:'success',profileId:'game',assets:chainAssets().slice(0,8)}; },
  },()=>true);
  assert.deepEqual(incomplete,{status:'error',code:'verification-failed'});
});
