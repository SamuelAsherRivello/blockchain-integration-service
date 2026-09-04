import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.ts';
import { readAssetRecords, writeAssetRecord } from '../src/core/assets.ts';
import { writeBoardingRecord } from '../src/core/boarding-record.ts';
import { writeSendRecord } from '../src/core/sending.ts';
import { testLocks } from './locks-fixture.mjs';

const request = { operationId: 'mint-one', name: 'An asset', ticker: 'AST', amount: '1', decimals: 0 };
const holding = { assetId: 'a'.repeat(64) + '0000', quantity: '1' };
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const minted = (account, input) => ({ status: 'minted', profileId: account.profileId, operationId: input.operationId, asset: holding });
const sendRecord = profileId => ({
  version: 1, id: 'send-one', profileId, status: 'pending', transactionId: 'b'.repeat(64),
  quote: { id: 'send-quote', profileId, recipient: 'tark1fixture', amountSats: 500, feeSats: 0, totalSats: 500, maxSats: 1000, expiresAt: 2000, fingerprint: 'c'.repeat(64) },
  inputs: [{ txid: 'd'.repeat(64), vout: 0 }], recipientScript: '5120' + 'e'.repeat(64),
});
const transferRecord = profileId => ({
  version: 1, id: 'transfer-one', profileId, status: 'pending', phase: 'registered', intentId: 'intent-one',
  inputs: [{ txid: 'f'.repeat(64), vout: 0 }], bitcoinAddress: 'tb1fixture',
  quote: { profileId, direction: 'to-arkade', amountSats: 1000, feeSats: 0, netSats: 1000, maxSats: 2000, bitcoinAfterSats: 1000, arkadeAfterSats: 1000, totalAfterSats: 2000, expiresAt: 2000, fingerprint: 'a'.repeat(64) },
});

let values, lockCalls, contexts;
test.beforeEach(() => {
  values = new Map();
  lockCalls = [];
  contexts = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } });
  const locks = testLocks();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request(name, options, work) { lockCalls.push(name); return locks.request(name, options, work); },
  } });
});
test.afterEach(() => { for (const context of contexts) context.dispose(); });

function setup({ profileId = 'profile-a', assets = {} } = {}) {
  let account = { profileId, phrase: `fixture:${profileId}` }, generation = 0;
  let nextLoad;
  const listeners = new Set();
  const calls = { mint: 0, list: 0 };
  const storage = {
    async load() {
      const snapshot = { account, generation };
      const held = nextLoad;
      nextLoad = undefined;
      if (held) { held.entered.resolve(); await held.release.promise; }
      return snapshot;
    },
    async save() { throw new Error('Unexpected account write in asset context test.'); },
    async reset() { throw new Error('Unexpected account reset in asset context test.'); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const adapters = {
    async list(...args) { calls.list++; return assets.list ? assets.list(...args) : [holding]; },
    async mint(...args) { calls.mint++; return assets.mint ? assets.mint(...args) : minted(...args); },
  };
  const context = createContext(storage, undefined, async phrase => phrase.slice('fixture:'.length), undefined,
    undefined, undefined, undefined, undefined,
    { reconcile: async () => { throw new Error('No network reconciliation in fixture.'); } }, adapters);
  contexts.push(context);
  return {
    context, calls,
    holdNextLoad() {
      const held = { entered: deferred(), release: deferred() };
      nextLoad = held;
      return held;
    },
    replace(nextProfileId = profileId, notify = true) {
      account = { profileId: nextProfileId, phrase: `fixture:${nextProfileId}` };
      generation++;
      if (notify) for (const listener of listeners) listener();
    },
  };
}

test('concurrent same-wallet callers reach the mint adapter once and release the lock afterward', async () => {
  const entered = deferred(), release = deferred();
  const first = setup({ assets: { mint: async (account, input) => {
    entered.resolve(); await release.promise; return minted(account, input);
  } } });
  const peer = setup();
  await Promise.all([first.context.ready(), peer.context.ready()]);
  const work = first.context.mintAsset(request);
  await entered.promise;
  try {
    for (const context of [first.context, peer.context]) {
      const result = await context.mintAsset({ ...request, operationId: 'mint-two' });
      assert.equal(result.code, 'busy');
    }
    assert.equal(first.calls.mint, 1);
    assert.equal(peer.calls.mint, 0);
  } finally { release.resolve(); }
  assert.equal((await work).status, 'minted');
  assert.equal((await peer.context.mintAsset({ ...request, operationId: 'mint-two' })).status, 'minted');
  assert.equal(peer.calls.mint, 1);
});

test('list proceeds during a held mint lock without creating or changing transaction journals', async () => {
  const entered = deferred(), release = deferred();
  const owner = setup({ assets: { mint: async (account, input) => {
    writeAssetRecord(account.profileId, { request: input, status: 'pending' });
    entered.resolve(); await release.promise; return minted(account, input);
  } } });
  const reader = setup();
  await Promise.all([owner.context.ready(), reader.context.ready()]);
  const work = owner.context.mintAsset(request);
  await entered.promise;
  const journals = [...values.entries()], locksBefore = lockCalls.length;
  try {
    assert.deepEqual(await reader.context.listAssets(), { status: 'success', profileId: 'profile-a', assets: [holding] });
    assert.deepEqual([...values.entries()], journals);
    assert.equal(lockCalls.length, locksBefore);
  } finally { release.resolve(); await work; }
});

for (const [name, write] of [
  ['send', () => writeSendRecord(sendRecord('profile-a'))],
  ['transfer', () => writeBoardingRecord(transferRecord('profile-a'))],
]) {
  test(`pending ${name} blocks mint before the adapter while fresh listing remains read-only`, async () => {
    const fixture = setup();
    await fixture.context.ready();
    write();
    const journals = [...values.entries()];
    assert.equal((await fixture.context.mintAsset(request)).status, 'error');
    assert.equal(fixture.calls.mint, 0);
    const locksBefore = lockCalls.length;
    assert.equal((await fixture.context.listAssets()).status, 'success');
    assert.equal(lockCalls.length, locksBefore);
    assert.deepEqual([...values.entries()], journals);
  });
}

test('another wallet can mint while the first wallet holds its mutation lock', async () => {
  const entered = deferred(), release = deferred();
  const first = setup({ assets: { mint: async (account, input) => {
    entered.resolve(); await release.promise; return minted(account, input);
  } } });
  const other = setup({ profileId: 'profile-b' });
  await Promise.all([first.context.ready(), other.context.ready()]);
  const work = first.context.mintAsset(request);
  await entered.promise;
  try {
    const result = await other.context.mintAsset(request);
    assert.equal(result.status, 'minted');
    assert.equal(result.profileId, 'profile-b');
    assert.equal(other.calls.mint, 1);
  } finally { release.resolve(); await work; }
});

test('foreign pending send, transfer and mint journals stay isolated from this account', async () => {
  const fixture = setup({ profileId: 'profile-b' });
  await fixture.context.ready();
  writeSendRecord(sendRecord('profile-a'));
  writeBoardingRecord(transferRecord('profile-a'));
  writeAssetRecord('profile-a', { request, status: 'pending' });
  const journals = [...values.entries()];
  assert.equal((await fixture.context.getPendingAssetMint()).request, null);
  assert.equal((await fixture.context.mintAsset(request)).profileId, 'profile-b');
  assert.equal((await fixture.context.listAssets()).profileId, 'profile-b');
  assert.deepEqual([...values.entries()], journals);
});

for (const method of ['mintAsset', 'listAssets']) {
  for (const change of ['dispose', 'replace-profile', 'replace-generation']) {
    test(`${method} cannot reach its adapter when ${change} occurs during account storage loading`, async () => {
      const fixture = setup();
      await fixture.context.ready();
      const held = fixture.holdNextLoad();
      const work = fixture.context[method](request);
      await held.entered.promise;
      if (change === 'dispose') fixture.context.dispose();
      else { fixture.replace(change === 'replace-profile' ? 'profile-b' : 'profile-a'); await fixture.context.ready(); }
      held.release.resolve();
      const result = await work;
      assert.equal(result.code, change === 'dispose' ? 'disposed' : 'account-changed');
      assert.deepEqual(fixture.calls, { mint: 0, list: 0 });
      assert.equal(values.size, 0);
    });
  }
}

test('an unannounced storage generation change also prevents mint from using the stale active account', async () => {
  const fixture = setup();
  await fixture.context.ready();
  fixture.replace('profile-a', false);
  assert.equal((await fixture.context.mintAsset(request)).status, 'error');
  assert.equal(fixture.calls.mint, 0);
  assert.equal(values.size, 0);
});

for (const change of ['dispose', 'replace-profile', 'replace-generation']) {
  test(`a submitted mint completing after ${change} retains its original journal and suppresses stale success`, async () => {
    const entered = deferred(), release = deferred();
    let adapterSignal, adapterIsCurrent;
    const fixture = setup({ assets: { mint: async (account, input, signal, isCurrent) => {
      adapterSignal = signal; adapterIsCurrent = isCurrent;
      writeAssetRecord(account.profileId, { request: input, status: 'pending' });
      entered.resolve(); await release.promise;
      // Submission has already happened: late completion belongs to its original owner.
      writeAssetRecord(account.profileId, { request: input, status: 'succeeded', asset: holding });
      return minted(account, input);
    } } });
    await fixture.context.ready();
    const work = fixture.context.mintAsset(request);
    await entered.promise;
    assert.equal(adapterIsCurrent(), true);
    if (change === 'dispose') fixture.context.dispose();
    else { fixture.replace(change === 'replace-profile' ? 'profile-b' : 'profile-a'); await fixture.context.ready(); }
    assert.equal(adapterSignal.aborted, true);
    assert.equal(adapterIsCurrent(), false);
    release.resolve();
    const result = await work;
    assert.equal(result.code, change === 'dispose' ? 'disposed' : 'account-changed');
    assert.equal(result.profileId, 'profile-a');
    assert.equal(result.asset, undefined);
    assert.equal(readAssetRecords('profile-a')[0].status, 'succeeded');
    assert.deepEqual(readAssetRecords('profile-b'), []);
  });
}

test('missing browser locks prevents mint but leaves read-only listing available', async () => {
  const fixture = setup();
  await fixture.context.ready();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  assert.equal((await fixture.context.mintAsset(request)).code, 'unsupported-environment');
  assert.equal(fixture.calls.mint, 0);
  assert.equal((await fixture.context.listAssets()).status, 'success');
  assert.equal(values.size, 0);
});

for (const mode of ['missing', 'throws']) {
  test(`${mode} public journal storage prevents mint without reaching its adapter or leaking the failure`, async () => {
    const fixture = setup();
    await fixture.context.ready();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mode === 'missing' ? undefined : {
      getItem() { throw new Error('private-storage-diagnostic'); },
    } });
    const result = await fixture.context.mintAsset(request);
    assert.equal(result.status, 'error');
    assert.equal(fixture.calls.mint, 0);
    assert.ok(!JSON.stringify(result).includes('private-storage-diagnostic'));
    assert.equal((await fixture.context.listAssets()).status, 'success');
  });
}
