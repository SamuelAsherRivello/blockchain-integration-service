import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisSigningStore, type SigningClaim, type TreasureCheckpointClaim } from '../../src/server/signing-store.ts';
import { startMiniredisBridge } from './miniredis-bridge.ts';

const rootId = '33'.repeat(32);
const parent: SigningClaim = {
  scope: `stealth-and-steel:mutinynet:${'11'.repeat(32)}`, id: 'native-root-1', digest: '22'.repeat(32),
  inputs: [`${'11'.repeat(32)}:0`, `${rootId}:0`], transactionId: rootId, operationId: 'native-treasure-op', exposureSats: 1000,
  dailyCapSats: 10000, operationCapSats: 5000, day: '2026-10-26', exposureId: rootId, contractPolicy: true,
};
const checkpoint: SigningClaim = {
  ...parent, id: 'native-checkpoint-1', digest: '44'.repeat(32), inputs: [...parent.inputs],
};
const parentResult = { result: { $type: 'transaction', value: 'native-signed-root' }, treasureRootReceipt: 'native-root-receipt' };
const claim: TreasureCheckpointClaim = {
  parent, parentResult, checkpoint, checkpointOutpoint: { txid: rootId, index: 0 },
  rootRequestDigest: parent.digest, rootClaimDay: parent.day, checkpointFamilyDigest: '55'.repeat(32),
};

async function provisionParent(store: ReturnType<typeof createRedisSigningStore>) {
  const acquired = await store.claim(parent);
  assert.equal(acquired.status, 'acquired');
  if (acquired.status !== 'acquired') throw new Error('Root claim unexpectedly replayed.');
  await store.complete(parent, acquired.owner, parentResult);
}

test('pinned miniredis executes the production checkpoint Lua against completed-parent state', async t => {
  const bridge = await startMiniredisBridge(t);
  const store = createRedisSigningStore({ UPSTASH_REDIS_REST_URL: bridge.endpoint, UPSTASH_REDIS_REST_TOKEN: bridge.token, VERCEL_ENV: 'preview' });
  await provisionParent(store);

  const acquired = await store.claimTreasureCheckpoint!(claim);
  assert.equal(acquired.status, 'acquired');
  if (acquired.status !== 'acquired') throw new Error('Checkpoint claim unexpectedly replayed.');
  const signedCheckpoint = { result: { $type: 'transaction', value: 'native-signed-checkpoint' } };
  await store.complete(checkpoint, acquired.owner, signedCheckpoint);

  assert.deepEqual(await store.claimTreasureCheckpoint!(claim), { status: 'replay', result: signedCheckpoint });
  assert.deepEqual(await store.readCompleted!({ scope: parent.scope, id: parent.id, digest: parent.digest }), { status: 'completed', result: parentResult });

  const substituted: TreasureCheckpointClaim = {
    ...claim,
    checkpoint: { ...checkpoint, id: 'native-checkpoint-alternate', digest: '66'.repeat(32) },
    checkpointFamilyDigest: '77'.repeat(32),
  };
  await assert.rejects(store.claimTreasureCheckpoint!(substituted), { message: 'Hosted signing refused: checkpoint-family.' });
  await assert.rejects(store.readCompleted!({ scope: parent.scope, id: parent.id, digest: '88'.repeat(32) }),
    { message: 'Hosted signing result could not be read. Reconcile before retrying.' });
});

test('pinned miniredis preserves missing-parent and unresolved-child quarantine outcomes', async t => {
  const bridge = await startMiniredisBridge(t);
  const store = createRedisSigningStore({ UPSTASH_REDIS_REST_URL: bridge.endpoint, UPSTASH_REDIS_REST_TOKEN: bridge.token, VERCEL_ENV: 'preview' });
  await assert.rejects(store.claimTreasureCheckpoint!(claim), { message: 'Hosted signing refused: parent-missing.' });
  await provisionParent(store);

  const acquired = await store.claimTreasureCheckpoint!(claim);
  assert.equal(acquired.status, 'acquired');
  await assert.rejects(store.claimTreasureCheckpoint!(claim), { message: 'Hosted signing refused: unresolved.' });
  await assert.rejects(store.claimTreasureCheckpoint!({ ...claim, parentResult: { ...parentResult, treasureRootReceipt: 'substituted' } }),
    { message: 'Hosted signing refused: parent-mismatch.' });
});
