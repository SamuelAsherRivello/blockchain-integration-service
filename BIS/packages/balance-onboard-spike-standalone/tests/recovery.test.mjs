import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFailure,nextRetry,retryDue} from '../src/recovery.js';
import {WorkCoordinator,requestLock} from '../src/coordinator.js';
import {fakeClock,deferred,queuedLocks} from './helpers.mjs';
test('retry policy caps delay, persists rate limits, and bounds unknown rechecks',()=>{
 let previous;
 for(let i=0;i<20;i++){previous=nextRetry(previous,{name:'FetchError'},{now:1000,random:()=>1,mutation:true});assert.ok(previous.nextAt<=301000);}
 let unknown;for(let i=0;i<4;i++)unknown=nextRetry(unknown,Error('new'),{now:1000,random:()=>0});assert.equal(unknown.paused,true);
 const limited=nextRetry(null,{status:429,retryAfterAt:1000000},{now:1000,random:()=>0});assert.equal(retryDue(JSON.parse(JSON.stringify(limited)),999999),false);
 assert.equal(classifyFailure({name:'DigestMismatchError'}),'transient');
 assert.equal(classifyFailure({name:'INVALID_INTENT_PROOF',code:23}),'validation');
 assert.equal(classifyFailure(Error('new'),{mutation:true}),'uncertain');
});
test('hung observations time out without accumulating replacement work',async()=>{
 const clock=fakeClock(),worker=new WorkCoordinator({clock}),pending=deferred();let calls=0;
 const first=worker.read('coins',()=>{calls++;return pending.promise;},{ms:10000});
 const failure=assert.rejects(first,{name:'ObservationTimeoutError'});await clock.advance(10000);await failure;
 await assert.rejects(worker.read('coins',()=>{calls++;}));assert.equal(calls,1);
 pending.resolve([]);await new Promise(setImmediate);assert.equal(worker.slots.size,0);
 assert.deepEqual(await worker.read('coins',()=>[1]),[1]);
});
test('queued lock acquisition aborts without stealing the holder',async()=>{
 const clock=fakeClock(),locks=queuedLocks(),hold=deferred();const owner=locks.request('operation',()=>hold.promise);
 const waiting=requestLock(locks,'operation',()=>assert.fail('must not acquire'),undefined,{clock,ms:10000});
 const failure=assert.rejects(waiting,{name:'LockTimeoutError'});await clock.advance(10000);await failure;
 assert.equal(locks.held.has('operation'),true);hold.resolve();await owner;
});

test('late wallet cleanup finishes before a replacement can connect',async()=>{
 const clock=fakeClock(),worker=new WorkCoordinator({clock}),connection=deferred(),cleanup=deferred();let calls=0;
 const first=worker.read('wallet',()=>connection.promise,{ms:10000,onLate:()=>cleanup.promise});
 const failure=assert.rejects(first,{name:'ObservationTimeoutError'});await clock.advance(10000);await failure;
 connection.resolve({});await new Promise(setImmediate);
 await assert.rejects(worker.read('wallet',()=>{calls++;return {}; }));
 assert.equal(calls,0,'late disposal must retain ownership of the connection slot');
 cleanup.resolve();await new Promise(setImmediate);
 await worker.read('wallet',()=>{calls++;return {};});assert.equal(calls,1);
});

test('reload and repeated recheck signals respect the provider retry floor',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 let now=1000;
 const first=new WorkCoordinator({storage,now:()=>now,random:()=>0});
 first.fail('same-account:coins',{status:429,retryAfterAt:20000},{step:3});
 const restored=new WorkCoordinator({storage,now:()=>now});
 for(let i=0;i<50;i++){restored.recheck('same-account:coins');assert.equal(restored.due('same-account:coins'),false);}
 now=20000;assert.equal(restored.due('same-account:coins'),true);
});

test('notification storms share one outstanding observation',async()=>{
 const worker=new WorkCoordinator(),pending=deferred();let calls=0;
 const observers=Array.from({length:100},()=>worker.read('coins',()=>{calls++;return pending.promise;}));
 await new Promise(setImmediate);assert.equal(calls,1);pending.resolve([1]);
 assert.ok((await Promise.all(observers)).every(value=>value[0]===1));assert.equal(worker.slots.size,0);
});
