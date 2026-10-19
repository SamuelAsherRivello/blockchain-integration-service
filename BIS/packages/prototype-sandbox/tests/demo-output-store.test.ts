import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoOutputStore } from '../src/client/demo-output-store.ts';

test('first Claim result survives blank callbacks, timing updates and other demo executions', async () => {
  const store = createDemoOutputStore();
  const scope = 'signet:16';
  store.beginExecution(scope);
  store.write(scope, 'Status: running');
  await Promise.resolve();
  const result = 'Status: claimed\nSuccess: true';
  store.write(scope, result, { explorer: { network: 'signet', kind: 'ark-transaction', identifier: 'ab'.repeat(32) } });
  const completed = store.snapshot(scope);
  for (const blank of ['', ' ', '\n', undefined, null]) {
    await Promise.resolve();
    store.write(scope, blank as string);
    assert.equal(store.snapshot(scope), completed);
  }
  store.setElapsedMs(scope, 123);
  store.beginExecution('signet:17');
  store.beginExecution('mutinynet:16');
  assert.equal(store.snapshot(scope).output, result);
  assert.deepEqual(store.snapshot(scope).details, completed.details);
  store.beginExecution(scope);
  assert.equal(store.snapshot(scope).output, '');
  assert.deepEqual(store.snapshot(scope).details, {});
});

test('module reevaluation retains the same session memory and React scope without browser storage', async () => {
  const first = await import('../src/client/demo-output.ts');
  const owner = globalThis as typeof globalThis & { __bisSandboxDemoOutputSession: { store: ReturnType<typeof createDemoOutputStore> } };
  const scope = 'mutinynet:16';
  owner.__bisSandboxDemoOutputSession.store.write(scope, 'Error: first Claim\nSuccess: false');
  const second = await import(`../src/client/demo-output.ts?hot-update=${Date.now()}`);
  assert.equal(first.DemoOutputScope, second.DemoOutputScope);
  assert.equal(owner.__bisSandboxDemoOutputSession.store.snapshot(scope).output, 'Error: first Claim\nSuccess: false');
});
