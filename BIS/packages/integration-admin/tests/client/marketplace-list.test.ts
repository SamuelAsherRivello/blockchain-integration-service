import test from 'node:test';
import assert from 'node:assert/strict';
import { listMarketplaceItems } from '../../src/client/admin-layer/marketplace-list.ts';

test('C.G.4 reports only marketplace equipment from a fresh wallet listing', async () => {
  const equipment = {
    assetId: 'a'.repeat(64), quantity: '1', iconUrl:'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/shoes-1.png',
    metadata: {bisAssetFormatVersion:'0.0.2',bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:'item',bisCatalogId:'stealth-steel-shoes-1',bisEquipmentFamily:'Shoes',bisTier:'1',bisPriceSats:'1000',bisDescription:'Increases movement speed by 10%.',bisAttributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}]},
  };
  const unrelated = {assetId:'b'.repeat(64),quantity:'1',name:'Other'};
  const progress = [];
  const result = await listMarketplaceItems({async listAssets(){return {status:'success',profileId:'game',assets:[equipment,unrelated]};}}, () => true, event => progress.push(event));
  assert.equal(result.status, 'success');
  assert.equal(result.profileId, 'game');
  assert.deepEqual(result.items.map(({assetId,quantity,catalogId,family,tier,priceSats}) => ({assetId,quantity,catalogId,family,tier,priceSats})), [{assetId:equipment.assetId,quantity:'1',catalogId:'stealth-steel-shoes-1',family:'Shoes',tier:1,priceSats:1000}]);
  assert.deepEqual(progress,[{stage:'listing'},{stage:'classifying',total:2}]);
});

test('C.G.4 can explicitly inspect a legacy format without changing its latest default', async () => {
  const legacy = {assetId:'d'.repeat(64),quantity:'1',iconUrl:'https://example.com/shoes.png',metadata:{bisAssetFormatVersion:'0.0.1',bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:'item',bisCatalogId:'stealth-steel-shoes-1',bisEquipmentFamily:'Shoes',bisTier:'1',bisPriceSats:'1000',bisDescription:'Increases movement speed by 10%.',bisAttributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}]}};
  const wallet={async listAssets(){return {status:'success' as const,profileId:'game',assets:[legacy]};}};
  const latest=await listMarketplaceItems(wallet,()=>true);
  const selected=await listMarketplaceItems(wallet,()=>true,()=>{},'0.0.1');
  assert.deepEqual(latest.status==='success'?latest.items:[],[]);
  assert.equal(selected.status==='success'?selected.items.length:0,1);
});

test('C.G.4 excludes a future asset format from marketplace operations', async () => {
  const future = {assetId:'c'.repeat(64),quantity:'1',iconUrl:'https://example.com/shoes.png',metadata:{bisAssetFormatVersion:'0.0.3',bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:'item',bisCatalogId:'stealth-steel-shoes-1',bisEquipmentFamily:'Shoes',bisTier:'1',bisPriceSats:'1000',bisDescription:'Increases movement speed by 10%.',bisAttributeDeltas:[{bisAttribute:'movementSpeed',bisAttributeDelta:10}]}};
  const result=await listMarketplaceItems({async listAssets(){return {status:'success',profileId:'game',assets:[future]};}},()=>true);
  assert.equal(result.status,'success');assert.deepEqual(result.items,[]);
});
