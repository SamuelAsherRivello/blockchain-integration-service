import test from 'node:test';
import assert from 'node:assert/strict';
import {observeTreasureRequest} from '../../src/client/wallet-layer-arkade/treasure-observation.ts';

test('treasure observation returns settled work and preserves provider failures',async()=>{
  assert.equal(await observeTreasureRequest(Promise.resolve(42),100),42);
  const error=Error('provider');
  await assert.rejects(observeTreasureRequest(Promise.reject(error),100),value=>value===error);
});

test('a local observation timeout does not cancel or repeat the original operation',async()=>{
  let finish:()=>void=()=>{},calls=0,completed=false;
  const original=new Promise<void>(resolve=>{calls++;finish=()=>{completed=true;resolve();};});
  await assert.rejects(observeTreasureRequest(original,5),/observation is unavailable/);
  assert.equal(completed,false);assert.equal(calls,1);
  finish();await original;
  assert.equal(completed,true);assert.equal(calls,1);
});
