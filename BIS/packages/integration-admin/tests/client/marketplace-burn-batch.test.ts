import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceCatalogItems } from '../../src/client/admin-layer/marketplace-catalog.ts';
import { burnAllMarketplaceItems, marketplaceBurnRequest, marketplaceListingBurnRequest, exactMarketplaceListingTargets, burnMarketplaceListing } from '../../src/client/admin-layer/marketplace-burn-batch.ts';

function asset(item,index,type='item') { return {
  assetId:`${String(index+1).padStart(64,'a')}0000`,quantity:'1',iconUrl:item.iconUrl,
  metadata:{bisSchemaVersion:'1',bisGameId:'stealth-and-steel',bisAssetType:type,bisCatalogId:item.id,bisEquipmentFamily:item.family,bisTier:String(item.tier),bisPriceSats:String(item.priceSats),bisDescription:item.description,bisAttributeDeltas:item.attributeDeltas},
}; }

test('C.G.3 selects only freshly classified marketplace items and preserves trophies and unrelated assets',async()=>{
  const items=marketplaceCatalogItems.slice(0,2).map((item,index)=>asset(item,index));
  const trophy={...asset(marketplaceCatalogItems[2],2,'trophy'),assetId:'f'.repeat(64)+'0000'};
  const unrelated={assetId:'e'.repeat(64)+'0000',quantity:'1',name:'Other'};
  const calls=[];
  const result=await burnAllMarketplaceItems({
    async listAssets(){return {status:'success',profileId:'game',assets:[...items,trophy,unrelated]};},
    async burnAsset(request){calls.push(request);return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'d'.repeat(64)};},
  },()=>true);
  assert.equal(result.status,'complete');assert.equal(result.burned,2);
  assert.deepEqual(calls,items.map(item=>marketplaceBurnRequest(item.assetId,item.quantity)));
});

test('C.G.3 continues after item-scoped unknown outcomes and a later invocation never changes operation IDs',async()=>{
  const items=marketplaceCatalogItems.slice(0,3).map((item,index)=>asset(item,index));
  const calls=[];
  let listCalls=0;
  const wallet={
    async listAssets(){listCalls++;return {status:'success',profileId:'game',assets:items};},
    async burnAsset(request){calls.push(request);return calls.length===1?{status:'error',code:'outcome-unknown',message:'unknown'}:{status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'d'.repeat(64)};},
  };
  const result=await burnAllMarketplaceItems(wallet,()=>true);
  assert.deepEqual({status:result.status,burned:result.burned,unresolved:result.unresolved,skipped:result.skipped},{status:'partial',burned:2,unresolved:1,skipped:0});
  assert.equal(listCalls,4);
  const firstIds=calls.map(call=>call.operationId);calls.length=0;await burnAllMarketplaceItems(wallet,()=>true);
  assert.deepEqual(calls.map(call=>call.operationId),firstIds);
});

test('C.G.3 refreshes after each verified burn until no marketplace items remain',async()=>{
  const items=marketplaceCatalogItems.slice(0,4).map((item,index)=>asset(item,index));
  const live=[...items],calls=[],listed=[];
  const progress=[];
  const result=await burnAllMarketplaceItems({
    async listAssets(){listed.push(live.map(item=>item.assetId));return {status:'success',profileId:'game',assets:[...live]};},
    async burnAsset(request){
      calls.push(request);
      const index=live.findIndex(item=>item.assetId===request.assetId);
      assert.notEqual(index,-1);
      live.splice(index,1);
      return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'d'.repeat(64)};
    },
  },()=>true,event=>progress.push(event));
  assert.equal(result.status,'complete');
  assert.equal(result.burned,4);
  assert.equal(live.length,0);
  assert.equal(listed.length,5);
  assert.deepEqual(calls.map(call=>call.operationId),items.map(item=>marketplaceBurnRequest(item.assetId,item.quantity).operationId));
  assert.equal(progress.filter(event=>event.stage==='listing').length,5);
  assert.equal(progress.filter(event=>event.stage==='burned').length,4);
});

test('wallet changes stop new item submissions without making the batch throw',async()=>{
  const items=marketplaceCatalogItems.slice(0,3).map((item,index)=>asset(item,index));let current=true,calls=0;
  const result=await burnAllMarketplaceItems({
    async listAssets(){return {status:'success',profileId:'game',assets:items};},
    async burnAsset(request){calls++;current=false;return {status:'error',code:'account-changed',message:'changed'};},
  },()=>current);
  assert.equal(calls,1);assert.equal(result.skipped,1);assert.equal(result.status,'partial');
});

test('listing burn requires exactly one legacy or current asset for every catalog id', async()=>{
  const items=marketplaceCatalogItems.map((item,index)=>asset(item,index));
  assert.equal(exactMarketplaceListingTargets(items).length,9);
  assert.equal(exactMarketplaceListingTargets(items.slice(1)),null);
  assert.equal(exactMarketplaceListingTargets([...items,{...items[0],assetId:'z'.repeat(64)+'0000'}]),null);
});

test('listing burn selects only the exact nine targets, verifies absence, and uses stable listing burn ids', async()=>{
  const live=marketplaceCatalogItems.map((item,index)=>asset(item,index));
  const calls=[];
  const result=await burnMarketplaceListing({
    async listAssets(){return {status:'success',profileId:'game',assets:[...live]};},
    async burnAsset(request){calls.push(request);const index=live.findIndex(item=>item.assetId===request.assetId);assert.notEqual(index,-1);live.splice(index,1);return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'d'.repeat(64)};},
  },()=>true);
  assert.deepEqual({status:result.status,eligible:result.eligible,burned:result.burned,unresolved:result.unresolved,skipped:result.skipped},{status:'complete',eligible:9,burned:9,unresolved:0,skipped:0});
  assert.deepEqual(calls.map(call=>call.operationId),marketplaceCatalogItems.map((_,index)=>marketplaceListingBurnRequest(`${String(index+1).padStart(64,'a')}0000`,'1').operationId));
  assert.equal(live.length,0);
});
