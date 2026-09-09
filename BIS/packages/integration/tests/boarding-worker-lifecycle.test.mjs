import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {ContractManager,ReadonlyWallet,Wallet} from '@arkade-os/sdk';
import {createContext} from '../src/core/context.ts';
import {runBoardingWorker,boardingWorkerActive} from '../src/core/boarding-execution.ts';
import {transferStatus} from '../src/core/boarding-status.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const record={id:'11111111-1111-4111-8111-111111111111',profileId:'lifecycle',status:'pending',phase:'registered',intentId:'22222222-2222-4222-8222-222222222222',inputs:[{txid:'a'.repeat(64),vout:0}],quote:{amountSats:1000,direction:'to-bitcoin'},progress:{stage:'signing',execution:'running',action:'tree-nonces',observedAt:1000}};

test('runtime navigation does not end session-owned signing work',async t=>{
 let release;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{length:0,key:()=>null,getItem:()=>null}});
 const pending=runBoardingWorker(record.profileId,record.id,()=>new Promise(resolve=>{release=resolve;}));
 const account={profileId:record.profileId,phrase:'unused fixture'};
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No network in lifecycle fixture');});
 const c=createContext({load:async()=>({account,generation:0}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>({availableSats:2000,totalSats:2000,bitcoinSats:0,arkadeSats:2000}),undefined,async()=>({}),async(_a,signal)=>new Promise(r=>signal.addEventListener('abort',r,{once:true})));
 try {
  await c.ready();
  c.openAccountDialog();c.openAccountDetails();c.openAccountTransfer();await tick();c.closeAccount();await tick();
  assert.equal(boardingWorkerActive(record.profileId,record.id),true);assert.equal(transferStatus(record).execution,'running');
 } finally {c.dispose();release();await pending;}
 assert.equal(boardingWorkerActive(record.profileId,record.id),false);
});

test('fresh JavaScript realm after page loss cannot inherit an old worker or claim persisted nonce progress is active',async()=>{
 let release;
 const pending=runBoardingWorker(record.profileId,record.id,()=>new Promise(resolve=>{release=resolve;}));
 await tick();
 const moduleUrl=new URL('../src/core/boarding-status.ts',import.meta.url).href;
 // Only a public journal projection crosses the boundary; no signer/session.
 const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');import(workerData.moduleUrl).then(({transferStatus})=>parentPort.postMessage(transferStatus(workerData.record)));`,{eval:true,workerData:{moduleUrl,record}});
 try {
  const status=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  assert.equal(status.execution,'unknown');assert.equal(status.stage,'signing');assert.equal(status.action,'tree-nonces');
  assert.equal(status.status,'pending');assert.equal(status.operationId,record.id);assert.equal(status.commitmentTxid,undefined);
  assert.equal(boardingWorkerActive(record.profileId,record.id),true,'Separate realm does not mutate the original owner');
 } finally {await worker.terminate();release();await pending;}
});

function contractFixture() {
 let stopped=0;
 const manager={stopWatcherFn:()=>{stopped++;},eventCallbacks:new Set([()=>{}]),lookAheadEntries:new Map([['public',{}]]),initialized:true};
 manager.dispose=()=>ContractManager.prototype.dispose.call(manager);
 return {manager,stopped:()=>stopped};
}
test('installed readonly wallet disposal synchronously stops its actual contract manager',async()=>{
 const f=contractFixture(),wallet={_contractManager:f.manager};
 await ReadonlyWallet.prototype.dispose.call(wallet);
 assert.equal(f.manager.disposed,true);assert.equal(f.stopped(),1);
 assert.equal(f.manager.eventCallbacks.size,0);assert.equal(f.manager.lookAheadEntries.size,0);
 assert.equal(wallet._contractManager,undefined);
});
test('installed signing wallet awaits rotator and VTXO teardown before contract manager disposal',async()=>{
 const f=contractFixture(),events=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const wallet={_contractManager:f.manager,settleServerInfoChanges:async()=>{},_receiveRotator:{dispose:async()=>{events.push('rotator');}},_vtxoManager:{dispose:async()=>{events.push('vtxo-start');await gate;events.push('vtxo-end');}}};
 let finished=false;const disposing=Wallet.prototype.dispose.call(wallet).then(()=>{finished=true;});
 await tick();assert.deepEqual(events,['rotator','vtxo-start']);assert.equal(finished,false);assert.equal(f.stopped(),0);
 release();await disposing;assert.equal(finished,true);assert.equal(f.stopped(),1);assert.equal(wallet._vtxoManager,undefined);
});
