import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackgroundCache} from '../../src/client/state-layer-core/background-cache.ts';
const tick=()=>new Promise(r=>setImmediate(r));
test('finite single slot preserves order, failure continuation, conditional demand and no refill',async()=>{
 let next,release,eligible=false,paused=false;const order=[];
 const scheduler=createBackgroundCache({schedule:run=>{next=run;return()=>{next=undefined;};},paused:()=>paused,jobs:[
  {run:()=>{order.push('details');return new Promise(r=>release=r);}},
  {run:async()=>{order.push('history');throw Error('offline');}},
  {run:async()=>{order.push('contracts');return [];}},
  {eligible:()=>eligible,run:async()=>{order.push('assets');return [];}},
 ]});
 scheduler.wake();next();await tick();scheduler.wake();assert.deepEqual(order,['details']);
 paused=true;release();await tick();assert.deepEqual(order,['details']);paused=false;scheduler.wake();next();await tick();next();await tick();
 assert.deepEqual(order,['details','history','contracts']);scheduler.wake();await tick();assert.equal(order.length,3);
 eligible=true;scheduler.wake();next();await tick();scheduler.wake();await tick();assert.deepEqual(order,['details','history','contracts','assets']);scheduler.dispose();
});
test('scheduled work is cancelled on lifecycle disposal; foreground pause resumes only on wake',async()=>{
 let next,paused=true,calls=0;
 const scheduler=createBackgroundCache({schedule:run=>{next=run;return()=>{next=undefined;};},paused:()=>paused,jobs:[{run:async()=>calls++}]});
 scheduler.wake();assert.equal(next,undefined);paused=false;scheduler.wake();assert.equal(typeof next,'function');
 paused=true;next();await tick();assert.equal(calls,0);paused=false;scheduler.wake();scheduler.dispose();assert.equal(next,undefined);assert.equal(calls,0);
});
