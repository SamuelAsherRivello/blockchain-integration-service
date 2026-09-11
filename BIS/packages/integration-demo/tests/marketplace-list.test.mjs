import test from 'node:test';
import assert from 'node:assert/strict';
import { listMarketplaceItems } from '../src/admin/marketplace-list.ts';

test('H3 reports only marketplace equipment from a fresh wallet listing', async () => {
  const equipment = {
    assetId: 'a'.repeat(64), quantity: '1',
    metadata: {bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:'item',bisCatalogId:'stealth-steel-shoes-1',bisEquipmentFamily:'Shoes',bisTier:'1',bisPriceSats:'100'},
  };
  const unrelated = {assetId:'b'.repeat(64),quantity:'1',name:'Other'};
  const result = await listMarketplaceItems({async listAssets(){return {status:'success',profileId:'game',assets:[equipment,unrelated]};}}, () => true);
  assert.deepEqual(result, {status:'success',profileId:'game',items:[{assetId:equipment.assetId,quantity:'1',catalogId:'stealth-steel-shoes-1',family:'Shoes',tier:1,priceSats:100}]});
});
