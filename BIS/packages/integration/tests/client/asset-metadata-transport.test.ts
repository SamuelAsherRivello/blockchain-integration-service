import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetManager} from '@arkade-os/sdk';
import {encodeAssetMetadata} from '../../src/client/wallet-layer-arkade/asset-metadata.ts';
import {normalizeAssetMetadata} from '../../src/client/state-layer-core/assets.ts';
import {bisMarketplaceItems,marketplaceItemMetadata,classifyBisEquipmentAsset} from '../../src/client/state-layer-core/equipment.ts';
import {BIS_LATEST_ASSET_FORMAT_VERSION,assetFormatMigrator,createBisAssetFormatRegistry,resolveBisAssetFormat} from '../../src/client/state-layer-core/asset-format.ts';

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

test('asset format resolution retains legacy holdings and rejects unknown or malformed markers',()=>{
  const item=bisMarketplaceItems[0], {bisAssetFormatVersion: _marker,...legacyMetadata}=marketplaceItemMetadata(item), legacy={assetId:'legacy',quantity:'1',iconUrl:item.iconUrl,metadata:{bisSchemaVersion:'1',...legacyMetadata}};
  assert.deepEqual(resolveBisAssetFormat(legacy),{status:'supported',version:'0.0.1',explicit:false});
  const current={...legacy,metadata:{...legacy.metadata,bisAssetFormatVersion:BIS_LATEST_ASSET_FORMAT_VERSION}};
  assert.deepEqual(resolveBisAssetFormat(current),{status:'supported',version:BIS_LATEST_ASSET_FORMAT_VERSION,explicit:true});
  assert.deepEqual(resolveBisAssetFormat({...legacy,metadata:{...legacy.metadata,bisAssetFormatVersion:'0.0.3'}}),{status:'unknown-version',version:'0.0.3'});
  assert.deepEqual(resolveBisAssetFormat({...legacy,metadata:{...legacy.metadata,bisAssetFormatVersion:'not-a-version'}}),{status:'malformed-version'});
});

test('successors must explicitly map or opt out of predecessor migration',()=>{
  assert.throws(()=>createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2'}]));
  const formats=createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2',predecessors:{'0.0.1':source=>({name:'replacement',ticker:'R',amount:source.quantity,decimals:0,metadata:{bisAssetFormatVersion:'0.0.2'}})}}]);
  assert.equal(formats[1]?.predecessorMigrations['0.0.1']!==undefined,true);
  assert.deepEqual({version:formats[1]?.version,compatiblePredecessors:formats[1]?.compatiblePredecessors,autoUpgrade:formats[1]?.autoUpgrade},{version:'0.0.2',compatiblePredecessors:['0.0.1'],autoUpgrade:true});
  assert.deepEqual({version:createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2',predecessors:{'0.0.1':false},autoUpgrade:false}])[1]?.version,compatiblePredecessors:createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2',predecessors:{'0.0.1':false},autoUpgrade:false}])[1]?.compatiblePredecessors,autoUpgrade:createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2',predecessors:{'0.0.1':false},autoUpgrade:false}])[1]?.autoUpgrade},{version:'0.0.2',compatiblePredecessors:[],autoUpgrade:false});
  assert.equal(typeof assetFormatMigrator('0.0.2','0.0.1'),'function','production upgrades legacy marketplace items');
});

test('untrusted structured strings never throw or fabricate equipment effects',()=>{
  for(const value of ['broken','null','true','123','{}','"text"','[{"bisAttribute":"movementSpeed","bisAttributeDelta":999}]']){
    const metadata=normalizeAssetMetadata({bisAttributeDeltas:Buffer.from(value).toString('hex'),bisDescription:'Readable'},'list');
    assert.equal(metadata.bisAttributeDeltas,undefined);
    assert.equal(metadata.bisDescription,'Readable');
  }
});
