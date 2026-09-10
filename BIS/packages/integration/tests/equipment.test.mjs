import test from 'node:test';
import assert from 'node:assert/strict';
import { bisMarketplaceItems, classifyBisEquipmentAsset, marketplaceItemMetadata } from '../src/core/equipment.ts';

test('the shared catalog defines exactly nine approved items, prices, effects, and immutable URLs', () => {
  assert.deepEqual(bisMarketplaceItems.map(item => item.name), [
    'Shoes I', 'Shoes II', 'Shoes III',
    'Dagger I', 'Dagger II', 'Dagger III',
    'Shield I', 'Shield II', 'Shield III',
  ]);
  assert.deepEqual(bisMarketplaceItems.map(item => item.priceSats), [1000, 2000, 3000, 1100, 2100, 3100, 1200, 2200, 3200]);
  assert.deepEqual(bisMarketplaceItems.map(item => item.effectPercent), [10, 20, 30, 10, 20, 30, 10, 20, 30]);
  for (const item of bisMarketplaceItems) {
    assert.equal(item.iconUrl, `https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/${item.family.toLowerCase()}-${item.tier}.png`);
  }
});

test('the classifier accepts only complete matching item metadata and preserves the chain icon URL', () => {
  const definition = bisMarketplaceItems[0];
  const metadata = { bisSchemaVersion: '1', ...marketplaceItemMetadata(definition) };
  const iconUrl = 'https://cdn.example.com/from-chain.png';
  const asset = { assetId: 'asset-shoes-1', quantity: '1', name: 'Untrusted display name', iconUrl, metadata };
  assert.deepEqual(classifyBisEquipmentAsset(asset), { ...definition, assetId: asset.assetId, quantity: '1', iconUrl });
  assert.equal(classifyBisEquipmentAsset({ ...asset, metadata: { ...metadata, bisAssetType: 'trophy' } }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, metadata: { ...metadata, bisPriceSats: '999' } }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, metadata: { ...metadata, bisEquipmentFamily: 'Shield' } }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, metadata: { ...metadata, bisSchemaVersion: '2' } }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, iconUrl: 'http://example.com/icon.png' }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, quantity: '0' }), null);
  assert.equal(classifyBisEquipmentAsset({ ...asset, metadata: undefined }), null);
});
