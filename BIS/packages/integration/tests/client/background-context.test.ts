import assert from 'node:assert/strict';
import test from 'node:test';
import {createContext,getControls,withContextForegroundWork} from '../../src/client/state-layer-core/context.ts';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const amounts={availableSats:100,totalSats:120,bitcoinSats:20,arkadeSats:100};
const addresses={arkadeAddress:'tark1-fixture',bitcoinAddress:'tb1p-fixture'};
function setup(t,{guest=false,network='signet',readBalance=async()=>amounts,readAddresses=async()=>addresses,list=async()=>[],observer,sends}={}) {
 const scheduled=new Map();let id=0,account=guest?null:{profileId:'a',phrase:'fixture-only',network},generation=1,changed;
 globalThis.requestIdleCallback=fn=>{scheduled.set(++id,fn);return id;};globalThis.cancelIdleCallback=n=>scheduled.delete(n);
 const c=createContext({load:async()=>({account,generation}),subscribe:l=>{changed=l;return()=>{};}},undefined,async()=>account?.profileId,undefined,readBalance,undefined,readAddresses,observer,undefined,{list,mint:async()=>{}},sends,undefined,undefined,{requireNetworkSelection:network==null,getNetwork:()=>network},observer);
 t.after(()=>{c.dispose();delete globalThis.requestIdleCallback;delete globalThis.cancelIdleCallback;});
 return {c,run(){const first=scheduled.entries().next().value;if(first){scheduled.delete(first[0]);first[1]();}},scheduled,replace(){account={...account,profileId:'b'};generation++;changed();}};
}
test('ready and mounting do not await warm reads; navigation joins primitives and detaches without cancellation',async t=>{
 const b=deferred(),a=deferred();let balances=0,addrs=0,signal;
 const s=setup(t,{readBalance:async(_account,source)=>{balances++;signal=source;return b.promise;},readAddresses:async()=>{addrs++;return a.promise;}});
 await s.c.readyAsync();assert.equal(balances,0);s.run();await tick();assert.equal(balances,1);assert.equal(addrs,1);
 assert.equal(s.c.getState().balance.status,'idle');assert.equal(getControls(s.c).toasts.getSnapshot(),null);
 s.c.openAccountDialog();s.c.openAccountDetails();await tick();assert.equal(s.c.getState().balance.status,'loading');assert.equal(balances,1);
 s.c.openAccountReceive();await tick();assert.equal(s.c.getState().addresses.status,'loading');assert.equal(addrs,1);
 b.resolve(amounts);assert.equal(await s.c.prepareArkBalance(),100);assert.equal(s.c.getState().addresses.status,'loading');
 s.c.closeAccount();assert.equal(signal.aborted,true,'completed owner cleans up its attempt');
 s.c.openAccountReceive();await tick();a.resolve(addresses);await tick();assert.equal(s.c.getState().addresses.status,'ready');assert.equal(addrs,1);
 s.c.openAccountDetails();await tick();assert.equal(s.c.getState().balance.status,'ready');assert.equal(balances,1);
});
test('Assets adopts inventory demand, survives rapid reentry, and keeps public authoritative listing independent',async t=>{
 const d=deferred();let calls=0,source;
 const s=setup(t,{list:async(_a,signal)=>{calls++;source=signal;return d.promise;}});await s.c.readyAsync();
 const inventory=s.c.prepareAssetInventory();await tick();assert.equal(calls,1);
 s.c.openAccountDialog();s.c.openAccountAssets();await tick();s.c.closeAccount();assert.equal(source.aborted,false);
 s.c.openAccountAssets();await tick();assert.equal(calls,1);d.resolve([]);await inventory;await tick();assert.deepEqual(s.c.getState().assets.assets,[]);
 const before=s.c.getState();await s.c.listAssets();assert.equal(calls,2);assert.equal(s.c.getState(),before);
 await s.c.refreshAssets();assert.equal(calls,3);
});
test('disposal/account replacement prevents an abort-ignoring warm result from repopulating memory',async t=>{
 const d=deferred();let first=true;
 const s=setup(t,{readBalance:async()=>{if(first){first=false;return d.promise;}return {...amounts,availableSats:7};}});await s.c.readyAsync();s.run();await tick();
 s.replace();await s.c.readyAsync();s.c.openAccountDialog();s.c.openAccountSend();await tick();
 d.resolve(amounts);await tick();assert.equal(await s.c.prepareArkBalance(),7);assert.equal(s.c.getCachedArkBalance(),7);
});
test('background failures are silent, optional jobs proceed, generic account capability never warms Assets',async t=>{
 let balances=0,assets=0;const s=setup(t,{readBalance:async()=>{balances++;throw Error('offline');},list:async()=>{assets++;return [];}});
 await s.c.readyAsync();s.run();await tick();assert.equal(balances,2);s.run();await tick();s.run();await tick();s.run();await tick();
 assert.equal(assets,0);assert.equal(s.c.getState().phase,'active');assert.equal(s.c.getState().balance.status,'idle');assert.equal(s.c.getState().error,undefined);assert.equal(getControls(s.c).toasts.getSnapshot(),null);
 s.c.openAccountDialog();s.c.openAccountSend();await tick();assert.equal(balances,4,'failed warmer grants no cached success; new entry gets its normal budget');
});
test('guest and missing network schedule nothing',async t=>{
 const s=setup(t,{guest:true});await s.c.readyAsync();assert.equal(s.scheduled.size,0);
});
test('missing selected network schedules nothing',async t=>{
 const s=setup(t,{network:null});await s.c.readyAsync();assert.equal(s.scheduled.size,0);
});
test('one account source serves warming and Transactions; identical evidence retains pending balance',async t=>{
 const d=deferred();let publish,reads=0,sources=0;
 const observer=async(_a,signal,emit)=>{sources++;publish=emit;emit([]);await new Promise(r=>signal.addEventListener('abort',r,{once:true}));};
 const s=setup(t,{readBalance:async()=>{reads++;return d.promise;},observer});await s.c.readyAsync();await tick();s.run();await tick();
 publish([]);publish([]);s.c.openAccountDialog();s.c.openAccountActivity();await tick();assert.equal(s.c.getState().activity.status,'ready');assert.equal(sources,1);assert.equal(reads,1);
 s.c.closeAccount();s.c.openAccountActivity();await tick();assert.equal(sources,1);d.resolve(amounts);await tick();
});
test('queued speculative work pauses during a live wallet read and resumes afterward',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 const funds=deferred();let reads=0;
 const s=setup(t,{readBalance:async()=>{reads++;return amounts;},sends:{funds:()=>funds.promise}});await s.c.readyAsync();
 const foreground=s.c.getSendSpendable();await tick();s.run();await tick();assert.equal(reads,0);
 funds.resolve(100);await foreground;s.run();await tick();assert.equal(reads,1);
});
test('a queued warmer cannot add retries after failed foreground preparation',async t=>{
 let calls=0;const s=setup(t,{readBalance:async()=>{calls++;throw Error('offline');}});await s.c.readyAsync();
 s.c.openAccountDialog();s.c.openAccountSend();await tick();assert.equal(calls,2);
 s.run();await tick();assert.equal(calls,2);
});
test('failed addresses cannot make Details complete or hide independently ready Send balance',async t=>{
 let addresses=0;const s=setup(t,{readAddresses:async()=>{addresses++;throw Error('offline');}});await s.c.readyAsync();s.run();await tick();
 assert.equal(addresses,2);assert.equal(await s.c.prepareArkBalance(),100);
 s.c.openAccountDialog();s.c.openAccountDetails();await tick();assert.equal(s.c.getState().balance.status,'ready');assert.equal(s.c.getState().addresses.status,'unavailable');
});
test('external financial owners pause warming and restore an invalidated visible Details read',async t=>{
 const old=deferred(),operation=deferred();let calls=0,signal;
 const s=setup(t,{readBalance:async(_a,source)=>{calls++;signal=source;return calls===1?old.promise:amounts;}});await s.c.readyAsync();s.run();await tick();
 s.c.openAccountDialog();s.c.openAccountDetails();await tick();
 const foreground=withContextForegroundWork(s.c,()=>operation.promise,true);await tick();assert.equal(signal.aborted,true);
 operation.resolve();await foreground;await tick();assert.equal(calls,2);assert.equal(s.c.getState().balance.status,'ready');
 old.resolve({...amounts,availableSats:999});await tick();assert.equal(s.c.getState().balance.availableSats,100);
});
