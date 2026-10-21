import assert from 'node:assert/strict';
import test from 'node:test';
import { sandboxWalletDatabase } from '../src/client/wallet-storage.ts';

test('wallet storage scopes identities and networks without changing established names', () => {
  const first = 'tr([aabbccdd/86\'/1\'/0\']public-key/0/*)';
  const second = first.replace('aabbccdd', '11223344');
  const key = sandboxWalletDatabase('signet', first);
  assert.equal(key, 'bis-prototype-sandbox-wallet-v1:signet:aabbccdd');
  assert.notEqual(key, sandboxWalletDatabase('signet', second));
  assert.notEqual(key, sandboxWalletDatabase('mutinynet', first));
  assert.equal(key, sandboxWalletDatabase('signet', first));
  assert.throws(() => sandboxWalletDatabase('mainnet', first), /Unsupported/);
  assert.throws(() => sandboxWalletDatabase('signet', 'invalid'), /identity/);
});
