import test from 'node:test';
import assert from 'node:assert/strict';
import { treasureSdkStorage, type TreasureStorageBackend, type TreasureStorageEnvelope } from '../src/client/treasure-sdk-storage.ts';

test('private recovery uses authenticated encryption, a nonextractable key and revision checks', async () => {
  let envelope: TreasureStorageEnvelope | undefined;
  const backend: TreasureStorageBackend = { read: async () => envelope, write: async (next, expected) => {
    assert.equal(expected, envelope?.revision ?? 0); envelope = structuredClone(next);
  } };
  const scope = 'a'.repeat(64), store = treasureSdkStorage<any>(scope, backend);
  const secret = 'b'.repeat(64), data = [{ secret, originalSignedRequest: 'public-fixture-only' }];
  assert.deepEqual(await store.load(), { revision: 0, records: [] });
  assert.equal(await store.save(data, 0), 1);
  assert.ok(envelope!.encrypted instanceof ArrayBuffer); assert.equal(envelope!.key.extractable, false);
  assert.ok(!JSON.stringify(envelope).includes(secret));
  await assert.rejects(crypto.subtle.exportKey('raw', envelope!.key));
  assert.deepEqual((await treasureSdkStorage<any>(scope, backend).load()).records, data);
  await assert.rejects(store.save([], 0), /Expected values/);
  await assert.rejects(treasureSdkStorage<any>('c'.repeat(64), backend).load(), /could not be verified/);
  new Uint8Array(envelope!.encrypted)[0] ^= 1;
  await assert.rejects(store.load(), /could not be verified/);
});
