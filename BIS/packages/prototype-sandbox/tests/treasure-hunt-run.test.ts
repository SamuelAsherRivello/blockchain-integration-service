import test from 'node:test';
import assert from 'node:assert/strict';
import { runDemo } from '../src/client/demos/treasure-hunt.ts';

test('Treasure Hunt requires the selected network’s Setup Wallet 2', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
  await assert.rejects(runDemo({ network: 'signet', treasure: { action: 'start' } }), /Wallet 2 Mnemonic/);
  await assert.rejects(runDemo({ network: 'mutinynet', treasure: { action: 'check' } }), /Wallet 2 Mnemonic/);
});
