import test from 'node:test';
import assert from 'node:assert/strict';
import { readSharedEnvironment, sharedEnvironmentPath, legacyFaucetEnvironmentPath,
  faucetEnvironmentKeys, testAccountEnvironmentKeys } from '../src/server/environment.mjs';

test('shared source selects consumer keys, not every configured secret', () => {
  const input = 'FAUCET_SIGNET_MNEMONIC="faucet-sentinel"\nBIS_TEST_ACCOUNT_1_MNEMONIC="test-sentinel"\nVITE_PRIVATE="must-not-export"';
  const faucet = readSharedEnvironment({ keys: faucetEnvironmentKeys, env: {}, read: () => input });
  assert.deepEqual(faucet.values, { FAUCET_SIGNET_MNEMONIC: 'faucet-sentinel' });
  const accounts = readSharedEnvironment({ keys: testAccountEnvironmentKeys, env: {}, read: () => input });
  assert.deepEqual(accounts.values, { BIS_TEST_ACCOUNT_1_MNEMONIC: 'test-sentinel' });
  assert.equal(faucet.source, 'shared');
});

test('explicit process environment wins and absent shared source alone permits legacy fallback', () => {
  const reads = [];
  const read = path => { reads.push(path); return path === legacyFaucetEnvironmentPath ? 'FAUCET_SIGNET_MNEMONIC=legacy-sentinel' : undefined; };
  const result = readSharedEnvironment({ keys: faucetEnvironmentKeys, env: { FAUCET_SIGNET_MNEMONIC: 'process-sentinel' }, read, legacyFaucetFallback: true });
  assert.equal(result.values.FAUCET_SIGNET_MNEMONIC, 'process-sentinel');
  assert.equal(result.source, 'legacy-faucet');
  assert.deepEqual(reads, [sharedEnvironmentPath, legacyFaucetEnvironmentPath]);
  let count = 0;
  const canonical = readSharedEnvironment({ keys: faucetEnvironmentKeys, env: {}, read: () => { count++; return 'FAUCET_SIGNET_MNEMONIC=""'; }, legacyFaucetFallback: true });
  assert.equal(count, 1);
  assert.equal(canonical.values.FAUCET_SIGNET_MNEMONIC, '');
});

test('missing source is unconfigured, unknown consumers and account legacy fallback fail closed', () => {
  assert.deepEqual(readSharedEnvironment({ keys: testAccountEnvironmentKeys, env: {}, read: () => undefined }), { values: {}, source: 'environment-only' });
  assert.throws(() => readSharedEnvironment({ keys: ['VITE_PRIVATE'] }), /invalid-keys/);
  assert.throws(() => readSharedEnvironment({ keys: testAccountEnvironmentKeys, read: () => undefined, legacyFaucetFallback: true }), /invalid-fallback/);
});
