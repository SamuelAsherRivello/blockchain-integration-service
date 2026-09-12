import test from 'node:test';
import assert from 'node:assert/strict';
import { listMarketplaceItems } from '../src/admin/marketplace-list.ts';

test('H3 reports only marketplace equipment from a fresh wallet listing', async () => {
  const equipment = {
    assetId: 'a'.repeat(64), quantity: '1', iconUrl:'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/shoes-1.png',
    metadata: {bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:'item',bisCatalogId:'stealth-steel-shoes-1',bisEquipmentFamily:'Shoes',bisTier:'1',bisPriceSats:'1000'},
  };
  const unrelated = {assetId:'b'.repeat(64),quantity:'1',name:'Other'};
  const result = await listMarketplaceItems({async listAssets(){return {status:'success',profileId:'game',assets:[equipment,unrelated]};}}, () => true);
  assert.equal(result.status, 'success');
  assert.equal(result.profileId, 'game');
  assert.deepEqual(result.items.map(({assetId,quantity,catalogId,family,tier,priceSats}) => ({assetId,quantity,catalogId,family,tier,priceSats})), [{assetId:equipment.assetId,quantity:'1',catalogId:'stealth-steel-shoes-1',family:'Shoes',tier:1,priceSats:1000}]);
});
