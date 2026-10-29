import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisArkadeSubmissionStore } from '../../src/server/arkade-submission-store.ts';
import { startMiniredisBridge } from './miniredis-bridge.ts';

const key={stage:'submit' as const,scope:`stealth-and-steel:signet:${'a'.repeat(64)}`,operationId:'submit-operation-1',transactionId:'b'.repeat(64),digest:'c'.repeat(64)};

test('durable Arkade submission journal replays exact completion and quarantines unknown or changed outcomes',async t=>{
  const bridge=await startMiniredisBridge(t),store=createRedisArkadeSubmissionStore({UPSTASH_REDIS_REST_URL:bridge.endpoint,UPSTASH_REDIS_REST_TOKEN:bridge.token,VERCEL_ENV:'preview'});
  assert.deepEqual(await store.read(key),{status:'missing'});
  const acquired=await store.claim(key);assert.equal(acquired.status,'acquired');if(acquired.status!=='acquired')throw Error('submission claim not acquired');
  assert.deepEqual(await store.read(key),{status:'pending'});
  assert.deepEqual(await store.claim(key),{status:'pending'});
  assert.deepEqual(await store.claim({...key,digest:'d'.repeat(64)}),{status:'conflict'});
  assert.equal(await store.complete({...key,digest:'d'.repeat(64)},acquired.owner,{arkTxid:key.transactionId}),false);
  const result={arkTxid:key.transactionId,finalArkTx:'cHNidA==',signedCheckpointTxs:[]};
  assert.equal(await store.complete(key,acquired.owner,result),true);
  assert.deepEqual(await store.read(key),{status:'completed',digest:key.digest,result});
  assert.deepEqual(await store.claim(key),{status:'replay',result});
  assert.equal(await store.complete(key,acquired.owner,{substituted:true}),false);
});
