import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAssetMintBatch } from '../../src/client/state-layer-core/asset-mint-batch.ts';
import { prepareAssetMintBatch } from '../../src/client/wallet-layer-arkade/asset-mint-batch.ts';
import { bisMarketplaceItems, marketplaceItemMetadata } from '../../src/client/state-layer-core/equipment.ts';
import { RestIndexerProvider } from '@arkade-os/sdk';

const requests=bisMarketplaceItems.map(item=>({operationId:`marketplace-${item.catalogId}-v3`,name:item.name,ticker:item.ticker,amount:'1',decimals:0,iconUrl:item.iconUrl,metadata:marketplaceItemMetadata(item)}));
const history=(batch=requests)=>batch.map((request,index)=>({request,status:'succeeded',network:'signet',asset:{assetId:`asset-${index}`,quantity:'1'}}));
test('legacy generation is stable until all nine issuances have verified zero supply',async()=>{
  assert.deepEqual(await selectAssetMintBatch(requests,[],()=>assert.fail('no supply lookup')),requests);
  const records=history();
  assert.deepEqual(await selectAssetMintBatch(requests,records,async()=>1n),requests);
  const next=await selectAssetMintBatch(requests,records,async()=>0n);
  assert.deepEqual(next.map(r=>r.operationId),requests.map(r=>r.operationId+'-g1'));
  assert.deepEqual(next.map(r=>r.metadata),requests.map(r=>r.metadata));
  assert.deepEqual(await selectAssetMintBatch(requests,records,async()=>0n),next);
  const interrupted=[...records,{...history(next)[0],status:'pending'}];
  assert.deepEqual(await selectAssetMintBatch(requests,interrupted,()=>assert.fail('pending is not replaced')),next);
  const partial=[...records,history(next)[0]];
  assert.deepEqual(await selectAssetMintBatch(requests,partial,()=>assert.fail('partial generation is not replaced')),next);
  const second=await selectAssetMintBatch(requests,[...records,...history(next)],async()=>0n);
  assert.ok(second.every(r=>r.operationId.endsWith('-g2')));
});
test('transferred, partially burned and unreadable assets cannot authorize replacement',async()=>{
  const records=history();
  assert.deepEqual(await selectAssetMintBatch(requests,records,async id=>id==='asset-0'?1n:0n),requests);
  await assert.rejects(selectAssetMintBatch(requests,records,async()=>{throw Error('offline');}),/offline/);
  await assert.rejects(selectAssetMintBatch(requests,records,async()=>-1n));
  await assert.rejects(selectAssetMintBatch(requests,records,async()=>undefined));
  await assert.rejects(selectAssetMintBatch(requests,[{...records[0],status:'pending',request:{...requests[0],operationId:'unrelated'}}],async()=>0n));
  await assert.rejects(selectAssetMintBatch(requests,[...records,{...records[0],status:'pending',request:{...requests[0],operationId:requests[0].operationId+'-g1'}},{...records[1],status:'pending',request:{...requests[1],operationId:requests[1].operationId+'-g1'}}],async()=>0n));
});
test('BIS preparation isolates journal networks and refuses corrupt or changed history',async t=>{
  const data=new Map();t.mock.method(RestIndexerProvider.prototype,'getAssetDetails',async assetId=>({assetId,supply:0n}));
  const previous=globalThis.localStorage;globalThis.localStorage={getItem:key=>data.get(key)??null};t.after(()=>{globalThis.localStorage=previous;});
  const key='bis-signet-mints-v1:fixture';data.set(key,JSON.stringify({version:1,operations:history()}));
  assert.ok((await prepareAssetMintBatch('fixture','signet',requests)).every(r=>r.operationId.endsWith('-g1')));
  assert.deepEqual(await prepareAssetMintBatch('fixture','mutinynet',requests),requests);
  data.set(key,'broken');await assert.rejects(prepareAssetMintBatch('fixture','signet',requests));
  data.set(key,JSON.stringify({version:1,operations:history()}));
  t.mock.method(RestIndexerProvider.prototype,'getAssetDetails',async assetId=>{data.delete(key);return {assetId,supply:0n};});
  await assert.rejects(prepareAssetMintBatch('fixture','signet',requests));
});
