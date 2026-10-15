import test from 'node:test';
import assert from 'node:assert/strict';
import {migrationRecordId,readAssetMigrationRecord,readAssetMigrationRecords,writeAssetMigrationRecord} from '../../src/client/state-layer-core/asset-migration-record.ts';
import {reconcileAssetMigration} from '../../src/client/state-layer-core/asset-migration.ts';
import {assetFormat002Fixture,assetFormat002OptOutFixture} from './asset-format-002-fixture.ts';

const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:(index:number)=>[...values.keys()][index]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
const source='a'.repeat(68),replacement='b'.repeat(68),id=migrationRecordId(source,'0.0.2');
test('migration journal reuses the source-target identity across reloads',()=>{
  values.clear();
  const record=writeAssetMigrationRecord({version:1,id,ownerProfileId:'player',network:'signet',sourceAssetId:source,sourceVersion:'0.0.1',targetVersion:'0.0.2',operationId:'upgrade-a',status:'replacement-delivered',replacementAssetId:replacement});
  assert.equal(readAssetMigrationRecord('player',source,'0.0.2')?.operationId,'upgrade-a');
  assert.deepEqual(readAssetMigrationRecords('player'),[record]);
  assert.throws(()=>writeAssetMigrationRecord({...record,operationId:'upgrade-b'}),{code:'outcome-unknown'});
});
test('migration journal is account and network scoped',()=>{
  assert.equal(readAssetMigrationRecords('another').length,0);
  assert.equal(readAssetMigrationRecords('player','mutinynet').length,0);
});
test('a delivered replacement resumes at retirement without another mint',async()=>{
  values.clear();let mints=0,retires=0;
  const record=writeAssetMigrationRecord({version:1,id,ownerProfileId:'player',network:'signet',sourceAssetId:source,sourceVersion:'0.0.1',targetVersion:'0.0.2',operationId:'upgrade-a',status:'prepared'});
  const deps={isCurrent:()=>true,mintAndDeliver:async()=>{mints++;return {status:'delivered' as const,replacementAssetId:replacement};},retire:async()=>{retires++;return 'pending' as const;}};
  const pending=await reconcileAssetMigration({assetId:source,quantity:'1'},record,deps);
  assert.equal(pending.status,'retirement-pending');assert.equal(mints,1);assert.equal(retires,1);
  const done=await reconcileAssetMigration({assetId:source,quantity:'1'},pending,{...deps,mintAndDeliver:async()=>{mints++;return {status:'delivered' as const,replacementAssetId:replacement};},retire:async()=>{retires++;return 'retired' as const;}});
  assert.equal(done.status,'completed');assert.equal(mints,1);assert.equal(retires,2);
});
test('0.0.2 fixture maps 0.0.1, supports explicit opt-out, and never burns after an account change',async()=>{
  const mapper=assetFormat002Fixture[1]!.predecessorMigrations['0.0.1']!;
  assert.equal(mapper({assetId:source,quantity:'1',name:'Old',ticker:'OLD',metadata:{bisSchemaVersion:'1'}}).metadata.bisAssetFormatVersion,'0.0.2');
  assert.equal(assetFormat002OptOutFixture[1]!.compatiblePredecessors.length,0);
  values.clear();let burns=0;
  const record=writeAssetMigrationRecord({version:1,id,ownerProfileId:'player',network:'signet',sourceAssetId:source,sourceVersion:'0.0.1',targetVersion:'0.0.2',operationId:'upgrade-a',status:'replacement-delivered',replacementAssetId:replacement});
  const result=await reconcileAssetMigration({assetId:source,quantity:'1'},record,{isCurrent:()=>false,mintAndDeliver:async()=>{throw Error('must not mint');},retire:async()=>{burns++;return 'retired';}});
  assert.equal(result.status,'replacement-delivered');assert.equal(burns,0);
});
