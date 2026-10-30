import test from 'node:test';
import assert from 'node:assert/strict';
import { runDemo } from '../src/client/demos/treasure-hunt.ts';

test('each Treasure Hunt step stops before network access when Wallet 2 is absent', async t => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error('Unexpected network request'); });
  for (const action of ['start', 'check', 'claim', 'reject'] as const)
    await assert.rejects(runDemo({ network: 'signet', treasure: { action } }), /Wallet 2 Mnemonic/);
  assert.equal(requests, 0);
});
