import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoPendingAssetDelivery, readAssetDeliveryRecord, readAssetDeliveryRecords, validateAssetDelivery, writeAssetDeliveryRecord} from '../src/core/asset-delivery.ts';

const assetId = 'a'.repeat(64) + '0000';
const txid = 'b'.repeat(64);
const input = {txid: 'c'.repeat(64), vout: 0};
const request = {operationId: 'deliver-shoes-i', assetId, quantity: '1', recipient: 'tark1fixturedestination'};

function memory() {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  }});
  return values;
}

test('delivery accepts only exact public request fields', () => {
  assert.deepEqual(validateAssetDelivery(request), request);
  for (const patch of [
    {operationId: ''}, {assetId: 'asset'}, {quantity: '0'}, {quantity: '1.1'},
    {quantity: '18446744073709551616'}, {recipient: 'ark1mainnet'}, {recipient: 'tark1'},
  ]) assert.throws(() => validateAssetDelivery({...request, ...patch}), {code: 'invalid-input'});
});

test('delivery records bind immutable operation, exact recipient and known inputs', () => {
  memory();
  const pending = {version: 1, id: request.operationId, profileId: 'game-profile', request, status: 'pending', inputs: [input], recipientScript: '5120' + 'd'.repeat(64)};
  writeAssetDeliveryRecord(pending);
  assert.deepEqual(readAssetDeliveryRecord('game-profile', request.operationId), pending);
  assert.throws(() => writeAssetDeliveryRecord({...pending, request: {...request, quantity: '2'}}), {code: 'invalid-input'});
  assert.throws(() => assertNoPendingAssetDelivery('game-profile'), {code: 'outcome-unknown'});
  writeAssetDeliveryRecord({...pending, status: 'succeeded', transactionId: txid});
  assert.equal(readAssetDeliveryRecord('game-profile', request.operationId)?.status, 'succeeded');
  assert.doesNotThrow(() => assertNoPendingAssetDelivery('game-profile'));
});

test('delivery state fails closed and never manufactures completion from absent ownership', () => {
  const values = memory();
  values.set('bis-signet-asset-delivery-v1:game-profile:deliver-shoes-i', 'broken');
  assert.throws(() => readAssetDeliveryRecords('game-profile'), {code: 'outcome-unknown'});
  values.clear();
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw Error('private storage failure'); };
  try {
    assert.throws(() => writeAssetDeliveryRecord({version: 1, id: request.operationId, profileId: 'game-profile', request, status: 'pending', inputs: [input], recipientScript: '5120' + 'd'.repeat(64)}), {code: 'unavailable'});
  } finally { localStorage.setItem = original; }
  assert.equal(readAssetDeliveryRecord('game-profile', request.operationId), undefined);
});
