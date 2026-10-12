import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetManager} from '@arkade-os/sdk';
import {encodeAssetMetadata} from '../../src/client/wallet-layer-arkade/asset-metadata.ts';
import {normalizeAssetMetadata} from '../../src/client/state-layer-core/assets.ts';
import {bisMarketplaceItems,marketplaceItemMetadata,classifyBisEquipmentAsset} from '../../src/client/state-layer-core/equipment.ts';

test('all nine structured items pass the actual SDK encoder and hex listing round-trip',async()=>{
  const stop=Error('Stop before funding or submission');
  const manager=new AssetManager({getSpendableVtxos:async()=>{throw stop;}});
  await assert.rejects(manager.issue({amount:1n,metadata:marketplaceItemMetadata(bisMarketplaceItems[0])}),/Invalid metadata value type/);
  for(const item of bisMarketplaceItems){
    const metadata={bisSchemaVersion:'1',...marketplaceItemMetadata(item)};
    const encoded=encodeAssetMetadata(metadata);
    await assert.rejects(manager.issue({amount:1n,metadata:encoded}),error=>error===stop);
    const listed=Object.fromEntries(Object.entries(encoded).map(([key,value])=>[key,Buffer.from(String(value),'utf8').toString('hex')]));
    const normalized=normalizeAssetMetadata(listed,'list');
    assert.deepEqual(normalized,metadata);
    const classified=classifyBisEquipmentAsset({assetId:item.catalogId,quantity:'1',iconUrl:item.iconUrl,metadata:normalized});
    assert.deepEqual(classified.attributeDeltas,item.attributeDeltas);
  }
  assert.deepEqual(normalizeAssetMetadata({bisAttributeDeltas:Buffer.from(encodeAssetMetadata({bisAttributeDeltas:[]}).bisAttributeDeltas).toString('hex')},'list'),{bisAttributeDeltas:[]});
});

test('untrusted structured strings never throw or fabricate equipment effects',()=>{
  for(const value of ['broken','null','true','123','{}','"text"','[{"bisAttribute":"movementSpeed","bisAttributeDelta":999}]']){
    const metadata=normalizeAssetMetadata({bisAttributeDeltas:Buffer.from(value).toString('hex'),bisDescription:'Readable'},'list');
    assert.equal(metadata.bisAttributeDeltas,undefined);
    assert.equal(metadata.bisDescription,'Readable');
  }
});
