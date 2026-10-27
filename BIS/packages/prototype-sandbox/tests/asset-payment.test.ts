import assert from 'node:assert/strict';
import test from 'node:test';
import { OPTIONAL_ASSET_PAYMENTS, optionalAssetPayment, assetTransferSats, assetSendIndexerError } from '../src/client/asset-payment.ts';

test('optional asset payment defaults to zero and adds to the SDK carrier', () => {
  assert.deepEqual(OPTIONAL_ASSET_PAYMENTS, [0, 100, 1000]);
  assert.equal(optionalAssetPayment(null), 0);
  assert.equal(optionalAssetPayment(''), 0);
  for (const [extra, total] of [[0, 330], [100, 430], [1000, 1330]]) {
    assert.equal(optionalAssetPayment(String(extra)), extra);
    assert.equal(assetTransferSats(330n, extra), total);
  }
  assert.equal(assetTransferSats(546n, 100), 646);
});

test('unsupported payments and invalid carriers cannot reach send', () => {
  for (const value of [-1, 1, 100.5, 330, 1001, 'invalid', NaN, Infinity]) assert.throws(() => optionalAssetPayment(value));
  for (const carrier of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => assetTransferSats(carrier, 100));
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
