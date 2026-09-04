import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress, AssetManager, Extension, InMemoryContractRepository, InMemoryWalletRepository, ReadonlyWallet, RestArkProvider, RestIndexerProvider, Wallet } from '@arkade-os/sdk';
import { listWalletAssets, mintWalletAsset } from '../src/arkade/assets.ts';
import { readAssetRecords, writeAssetRecord } from '../src/core/assets.ts';

// A published BIP39 test vector, used only behind mocked wallet/provider factories.
// These tests never contact an operator, restore a user identity, or submit funds.
const account = { profileId: 'asset-adapter-fixture', phrase: 'abandon '.repeat(11) + 'about' };
const externalId = '7de59891e1cdcb9292800aff0597b92e8e01ad95821711fccba6b84744ed948b0000';
const request = {
  operationId: 'fixture-mint-1', name: 'Achievement: Level 1', ticker: 'LVL1',
  amount: '1', decimals: 0,
  iconUrl: 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png',
};
const metadata = r => ({ name: r.name, ticker: r.ticker, decimals: r.decimals, ...(r.iconUrl ? { icon: r.iconUrl } : {}) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  const values = new Map();
  const state = {
    storageFailure: false, indexerFailure: false, staleCacheFallback: false, current: true,
    submitFailure: false, finalizeFailure: false, beforeSubmit: undefined, submitGate: undefined, finalizeGate: undefined,
    onAccepted: undefined, onFinalized: undefined,
    submitted: 0, finalized: 0, disposed: 0, created: 0, storageWrites: 0, issues: [], packets: [], storages: [],
    coins: [{ txid: 'b'.repeat(64), vout: 0, value: 1000, assets: [{ assetId: externalId, amount: 1n }] }],
    holdings: new Map([[externalId, { amount: 1n, metadata: metadata(request) }]]),
  };
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected network access in asset fixture'); });
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { state.storageWrites++; if (state.storageFailure) throw Error('fixture storage unavailable'); values.set(key, value); },
  } });
  t.mock.method(RestArkProvider.prototype, 'getInfo', async () => ({ network: 'signet' }));
  t.mock.method(RestIndexerProvider.prototype, 'getVtxos', async () => {
    if (state.indexerFailure) throw Error('fixture required live read failed');
    return { vtxos: [] };
  });
  t.mock.method(RestIndexerProvider.prototype, 'getAssetDetails', async assetId => ({ assetId, metadata: state.holdings.get(assetId)?.metadata }));
  t.mock.method(RestArkProvider.prototype, 'submitTx', async () => {
    // Assert the real BIS provider wrapper commits intent before this boundary.
    const pending = readAssetRecords(account.profileId).find(record => record.status === 'pending');
    assert.ok(pending, 'durable intent exists before network submission');
    state.submitted++;
    if (state.submitGate) await state.submitGate.promise;
    if (state.submitFailure) throw Error('fixture submit response lost');
    state.onAccepted?.();
    return { arkTxid: state.submitted.toString(16).padStart(64, '0'), signedCheckpointTxs: [] };
  });
  t.mock.method(RestArkProvider.prototype, 'finalizeTx', async () => {
    state.finalized++;
    if (state.finalizeGate) await state.finalizeGate.promise;
    if (state.finalizeFailure) throw Error('fixture finalization response lost');
    state.onFinalized?.();
  });
  const publicPoint = Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex'));
  const address = new ArkAddress(publicPoint, publicPoint, 'tark').encode();
  async function create(options) {
    state.created++;
    assert.ok(options.storage.walletRepository instanceof InMemoryWalletRepository);
    assert.ok(options.storage.contractRepository instanceof InMemoryContractRepository);
    state.storages.push(options.storage);
    await options.arkProvider.getInfo();
    const wallet = {
      ...options, dustAmount: 330n,
      getAddress: async () => address,
      getBalance: async () => {
        try { await options.indexerProvider.getVtxos({ scripts: [] }); }
        catch (error) { if (!state.staleCacheFallback) throw error; }
        return { assets: [...state.holdings].map(([assetId, holding]) => ({ assetId, amount: holding.amount })) };
      },
      getProviderConnectionState: () => ({ mode: 'online', source: 'live' }),
      getSpendableVtxos: async options => { assert.equal(options.withRecoverable, false); return state.coins; },
      dispose: async () => { state.disposed++; },
      // Keep the actual SDK AssetManager.issue and its asset packet/coin selection.
      // The signing transport is a controlled submit/finalize fixture; this is
      // adapter boundary coverage, not a Signet or cryptographic acceptance test.
      buildAndSubmitOffchainTx: async (inputs, outputs) => {
        const packet = Extension.fromBytes(outputs.find(output => Extension.isExtension(output.script)).script).getAssetPacket();
        state.packets.push({ inputs, outputs, packet });
        if (state.beforeSubmit) await state.beforeSubmit();
        const response = await options.arkProvider.submitTx('fixture-psbt', []);
        await options.arkProvider.finalizeTx(response.arkTxid, []);
        const issued = packet.groups.find(group => group.isIssuance());
        const issueRequest = state.issues.at(-1);
        state.holdings.set(response.arkTxid + '0000', { amount: issued.outputs[0].amount, metadata: issueRequest.metadata });
        return response;
      },
    };
    wallet.assetManager = new AssetManager(wallet);
    const issue = wallet.assetManager.issue.bind(wallet.assetManager);
    wallet.assetManager.issue = async params => { state.issues.push(params); return issue(params); };
    return wallet;
  }
  t.mock.method(Wallet, 'create', async options => { assert.equal(options.settlementConfig, false); return create(options); });
  t.mock.method(ReadonlyWallet, 'create', create);
  return {
    state, values,
    mint: (r = request, signal = new AbortController().signal) => mintWalletAsset(account, r, signal, () => state.current),
    list: () => listWalletAssets(account, new AbortController().signal),
  };
}

test('real adapter and SDK issue preserve the external holding, exact amount, icon and no control asset', async t => {
  const f = fixture(t);
  const result = await f.mint();
  assert.equal(result.status, 'minted');
  assert.equal(result.asset.quantity, '1');
  assert.notEqual(result.asset.assetId, externalId);
  assert.equal(result.asset.assetId, result.transactionId + '0000');
  assert.equal(f.state.issues[0].amount, 1n);
  assert.equal('controlAssetId' in f.state.issues[0], false);
  assert.deepEqual(f.state.issues[0].metadata, { ...metadata(request), bisKind: 'asset', bisSchemaVersion: '1', bisOperationId: request.operationId });
  const { packet, outputs } = f.state.packets[0];
  const issued = packet.groups.find(group => group.isIssuance());
  assert.equal(issued.controlAsset, null);
  assert.equal(issued.outputs[0].amount, 1n);
  const preserved = packet.groups.find(group => group.assetId?.toString() === externalId);
  assert.equal(preserved.inputs[0].amount, 1n);
  assert.equal(preserved.outputs[0].amount, 1n);
  assert.equal(outputs[0].amount, 1000n);
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 1);
  assert.equal(readAssetRecords(account.profileId)[0].status, 'succeeded');
  const assets = await f.list();
  assert.equal(assets.length, 2);
  assert.deepEqual(assets.find(asset => asset.assetId === externalId), {
    assetId: externalId, quantity: '1', name: request.name, ticker: request.ticker,
    decimals: request.decimals, iconUrl: request.iconUrl,
  });
  assert.equal(assets.find(asset => asset.assetId === result.asset.assetId).quantity, '1');
  assert.notEqual(f.state.storages[0].walletRepository, f.state.storages[1].walletRepository);
  assert.doesNotThrow(() => JSON.stringify({ result, assets }));
  assert.equal(f.state.disposed, 2);
});

test('completed same-ID retry does not recreate a wallet or issue again; new ID is independent', async t => {
  const f = fixture(t), first = await f.mint();
  const retried = await f.mint();
  assert.equal(retried.status, 'already-minted');
  assert.equal(retried.asset.assetId, first.asset.assetId);
  assert.equal(f.state.created, 1);
  assert.equal(f.state.submitted, 1);
  await assert.rejects(f.mint({ ...request, amount: '2' }), { code: 'invalid-input' });
  const second = await f.mint({ ...request, operationId: 'fixture-mint-2' });
  assert.equal(second.status, 'minted');
  assert.notEqual(second.asset.assetId, first.asset.assetId);
  assert.equal(f.state.submitted, 2);
});

test('fractional quantity reaches the SDK and result without floating point loss', async t => {
  const f = fixture(t);
  const result = await f.mint({ ...request, amount: '1.000000000000000001', decimals: 18 });
  assert.equal(f.state.issues[0].amount, 1000000000000000001n);
  assert.equal(result.asset.quantity, '1000000000000000001');
});

test('required live-read failure cannot fall back to cached holdings and submit', async t => {
  const f = fixture(t);
  f.state.indexerFailure = true;
  f.state.staleCacheFallback = true;
  await assert.rejects(f.mint(), { code: 'unavailable' });
  assert.equal(f.state.submitted, 0);
  assert.equal(f.state.issues.length, 0);
  assert.deepEqual(readAssetRecords(account.profileId), []);
});

test('insufficient funds and durable-storage failure stop before the submit boundary', async t => {
  const f = fixture(t);
  f.state.coins = [];
  await assert.rejects(f.mint(), { code: 'insufficient-funds' });
  f.state.coins = [{ txid: 'b'.repeat(64), vout: 0, value: 1000 }];
  f.state.storageFailure = true;
  await assert.rejects(f.mint(), { code: 'unavailable' });
  assert.equal(f.state.submitted, 0);
  assert.equal(f.state.finalized, 0);
  assert.deepEqual(readAssetRecords(account.profileId), []);
});

test('lost submit response remains unknown and same-ID retry never replays from an absent holding', async t => {
  const f = fixture(t);
  f.state.submitFailure = true;
  await assert.rejects(f.mint(), { code: 'outcome-unknown' });
  assert.equal(readAssetRecords(account.profileId)[0].status, 'pending');
  f.state.submitFailure = false;
  await assert.rejects(f.mint(), { code: 'outcome-unknown' });
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 0);
  assert.equal(f.state.issues.length, 1);
});

test('accepted submit followed by finalization failure keeps its known transaction ID', async t => {
  const f = fixture(t);
  f.state.finalizeFailure = true;
  await assert.rejects(f.mint(), { code: 'outcome-unknown' });
  const pending = readAssetRecords(account.profileId)[0];
  assert.equal(pending.status, 'pending');
  assert.equal(pending.transactionId, '1'.padStart(64, '0'));
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 1);
});

test('secondary storage failure after acceptance does not interrupt transaction finalization', async t => {
  const f = fixture(t);
  f.state.onAccepted = () => { f.state.storageFailure = true; };
  f.state.onFinalized = () => { f.state.storageFailure = false; };
  const result = await f.mint();
  assert.equal(result.status, 'minted');
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 1);
  assert.equal(readAssetRecords(account.profileId)[0].transactionId, result.transactionId);
  assert.equal(readAssetRecords(account.profileId)[0].status, 'succeeded');
});

test('fresh ownership reconciles a pending operation marker and ignores same-name external holdings', async t => {
  const f = fixture(t);
  const transactionId = 'e'.repeat(64);
  writeAssetRecord(account.profileId, { request, status: 'pending', transactionId });
  await assert.rejects(f.mint(), { code: 'outcome-unknown' });
  const recoveredId = 'e'.repeat(64) + '0000';
  f.state.holdings.set(recoveredId, { amount: 1n, metadata: { ...metadata(request), bisKind: 'asset', bisSchemaVersion: '1', bisOperationId: request.operationId } });
  const result = await f.mint();
  assert.equal(result.status, 'already-minted');
  assert.equal(result.asset.assetId, recoveredId);
  assert.notEqual(result.asset.assetId, externalId);
  assert.equal(result.transactionId, transactionId);
  assert.equal(readAssetRecords(account.profileId)[0].transactionId, transactionId);
  assert.equal(f.state.issues.length, 0);
  assert.equal(f.state.submitted, 0);
});

test('account replacement immediately before provider submission refuses stale work', async t => {
  const f = fixture(t);
  f.state.beforeSubmit = async () => { f.state.current = false; };
  await assert.rejects(f.mint(), { code: 'account-changed' });
  assert.equal(f.state.submitted, 0);
  assert.deepEqual(readAssetRecords(account.profileId), []);
});

test('aborted pre-submit work cannot submit late and its temporary wallet is disposed', async t => {
  const f = fixture(t), reached = deferred(), gate = deferred(), controller = new AbortController();
  f.state.beforeSubmit = async () => { reached.resolve(); await gate.promise; };
  const work = f.mint(request, controller.signal);
  await reached.promise;
  controller.abort();
  await assert.rejects(work);
  gate.resolve();
  await flush();
  assert.equal(f.state.submitted, 0);
  assert.equal(f.state.finalized, 0);
  assert.equal(f.state.disposed, 1);
  assert.deepEqual(readAssetRecords(account.profileId), []);
});

test('aborted submitted work stays unknown until late completion reconciles without resubmission', async t => {
  const f = fixture(t), controller = new AbortController();
  f.state.finalizeGate = deferred();
  const work = f.mint(request, controller.signal);
  while (f.state.finalized === 0) await flush();
  controller.abort();
  await assert.rejects(work, { code: 'outcome-unknown' });
  assert.equal(readAssetRecords(account.profileId)[0].status, 'pending');
  const writesAtAbort = f.state.storageWrites;
  f.state.finalizeGate.resolve();
  await flush();
  assert.equal(f.state.storageWrites, writesAtAbort, 'late finalization cannot write outside the caller lock');
  assert.equal(readAssetRecords(account.profileId)[0].status, 'pending');
  const result = await f.mint();
  assert.equal(result.status, 'already-minted');
  assert.equal(result.profileId, account.profileId);
  assert.equal(result.transactionId, '1'.padStart(64, '0'));
  assert.equal(f.state.storageWrites, writesAtAbort + 1, 'the next locked retry records fresh ownership once');
  assert.equal((await f.mint()).asset.assetId, result.asset.assetId);
  assert.equal(f.state.storageWrites, writesAtAbort + 1);
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 1);
});

test('an accepted response arriving after abort leaves all journal writes to the next retry', async t => {
  const f = fixture(t), controller = new AbortController();
  f.state.submitGate = deferred();
  const work = f.mint(request, controller.signal);
  while (f.state.submitted === 0) await flush();
  controller.abort();
  await assert.rejects(work, { code: 'outcome-unknown' });
  const pendingAtAbort = structuredClone(readAssetRecords(account.profileId));
  const writesAtAbort = f.state.storageWrites;
  f.state.submitGate.resolve();
  await flush();
  assert.equal(f.state.finalized, 1, 'accepted transactions still finalize after abort');
  assert.equal(f.state.storageWrites, writesAtAbort, 'accepted and finalized callbacks cannot write outside the caller lock');
  assert.deepEqual(readAssetRecords(account.profileId), pendingAtAbort);
  const result = await f.mint();
  assert.equal(result.status, 'already-minted');
  assert.equal(result.asset.assetId, '1'.padStart(64, '0') + '0000');
  assert.equal(f.state.storageWrites, writesAtAbort + 1);
  assert.equal((await f.mint()).asset.assetId, result.asset.assetId);
  assert.equal(f.state.storageWrites, writesAtAbort + 1);
  assert.equal(f.state.submitted, 1);
});

test('late finalization after explicit account cleanup does not recreate its removed journal', async t => {
  const f = fixture(t), controller = new AbortController();
  f.state.finalizeGate = deferred();
  const work = f.mint(request, controller.signal);
  while (f.state.finalized === 0) await flush();
  controller.abort();
  await assert.rejects(work, { code: 'outcome-unknown' });
  assert.equal(readAssetRecords(account.profileId)[0].status, 'pending');
  // Model acknowledged account cleanup after the caller's mutation lock exits.
  f.values.clear();
  f.state.current = false;
  f.state.finalizeGate.resolve();
  await flush();
  assert.deepEqual(readAssetRecords(account.profileId), []);
  assert.equal(f.state.submitted, 1);
  assert.equal(f.state.finalized, 1);
  assert.equal(f.state.holdings.size, 2, 'already-submitted work still finalizes');
  assert.equal(f.state.disposed, 1);
});

test('late accepted response cannot downgrade a reconciled successful journal record', async t => {
  const f = fixture(t), controller = new AbortController();
  f.state.submitGate = deferred();
  f.state.finalizeGate = deferred();
  const work = f.mint(request, controller.signal);
  while (f.state.submitted === 0) await flush();
  controller.abort();
  await assert.rejects(work, { code: 'outcome-unknown' });
  const assetId = '1'.padStart(64, '0') + '0000';
  f.state.holdings.set(assetId, { amount: 1n, metadata: { ...metadata(request), bisKind: 'asset', bisSchemaVersion: '1', bisOperationId: request.operationId } });
  assert.equal((await f.mint()).status, 'already-minted');
  f.state.submitGate.resolve();
  while (f.state.finalized === 0) await flush();
  assert.equal(readAssetRecords(account.profileId)[0].status, 'succeeded');
  f.state.finalizeGate.resolve();
  await flush();
  assert.equal(readAssetRecords(account.profileId)[0].asset.assetId, assetId);
  assert.equal(f.state.submitted, 1);
});
