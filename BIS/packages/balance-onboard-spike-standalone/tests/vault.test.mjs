import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault} from '../src/vault.js';
import {fakeClock} from './helpers.mjs';
function fixture(){
 const clock=fakeClock();let openRequest,tx,request,closed=0;
 const db={objectStoreNames:{contains:()=>true},close(){closed++;},transaction(){tx={objectStore:()=>({get(){request={};return request;},put(){}}),abort(){queueMicrotask(()=>tx.onabort?.());}};return tx;}};
 const vault=createVault({indexedDB:{open(){openRequest={result:db};return openRequest;}},name:'test',clock});
 return {clock,db,vault,get openRequest(){return openRequest;},get tx(){return tx;},get request(){return request;},get closed(){return closed;}};
}
test('blocked and timed-out database opens can retry and close late results',async()=>{
 for(const failure of ['blocked','timeout','error']){
  const f=fixture(),opening=f.vault.open(),old=f.openRequest;const rejected=assert.rejects(opening,{name:'StorageError'});
  if(failure==='timeout')await f.clock.advance(10000);else old[failure==='blocked'?'onblocked':'onerror']();
  await rejected;old.onsuccess();assert.equal(f.closed,1);
  const retry=f.vault.open();f.openRequest.onsuccess();assert.equal(await retry,f.db);
 }
});
test('vault reads and writes resolve only after transaction completion',async()=>{
 const f=fixture(),opening=f.vault.open();f.openRequest.onsuccess();await opening;
 const reading=f.vault.read('identity');await new Promise(setImmediate);
 let settled=false;reading.then(()=>{settled=true;});f.request.result={id:'same-account'};f.request.onsuccess();await new Promise(setImmediate);assert.equal(settled,false);
 f.tx.oncomplete();assert.deepEqual(await reading,{id:'same-account'});
 const writing=f.vault.write('operation',{phase:'prepared'});await new Promise(setImmediate);const failure=assert.rejects(writing,{name:'StorageError'});f.tx.onabort();await failure;
});
test('timed-out write aborts and retains quarantine until its outcome arrives',async()=>{
 const f=fixture(),opening=f.vault.open();f.openRequest.onsuccess();await opening;
 const writing=f.vault.write('operation',{});await new Promise(setImmediate);f.tx.abort=()=>{};
 const failure=assert.rejects(writing,{name:'StorageError'});await f.clock.advance(10000);await failure;
 await assert.rejects(f.vault.read('identity'),{name:'StorageError'});
 f.tx.onabort();const reading=f.vault.read('identity');await new Promise(setImmediate);f.request.result={id:'retained'};f.request.onsuccess();f.tx.oncomplete();assert.equal((await reading).id,'retained');
});

test('transaction error does not release a timed-out write before abort or completion',async()=>{
 const f=fixture(),opening=f.vault.open();f.openRequest.onsuccess();await opening;
 const writing=f.vault.write('operation',{});await new Promise(setImmediate);f.tx.abort=()=>{};
 const failure=assert.rejects(writing,{name:'StorageError'});await f.clock.advance(10000);await failure;
 f.tx.onerror();
 await assert.rejects(f.vault.open(),{name:'StorageError'});
 f.tx.onabort();assert.equal(await f.vault.open(),f.db);
});
