import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext} from '../../src/client/state-layer-core/context.ts';
import type {AccountStorage} from '../../src/client/state-layer-core/account-storage.ts';
import {testLocks} from './locks-fixture.ts';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
async function setup(holdInventory=false,failInventory=false){
  let profileId='inventory-readiness',hold:ReturnType<typeof deferred>|undefined,calls=0;
  const entered=deferred(),inventory=deferred();let inventorySignal:AbortSignal|undefined;
  const listeners=new Set<()=>void>();
  const storage:AccountStorage={
    async load(){const account={profileId,phrase:`fixture:${profileId}`};if(hold)await hold.promise;return {account,generation:0};},
    async listProfiles(){return {profiles:[profileId],generation:0};},
    async selectProfile(){throw Error('Unexpected write');},
    async save(){throw Error('Unexpected write');},async reset(){throw Error('Unexpected write');},
    subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
  };
  const context=createContext(storage,undefined,async phrase=>phrase.slice(8),undefined,undefined,undefined,undefined,undefined,undefined,{
    async list(_account,signal){calls++;if(failInventory)throw Error('Provider unavailable');if(holdInventory&&calls===1){inventorySignal=signal;entered.resolve();await inventory.promise;}return [{assetId:'a'.repeat(64)+'0000',quantity:'1'}];},
    async mint(account,request){return {status:'minted',profileId:account.profileId,operationId:request.operationId,asset:{assetId:'a'.repeat(64)+'0000',quantity:'1'}};},
  });
  await context.readyAsync();
  return {context,calls:()=>calls,entered,inventory,inventorySignal:()=>inventorySignal,rehydrate(next=profileId){profileId=next;hold=deferred();for(const listener of listeners)listener();return hold;}};
}

test('inventory requested during account hydration joins validation and succeeds without retry',async()=>{
  const fixture=await setup();
  let work:ReturnType<NonNullable<typeof fixture.context.prepareAssetInventory>>|undefined;
  const unsubscribe=fixture.context.subscribe(()=>{if(fixture.context.getState().phase==='loading'&&!work)work=fixture.context.prepareAssetInventory!();});
  const held=fixture.rehydrate();
  try{
    assert.equal(fixture.context.getState().phase,'loading');
    assert.ok(work);
    await Promise.resolve();assert.equal(fixture.calls(),0);
    held.resolve();const result=await work;
    assert.equal(result.status,'success');assert.equal(fixture.calls(),1);
    assert.equal((await fixture.context.prepareAssetInventory!()).status,'success');assert.equal(fixture.calls(),1);
  }finally{unsubscribe();held.resolve();fixture.context.dispose();}
});

test('hydration cannot publish inventory for a replaced account',async()=>{
  const fixture=await setup();const held=fixture.rehydrate('replacement');
  try{
    const work=fixture.context.prepareAssetInventory!();held.resolve();
    const result=await work;assert.equal(result.status,'error');
    if(result.status==='error')assert.equal(result.code,'account-changed');
    assert.equal(fixture.calls(),0);
  }finally{held.resolve();fixture.context.dispose();}
});

test('disposing while inventory awaits hydration prevents a provider read',async()=>{
  const fixture=await setup();const held=fixture.rehydrate();
  const work=fixture.context.prepareAssetInventory!();fixture.context.dispose();held.resolve();
  const result=await work;assert.equal(result.status,'error');
  if(result.status==='error')assert.equal(result.code,'disposed');assert.equal(fixture.calls(),0);
});

test('an inventory consumer adopts replacement evidence instead of retaining unavailable',async()=>{
  const formerStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),formerLocks=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
  const fixture=await setup(true);
  try{
    const work=fixture.context.prepareAssetInventory!(),peer=fixture.context.prepareAssetInventory!();await fixture.entered.promise;
    const result=await fixture.context.mintAsset({operationId:'evidence',name:'Fixture',ticker:'FIX',amount:'1',decimals:0});
    assert.equal(result.status,'minted');assert.equal(fixture.inventorySignal()?.aborted,true);
    assert.equal((await work).status,'success');assert.equal((await peer).status,'success');assert.equal(fixture.calls(),2);
    fixture.inventory.resolve();await new Promise<void>(resolve=>setImmediate(resolve));
    assert.equal((await fixture.context.prepareAssetInventory!()).status,'success');assert.equal(fixture.calls(),2);
  }finally{
    fixture.inventory.resolve();fixture.context.dispose();
    if(formerStorage)Object.defineProperty(globalThis,'localStorage',formerStorage);else Reflect.deleteProperty(globalThis,'localStorage');
    if(formerLocks)Object.defineProperty(navigator,'locks',formerLocks);else Reflect.deleteProperty(navigator,'locks');
  }
});

test('provider failure stays unavailable without an automatic retry',async()=>{
  const fixture=await setup(false,true);
  try{assert.equal((await fixture.context.prepareAssetInventory!()).status,'error');assert.equal(fixture.calls(),1);}
  finally{fixture.context.dispose();}
});
