import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoPendingAssetDelivery, completeAssetDelivery, readAssetDeliveryRecord, readAssetDeliveryRecords, validateAssetDelivery, writeAssetDeliveryRecord} from '../src/core/asset-delivery.ts';
import {hasExactDeliveryEvidence,selectExactAssetDeliveryInputs} from '../src/arkade/assets.ts';
import {eligibleUnreservedCoins,walletReservations} from '../src/core/wallet-reservations.ts';

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
  const pending = {version: 1, id: request.operationId, profileId: 'game-profile', request, status: 'pending', inputs: [input], inputAssets:[{assetId,quantity:'2'}], senderScript:'5120' + 'c'.repeat(64), recipientScript: '5120' + 'd'.repeat(64), sourceQuantity: '2', transactionId: txid};
  writeAssetDeliveryRecord(pending);
  assert.deepEqual(readAssetDeliveryRecord('game-profile', request.operationId), pending);
  assert.throws(() => writeAssetDeliveryRecord({...pending, request: {...request, quantity: '2'}}), {code: 'invalid-input'});
  assert.throws(() => assertNoPendingAssetDelivery('game-profile'), {code: 'outcome-unknown'});
  completeAssetDelivery('game-profile', request.operationId, txid);
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
    assert.throws(() => writeAssetDeliveryRecord({version: 1, id: request.operationId, profileId: 'game-profile', request, status: 'pending', inputs: [input], inputAssets:[{assetId,quantity:'1'}], senderScript:'5120'+'c'.repeat(64),recipientScript: '5120' + 'd'.repeat(64), sourceQuantity: '1'}), {code: 'unavailable'});
  } finally { localStorage.setItem = original; }
  assert.equal(readAssetDeliveryRecord('game-profile', request.operationId), undefined);
});

test('delivery selects only sufficient current asset inputs and refuses changed holdings', () => {
  memory();
  const otherAsset='e'.repeat(64)+'0000';
  const coins=[
    {txid:'1'.repeat(64),vout:0,assets:[{assetId,amount:1n},{assetId:otherAsset,amount:1n}]},
    {txid:'2'.repeat(64),vout:0,assets:[{assetId,amount:2n}]},
  ];
  assert.deepEqual(selectExactAssetDeliveryInputs(coins,'game-profile',assetId,1n).map(coin=>coin.txid),['1'.repeat(64)]);
  assert.deepEqual(selectExactAssetDeliveryInputs(coins,'game-profile',assetId,3n).map(coin=>coin.txid),['1'.repeat(64),'2'.repeat(64)]);
  assert.throws(()=>selectExactAssetDeliveryInputs(coins,'game-profile',assetId,4n),{code:'invalid-input'});
});

test('delivery confirmation requires the exact recipient allocation and sender asset change',()=>{
  const record={version:1,id:request.operationId,profileId:'game-profile',request,status:'pending',inputs:[input],inputAssets:[{assetId,quantity:'2'}],senderScript:'5120'+'c'.repeat(64),recipientScript:'5120'+'d'.repeat(64),sourceQuantity:'2',transactionId:txid};
  const evidence=[
    {txid,script:record.recipientScript,assets:[{assetId,amount:1n}]},
    {txid,script:record.senderScript,assets:[{assetId,amount:1n}]},
  ];
  assert.equal(hasExactDeliveryEvidence(record,1n,evidence),true);
  assert.equal(hasExactDeliveryEvidence(record,1n,[evidence[0],{...evidence[1],assets:[]}]),false);
  assert.equal(hasExactDeliveryEvidence(record,2n,evidence),false);
});

test('a pending delivery reserves only its selected wallet input',()=>{
  memory();
  writeAssetDeliveryRecord({version:1,id:request.operationId,profileId:'game-profile',request,status:'pending',inputs:[input],inputAssets:[{assetId,quantity:'1'}],senderScript:'5120'+'c'.repeat(64),recipientScript:'5120'+'d'.repeat(64),sourceQuantity:'1'});
  const reservations=walletReservations('game-profile');
  assert.equal(reservations.find(record=>record.id===`delivery:${request.operationId}`)?.inputs?.[0].txid,input.txid);
  assert.deepEqual(eligibleUnreservedCoins([input,{txid:'e'.repeat(64),vout:0}],reservations),[{txid:'e'.repeat(64),vout:0}]);
});
