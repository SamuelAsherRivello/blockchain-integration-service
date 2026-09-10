import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVerifiedMarketplaceCatalog,
  isVerifiedMarketplaceCatalog,
  marketplaceCatalogItems,
  marketplaceMintRequest,
  verifiedMarketplaceRecordsFromAssets,
} from '../src/admin/marketplace-catalog.ts';

const address = 'ark1publicgamewallet';
const mintedItems = marketplaceCatalogItems.map((item, index) => ({
  ...item,
  assetId: `asset-${index + 1}`,
  quantity: '1',
}));

test('the public Stealth & Steel catalog requires all nine verified mint records', () => {
  assert.deepEqual(marketplaceCatalogItems.map(item => item.name), [
    'Shoes I', 'Shoes II', 'Shoes III',
    'Dagger I', 'Dagger II', 'Dagger III',
    'Shield I', 'Shield II', 'Shield III',
  ]);
  assert.deepEqual(marketplaceCatalogItems.map(item => item.priceSats), [1000, 2000, 3000, 1100, 2100, 3100, 1200, 2200, 3200]);
  assert.deepEqual(marketplaceCatalogItems.map(item => item.effectPercent), [10, 20, 30, 10, 20, 30, 10, 20, 30]);
  const catalog = createVerifiedMarketplaceCatalog(address, mintedItems);
  assert.ok(catalog);
  assert.equal(isVerifiedMarketplaceCatalog(catalog), true);
  assert.equal(createVerifiedMarketplaceCatalog(address, mintedItems.slice(0, 8)), null);
  assert.equal(createVerifiedMarketplaceCatalog(address, mintedItems.map((item, index) => index === 4 ? {...item, assetId:''} : item)), null);
  assert.equal(createVerifiedMarketplaceCatalog(address, mintedItems.map((item, index) => index === 4 ? {...item, name:'Wrong item'} : item)), null);
});

test('every catalog mint uses a deterministic, distinct operation ID for recovery', () => {
  const firstAttempt = marketplaceCatalogItems.map(marketplaceMintRequest);
  const retry = marketplaceCatalogItems.map(marketplaceMintRequest);
  assert.deepEqual(retry, firstAttempt);
  assert.equal(new Set(firstAttempt.map(request => request.operationId)).size, 9);
  assert.deepEqual(firstAttempt[0], {
    operationId: 'marketplace-stealth-steel-shoes-1-v2',
    name: 'Shoes I', ticker: 'SHO1', amount: '1', decimals: 0,
    iconUrl: 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/shoes-1.png',
    metadata: {
      bisAssetType: 'item',
      bisCatalogId: 'stealth-steel-shoes-1',
      bisEquipmentFamily: 'Shoes',
      bisGameId: 'stealth-and-steel',
      bisPriceSats: '1000',
      bisTier: '1',
    },
  });
});

test('the catalog input rejects templates and mismatched game data', () => {
  assert.equal(isVerifiedMarketplaceCatalog({
    version: 1, gameId: 'stealth-and-steel', gameWalletAddress: address,
    items: marketplaceCatalogItems,
  }), false);
  assert.equal(isVerifiedMarketplaceCatalog({
    version: 1, gameId: 'another-game', gameWalletAddress: address, items: mintedItems,
  }), false);
});

test('fresh chain holdings must contain exactly one fully classified asset per catalog item', () => {
  const assets = marketplaceCatalogItems.map((item, index) => ({
    assetId: `asset-${index + 1}`,
    quantity: '1',
    iconUrl: item.iconUrl,
    metadata: {
      bisSchemaVersion: '1', bisGameId: 'stealth-and-steel', bisAssetType: 'item',
      bisCatalogId: item.id, bisEquipmentFamily: item.family,
      bisTier: String(item.tier), bisPriceSats: String(item.priceSats),
    },
  }));
  assert.equal(verifiedMarketplaceRecordsFromAssets(assets).length, 9);
  assert.equal(verifiedMarketplaceRecordsFromAssets(assets.slice(0, 8)), null);
  assert.equal(verifiedMarketplaceRecordsFromAssets([...assets, {...assets[0],assetId:'duplicate'}]), null);
  assert.equal(verifiedMarketplaceRecordsFromAssets(assets.map((asset,index)=>index===1?{...asset,metadata:{...asset.metadata,bisAssetType:'trophy'}}:asset)), null);
});
