import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateAssets} from '../../src/client/state-layer-core/asset-migration.ts';

const assets=[{assetId:'a',quantity:'1'},{assetId:'b',quantity:'1'}];
test('migration delivers before retiring and continues independently after recovery is needed',async()=>{
  const calls:string[]=[];
  const result=await migrateAssets(assets,{isCurrent:()=>true,mintAndDeliver:async asset=>{calls.push(`deliver:${asset.assetId}`);return 'delivered';},retire:async asset=>{calls.push(`retire:${asset.assetId}`);return asset.assetId==='a'?'pending':'retired';}});
  assert.deepEqual(calls,['deliver:a','retire:a','deliver:b','retire:b']);
  assert.deepEqual(result.map(entry=>entry.status),['pending','completed']);
});
test('a pending delivery never retires or duplicates the source item',async()=>{
  let retires=0;const [result]=await migrateAssets([assets[0]],{isCurrent:()=>true,mintAndDeliver:async()=> 'pending',retire:async()=>{retires++;return 'retired';}});
  assert.equal(result.status,'pending');assert.equal(retires,0);
});
