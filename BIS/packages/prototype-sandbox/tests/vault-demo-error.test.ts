import assert from 'node:assert/strict';
import test from 'node:test';
import { demoVaultErrorMessage } from '../src/client/vault-demo-runtime.ts';

test('vault errors reveal useful diagnostics without exposing wallet or transaction data', () => {
  assert.equal(demoVaultErrorMessage(new TypeError('Cannot read properties of undefined (reading outputIndex)')),
    'TypeError: Cannot read properties of undefined (reading outputIndex)');
  assert.match(demoVaultErrorMessage(new Error('Invalid mnemonic: abandon abandon abandon')), /Details withheld/);
  assert.doesNotMatch(demoVaultErrorMessage(new Error(`Request failed: ${'a'.repeat(100)}`)), /a{100}/);
  assert.doesNotMatch(demoVaultErrorMessage(new Error('Request to https://example.com/?token=secret failed')), /token=secret/);
  assert.equal(demoVaultErrorMessage(new Error('vault-cross-tab-lock-unavailable')), 'vault-cross-tab-lock-unavailable');
});
