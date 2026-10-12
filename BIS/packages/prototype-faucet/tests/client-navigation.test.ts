import test from 'node:test';
import assert from 'node:assert/strict';
import { addressSubmissionUrl, clearAddressUrl, selectedNetwork } from '../src/client/navigation.ts';

test('address submission preserves the selected Signet network through the reload', () => {
  const submitted = addressSubmissionUrl('http://127.0.0.1:5174/prototype-faucet/', 'tark1example', 'signet');
  const url = new URL(submitted);

  assert.equal(url.searchParams.get('address'), 'tark1example');
  assert.equal(selectedNetwork(url.search), 'signet');
});

test('clearing an address retains the selected network', () => {
  assert.equal(clearAddressUrl('http://127.0.0.1:5174/prototype-faucet/?address=tark1example#details', 'signet'), '/prototype-faucet/?network=signet#details');
});
