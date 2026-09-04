import test from 'node:test';
import assert from 'node:assert/strict';
import { readWithRetry } from '../src/core/pending-read.ts';

test('retries one failed read and returns the second result', async () => {
  let calls=0;
  assert.equal(await readWithRetry(async()=>{if(++calls===1)throw Error('offline');return 42;}),42);
  assert.equal(calls,2);
});
test('two failures reject and never start a third attempt', async () => {
  let calls=0;
  await assert.rejects(readWithRetry(async()=>{calls++;throw Error('offline');}),/offline/);
  assert.equal(calls,2);
});
test('a hung read is bounded and its attempt is aborted before retry', async () => {
  const signals=[];
  await assert.rejects(readWithRetry(signal=>{signals.push(signal);return new Promise(()=>{});},undefined,5),/timed out/);
  assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));
});
test('leaving a page aborts a noncooperative read without retry', async () => {
  const controller=new AbortController();let calls=0;
  const result=readWithRetry(()=>{calls++;return new Promise(()=>{});},controller.signal);
  controller.abort();await assert.rejects(result);assert.equal(calls,1);
});
