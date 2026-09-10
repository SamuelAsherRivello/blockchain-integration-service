import test from 'node:test';
import assert from 'node:assert/strict';
import * as trading from '../src/core/marketplace-trading.ts';

test('marketplace trading reports the proven atomic capability truthfully', () => {
  const availability = trading.getBisMarketplaceTradingAvailability();
  assert.deepEqual(availability, {
    status: 'unavailable',
    code: 'atomic-exchange-unsupported',
    message: 'Buy and Sell are unavailable because the installed Arkade SDK does not provide the required atomic asset-for-sats exchange.',
  });
  assert.doesNotThrow(() => JSON.stringify(availability));
  assert.equal(Object.isFrozen(availability), true);
});

test('unsupported trading module exposes no sequential submission fallback', () => {
  assert.deepEqual(Object.keys(trading), ['getBisMarketplaceTradingAvailability']);
  assert.equal('submitMarketplaceTrade' in trading, false);
  assert.equal('sendAssetThenSats' in trading, false);
});
