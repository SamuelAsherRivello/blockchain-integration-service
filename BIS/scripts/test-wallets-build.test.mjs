import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactViolation } from './verify-test-wallet-build.mjs';

test('production exclusion rejects private files, fixture slots and runner controls without reading the real vault', () => {
  for (const path of ['dist/.env.local', 'dist/vault.json', 'dist/vault.lock', 'dist/profiles/Default/Cookies',
    'dist/test-wallets/cli.mjs', 'dist/agent-test-wallets/profile/public.json', 'dist/Local State'])
    assert.equal(artifactViolation(path, Buffer.from('synthetic')), 'private-or-runner-file');
  assert.equal(artifactViolation('dist/main.js', Buffer.from('BIS_TEST_ACCOUNT_1_MNEMONIC')), 'fixture-secret-slot');
  for (const source of ['BIS/scripts/test-wallets/cli.mjs', '/api/test-wallets/status', 'vault-protection-unavailable'])
    assert.equal(artifactViolation('dist/main.js', Buffer.from(source)), 'fixture-control-code');
  assert.equal(artifactViolation('dist/assets/main.js', Buffer.from('normal production wallet restore and faucet API')), undefined);
});
