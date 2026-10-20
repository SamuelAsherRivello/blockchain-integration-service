import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_ONE_TITLE, assertAssetUpgradeRequestMatches, createAssetUpgradeRequest, executeAssetUpgrade, readAssetUpgradeRecord } from '../src/client/asset-upgrade.ts';

function storage() {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function walletFixture() {
  const source = 'a'.repeat(64);
  const replacement = 'b'.repeat(64);
  const issueTx = 'c'.repeat(64);
  const burnTx = 'd'.repeat(64);
  const holdings = new Map([[source, 1n]]);
  let issueCalls = 0;
  let burnCalls = 0;
  const wallet = {
    getBalance: async () => ({ available: 10_000n }),
    getVtxos: async () => [{ assets: [...holdings].map(([assetId, amount]) => ({ assetId, amount })) }],
    assetManager: {
      getAssetDetails: async assetId => ({ assetId, metadata: assetId === replacement ? { bisUpgradeOperationId: request.operationId, title: 'Sword Level 2', level: '2', upgradeable: 'true', upgradePath: 'sword', nextLevel: '3' } : { title: LEVEL_ONE_TITLE, level: '1', upgradeable: 'true', upgradePath: 'sword', nextLevel: '2' } }),
      issue: async () => { issueCalls += 1; holdings.set(replacement, 1n); return { assetId: replacement, arkTxId: issueTx }; },
      burn: async () => { burnCalls += 1; holdings.delete(source); return burnTx; },
    },
  };
  let request;
  return { wallet, source, replacement, issueTx, burnTx, get issueCalls() { return issueCalls; }, get burnCalls() { return burnCalls; }, setRequest: value => { request = value; } };
}

test('upgrade requests are source-bound and public-only', () => {
  const request = createAssetUpgradeRequest('signet', '0000', 'a'.repeat(64));
  assert.equal(request.targetMetadata.level, '2');
  assert.equal(request.targetMetadata.title, 'Sword Level 2');
  assert.equal(request.targetMetadata.upgradeable, 'true');
  assert.equal(Object.hasOwn(request, 'mnemonic'), false);
  const record = { ...request, version: 1, phase: 'issuing' as const };
  assert.doesNotThrow(() => assertAssetUpgradeRequestMatches(record, request));
  assert.throws(() => assertAssetUpgradeRequestMatches(record, { ...request, sourceAssetId: 'b'.repeat(64) }), /does not match/);
});

test('level-two requests issue a terminal level-three replacement', () => {
  const request = createAssetUpgradeRequest('signet', '0000', 'a'.repeat(64), '2');
  assert.equal(request.targetMetadata.title, 'Sword Level 3');
  assert.equal(request.targetMetadata.level, '3');
  assert.equal(request.targetMetadata.icon.endsWith('/sword-3.png'), true);
  assert.equal(request.targetMetadata.upgradeable, 'false');
  assert.equal(Object.hasOwn(request.targetMetadata, 'nextLevel'), false);
});

test('upgrade issues the replacement before burning the exact source and replays safely', async () => {
  const fixture = walletFixture();
  const request = createAssetUpgradeRequest('signet', '0000', fixture.source);
  fixture.setRequest(request);
  const store = storage();
  const first = await executeAssetUpgrade({ wallet: fixture.wallet, request, storage: store });
  assert.equal(first.status, 'complete');
  assert.equal(first.record.phase, 'complete');
  assert.equal(first.record.replacementAssetId, fixture.replacement);
  assert.equal(first.record.issueTransactionId, fixture.issueTx);
  assert.equal(first.record.burnTransactionId, fixture.burnTx);
  assert.equal(fixture.issueCalls, 1);
  assert.equal(fixture.burnCalls, 1);
  const replay = await executeAssetUpgrade({ wallet: fixture.wallet, request, storage: store });
  assert.equal(replay.status, 'complete');
  assert.equal(fixture.issueCalls, 1);
  assert.equal(fixture.burnCalls, 1);
  assert.deepEqual(readAssetUpgradeRecord('signet', fixture.source, store), replay.record);
});

test('an unresolved burn is recoverable and never resubmitted', async () => {
  const fixture = walletFixture();
  const request = createAssetUpgradeRequest('signet', '0000', fixture.source);
  const store = storage();
  const pending = { ...request, version: 1 as const, phase: 'burning' as const, replacementAssetId: fixture.replacement };
  store.setItem('prototype-sandbox:asset-upgrade:v1:signet:' + fixture.source, JSON.stringify(pending));
  const result = await executeAssetUpgrade({ wallet: fixture.wallet, request, storage: store });
  assert.equal(result.status, 'recoverable');
  assert.equal(fixture.issueCalls, 0);
  assert.equal(fixture.burnCalls, 0);
});
