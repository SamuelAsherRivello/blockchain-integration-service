import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedWalletObserver} from '../src/core/shared-wallet-observer.ts';
const tick=()=>new Promise(r=>setImmediate(r));
const account={profileId:'one',phrase:'fixture-only'};
test('source failure clears replay, fans out failure and permits one replacement source',async()=>{
 const runs=[];
 const shared=createSharedWalletObserver(async(a,signal,publish)=>{await new Promise((resolve,reject)=>runs.push({signal,publish,reject,resolve}));});
 const a=new AbortController(),b=new AbortController(),seen=[];
 const first=shared.observe(account,a.signal,r=>seen.push(r)).catch(e=>e);
 const second=shared.observe(account,b.signal,r=>seen.push(r)).catch(e=>e);
 await tick();assert.equal(runs.length,1);runs[0].publish([]);assert.equal(seen.length,2);
 runs[0].reject(Error('offline'));assert.match((await first).message,/offline/);assert.match((await second).message,/offline/);
 const third=shared.observe(account,a.signal,r=>seen.push(r));await tick();assert.equal(runs.length,2);assert.equal(seen.length,2);
 runs[0].publish(['late']);assert.equal(seen.length,2);a.abort();await third;assert.equal(runs[1].signal.aborted,true);
});
test('a stopped consumer cannot cancel the retained source; restart ignores old snapshots',async()=>{
 const runs=[];
 const shared=createSharedWalletObserver(async(a,signal,publish)=>{runs.push({signal,publish});await new Promise(r=>signal.addEventListener('abort',r,{once:true}));});
 const a=new AbortController(),b=new AbortController(),seen=[];
 const first=shared.observe(account,a.signal,r=>seen.push(r));await tick();runs[0].publish([]);
 const second=shared.observe(account,b.signal,()=>{});b.abort();await second;assert.equal(runs[0].signal.aborted,false);
 shared.refresh();await tick();assert.equal(runs.length,2);assert.equal(runs[0].signal.aborted,true);
 runs[0].publish(['stale']);assert.deepEqual(seen,[[]]);runs[1].publish(['fresh']);assert.deepEqual(seen,[[],['fresh']]);
 a.abort();await first;
});
