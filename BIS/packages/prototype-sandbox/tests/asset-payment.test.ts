import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_PAYMENT_SATS, assetPaymentSats, demoValidateAssetTransferSats, assetSendIndexerError } from '../src/client/asset-payment.ts';

test('asset payment defaults and former subdust selections use the 330-sat minimum', () => {
  assert.deepEqual(ASSET_PAYMENT_SATS, [330, 1000]);
  for (const value of [null, undefined, '', 0, '0', 1, '1', 100, '100']) assert.equal(assetPaymentSats(value), 330);
  for (const value of [null, undefined, '']) assert.equal(demoValidateAssetTransferSats(value), 330);
  for (const amount of [330, 1000]) {
    assert.equal(assetPaymentSats(String(amount)), amount);
    assert.equal(demoValidateAssetTransferSats(String(amount)), amount);
    assert.equal(demoValidateAssetTransferSats(amount), amount);
  }
});

test('indexer errors distinguish wallet preparation from an unresolved send without exposing request data', () => {
  const timeout = Object.assign(new Error('network request with private URL'), { name: 'TimeoutError' });
  const fetchError = new Error('private URL and scripts', { cause: timeout });
  const error = new Error('indexer request failed', { cause: fetchError });
  assert.match(assetSendIndexerError(error, false)!.message, /timed out.*before the send was submitted/);
  const unresolved = assetSendIndexerError(error, true)!.message;
  assert.match(unresolved, /outcome is unknown.*transaction history/);
  assert.doesNotMatch(unresolved, /private URL|scripts/);
  assert.equal(assetSendIndexerError(new Error('other failure'), true), undefined);
});

test('zero cannot silently become SDK dust and unsupported payments cannot reach send', () => {
  for (const value of [0, '0', 1, '1', 100, '100', 329]) {
    assert.throws(() => demoValidateAssetTransferSats(value), /minimum asset payment is 330 sats.*Nothing was sent/);
  }
  for (const value of [-1, 0.5, 100.5, 329, 331, 1001, 'invalid', NaN, Infinity]) {
    assert.throws(() => assetPaymentSats(value));
    assert.throws(() => demoValidateAssetTransferSats(value));
  }
});
