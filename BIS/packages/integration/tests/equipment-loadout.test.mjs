import test from 'node:test';
import assert from 'node:assert/strict';
import {createBisEquipment} from '../src/core/equipment-loadout.ts';
import {bisMarketplaceItems,marketplaceItemMetadata} from '../src/core/equipment.ts';

const chainAsset=(index,profile='a')=>{const item=bisMarketplaceItems[index];return {assetId:(profile==='a'?'a':'b').repeat(64)+String(index).padStart(4,'0'),quantity:'1',iconUrl:`https://chain.example/${profile}/${index}.png`,metadata:{bisSchemaVersion:'1',...marketplaceItemMetadata(item)}};};
function contextFixture(){
  let profileId='a',assets=[chainAsset(0),chainAsset(1),chainAsset(3)],unavailable=false;const listeners=new Set();
  return {context:{getState:()=>({profileId}),subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},listAssets:async()=>unavailable?{status:'error',code:'unavailable',message:'no'}:{status:'success',profileId,assets}},setProfile(id,next){profileId=id;assets=next;listeners.forEach(l=>l());},setAssets(next){assets=next;},setUnavailable(value){unavailable=value;}};
}
function storage(t){const values=new Map(),prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});t.after(()=>prior?Object.defineProperty(globalThis,'localStorage',prior):Reflect.deleteProperty(globalThis,'localStorage'));return values;}

test('no item is selected by default and one freshly owned item per family can be selected or cleared',async t=>{
  storage(t);const f=contextFixture(),service=createBisEquipment(f.context);let state=await service.refresh();
  assert.deepEqual(state.effective,{});assert.equal(state.ownedItems.length,3);
  state=await service.select(chainAsset(0).assetId);assert.equal(state.effective.Shoes.tier,1);
  state=await service.select(chainAsset(1).assetId);assert.equal(state.effective.Shoes.tier,2);assert.equal(Object.keys(state.effective).length,1);
  state=await service.select(chainAsset(3).assetId);assert.equal(state.effective.Dagger.tier,1);
  state=await service.clear('Shoes');assert.equal(state.effective.Shoes,undefined);assert.equal(state.effective.Dagger.tier,1);service.dispose();
});

test('profiles are isolated and lost ownership clears only that family',async t=>{
  const values=storage(t),f=contextFixture(),service=createBisEquipment(f.context);await service.refresh();await service.select(chainAsset(0).assetId);await service.select(chainAsset(3).assetId);
  f.setAssets([chainAsset(3)]);let state=await service.refresh();assert.equal(state.effective.Shoes,undefined);assert.equal(state.effective.Dagger.tier,1);
  f.setProfile('b',[chainAsset(2,'b')]);await new Promise(r=>setImmediate(r));state=await service.refresh();assert.deepEqual(state.effective,{});await service.select(chainAsset(2,'b').assetId);
  assert.ok(values.has('bis-signet-equipment-v1:a'));assert.ok(values.has('bis-signet-equipment-v1:b'));service.dispose();
});

test('generic assets and trophies are excluded, unavailable reads apply no effects, and chain URLs pass through',async t=>{
  storage(t);const f=contextFixture();const item=chainAsset(0),trophy={...chainAsset(1),metadata:{...chainAsset(1).metadata,bisAssetType:'trophy'}};f.setAssets([item,trophy,{assetId:'c'.repeat(68),quantity:'1',name:'generic'}]);
  const service=createBisEquipment(f.context);let state=await service.refresh();assert.equal(state.ownedItems.length,1);assert.equal(state.ownedItems[0].iconUrl,item.iconUrl);await service.select(item.assetId);
  f.setUnavailable(true);state=await service.refresh();assert.equal(state.status,'unavailable');assert.deepEqual(state.effective,{});service.dispose();
});
