import assert from 'node:assert/strict';
import test from 'node:test';
import { Transaction } from '@arkade-os/sdk';
import { maintenanceAssets, maintenanceJournal, maintenanceLock, type MaintenanceRecord } from '../src/client/wallet-maintenance-state.ts';
import { cleanManagedWallet, installWalletMaintenance, reconcileMaintenanceRecord, walletMaintenanceScope } from '../src/client/wallet-maintenance.ts';

const hash = 'a'.repeat(64), assetId = hash + '0000';
const script = '5120' + 'b'.repeat(64);
const descriptor = "tr([aabbccdd/86'/1'/0']public-key/0/*)";
const address = 'unused-in-non-settlement-fixtures';
const input = { txid: hash, vout: 0, value: 330, virtual: true, assets: [{ assetId, amount: '1' }] };
const tx = new Transaction({ allowUnknownInputs: true, allowUnknownOutputs: true });
tx.addInput({ txid: hash, index: 0 });
tx.addOutput({ script: Uint8Array.from(Buffer.from(script, 'hex')), amount: 330n });
const record = (): MaintenanceRecord => ({ id: 'test-settlement', createdAt: 1, state: 'pending', attempted: true, inputs: [structuredClone(input)], outputs: [{ script, amount: '330', offchain: true }], commitmentTxid: tx.id });

function storage() {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}
function environment(t) {
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const memory = storage();
  const held = new Set<string>();
  const locks = { request: async (key, _options, callback) => {
    if (held.has(key)) return callback(null);
    held.add(key);
    try { return await callback({ name: key }); } finally { held.delete(key); }
  } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  t.after(() => {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete (globalThis as any).localStorage;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete (globalThis as any).navigator;
  });
  return memory;
}
function walletFixture() {
  const calls: string[] = [];
  let pendingFlag = false;
  const receipt = { txid: 'c'.repeat(64), vout: 0, script, value: 330, commitmentTxIds: [tx.id], assets: [{ assetId, amount: 1n }] };
  const wallet: any = {
    walletRepository: { getWalletState: async () => ({ settings: { hasPendingTx: pendingFlag } }) },
    arkProvider: { registerIntent: async () => 'registered', getInfo: async () => ({ fees: { intentFee: { offchainInput: '0.0', offchainOutput: '0.0' } } }) },
    indexerProvider: { getVtxos: async options => ({ vtxos: options.outpoints ? [{ ...input, isSpent: true, settledBy: tx.id }] : [receipt] }) },
    onchainProvider: { getRawTransaction: async () => tx.unsignedTx },
    getAddress: async () => address,
    restore: async () => { calls.push('restore'); },
    getContractManager: async () => ({ refreshVtxos: async () => { calls.push('refresh'); }, getContracts: async () => [{ type: 'default', script }] }),
    finalizePendingTxs: async () => { calls.push('finalize-original'); pendingFlag = false; return { pending: [hash], finalized: [hash] }; },
    getVtxoManager: async () => ({ getRecoverableBalance: async () => ({ recoverable: 0, subdust: 0 }), recoverVtxos: async () => { calls.push('recover'); } }),
    send: async () => { calls.push('new-send'); return hash; },
  };
  return { wallet, calls, receipt, setPending: value => { pendingFlag = value; } };
}

test('journal survives reconstruction, isolates full identity/network and retains terminal history', async t => {
  const memory = environment(t);
  const first = await walletMaintenanceScope('signet', descriptor);
  const otherNetwork = await walletMaintenanceScope('mutinynet', descriptor);
  const otherIdentity = await walletMaintenanceScope('signet', descriptor + '-other');
  maintenanceJournal(first).save(record());
  assert.equal(maintenanceJournal(first).pending().length, 1);
  assert.equal(maintenanceJournal(otherNetwork).read().length, 0);
  assert.equal(maintenanceJournal(otherIdentity).read().length, 0);
  const completed = record(); completed.state = 'settled';
  maintenanceJournal(first).save(completed);
  assert.equal(maintenanceJournal(first).pending().length, 0);
  assert.equal(maintenanceJournal(first).read().length, 1);
  assert.doesNotMatch([...memory.values.keys()].join(''), /public-key|aabbccdd/);
  assert.throws(() => maintenanceAssets([{ assets: [{ assetId, amount: '-1' }] }]));
});

test('wallet lock rejects an overlapping owner but allows another identity', async t => {
  environment(t);
  let release;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const running = maintenanceLock(hash, async () => gate);
  await assert.rejects(maintenanceLock(hash, async () => {}), /Wallet is busy/);
  await maintenanceLock('b'.repeat(64), async () => {});
  release(); await running;
  await maintenanceLock(hash, async () => {});
});

test('overlapping operations on one wallet cannot reuse its mutation lock', async t => {
  environment(t);
  const f = walletFixture();
  let release;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.wallet.send = async () => { await gate; return hash; };
  f.wallet.sendBitcoin = async params => f.wallet.send(params);
  await installWalletMaintenance(f.wallet, 'signet', descriptor);
  const running = f.wallet.send({address,amount:330});
  await assert.rejects(f.wallet.send({address,amount:330}), /Wallet is busy/);
  await assert.rejects(f.wallet.sendBitcoin({address,amount:330}), /Wallet is busy/);
  release(); await running;
  assert.equal(await f.wallet.sendBitcoin({address,amount:330}), hash);
});

test('settlement reconciliation requires exact commitment, amount and all asset quantities', async () => {
  const f = walletFixture();
  assert.equal(await reconcileMaintenanceRecord(f.wallet, record()), true);
  f.receipt.assets[0].amount = 2n;
  const uncertain = record();
  assert.equal(await reconcileMaintenanceRecord(f.wallet, uncertain), false);
  assert.equal(uncertain.state, 'pending');
  f.receipt.assets[0].amount = 1n;
  f.receipt.value = 331;
  assert.equal(await reconcileMaintenanceRecord(f.wallet, record()), false);
  f.receipt.value = 330;
  const wrongCommitment = record(); wrongCommitment.commitmentTxid = 'd'.repeat(64);
  assert.equal(await reconcileMaintenanceRecord(f.wallet, wrongCommitment), false);
});

test('clean continues original pending sends and never calls send or erases history', async t => {
  const memory = environment(t), f = walletFixture();
  f.setPending(true);
  memory.setItem('history-to-preserve', 'unchanged');
  assert.equal(await cleanManagedWallet(f.wallet, hash), 'Wallet cleaned.');
  assert.equal(f.calls.filter(c => c === 'finalize-original').length, 1);
  assert.equal(f.calls.includes('new-send'), false);
  assert.equal(f.calls.includes('recover'), false);
  assert.equal(memory.getItem('history-to-preserve'), 'unchanged');
});

test('unresolved original sends stop recovery and remain retryable', async t => {
  environment(t); const f = walletFixture();
  f.setPending(true);
  f.wallet.finalizePendingTxs = async () => ({ pending: [hash], finalized: [] });
  await assert.rejects(cleanManagedWallet(f.wallet, hash), /pending transaction/);
  assert.equal(f.calls.includes('recover'), false);
  assert.equal((await f.wallet.walletRepository.getWalletState()).settings.hasPendingTx, true);
});

test('missing receipts retain settlement evidence and prevent a competing recovery', async t => {
  environment(t); const f = walletFixture();
  f.wallet.indexerProvider.getVtxos = async () => ({ vtxos: [] });
  maintenanceJournal(hash).save(record());
  await assert.rejects(cleanManagedWallet(f.wallet, hash), /pending transaction/);
  assert.equal(maintenanceJournal(hash).pending().length, 1);
  assert.equal(f.calls.includes('recover'), false);
});

test('settlement tracker distinguishes unsubmitted failure from lost registration acknowledgement', async t => {
  environment(t);
  const { ArkAddress } = await import('@arkade-os/sdk');
  const publicAddress = new ArkAddress(Uint8Array.from(Buffer.from('a'.repeat(64), 'hex')), Uint8Array.from(Buffer.from('b'.repeat(64), 'hex')), 'tark').encode();
  const params = { inputs: [{ ...input, script, assets: [] }], outputs: [{ address: publicAddress, amount: 330 }] };
  const f = walletFixture();
  f.wallet.settle = async () => { throw new Error('before dispatch'); };
  await installWalletMaintenance(f.wallet, 'signet', descriptor);
  const scope = await walletMaintenanceScope('signet', descriptor);
  await assert.rejects(f.wallet.settle(params), /before dispatch/);
  assert.equal(maintenanceJournal(scope).read()[0].state, 'not-submitted');
  const g = walletFixture();
  g.wallet.settle = async () => { await g.wallet.arkProvider.registerIntent({}); throw new Error('response lost'); };
  await installWalletMaintenance(g.wallet, 'signet', descriptor);
  await assert.rejects(g.wallet.settle(params), /response lost/);
  assert.equal(maintenanceJournal(scope).pending().length, 1);
  await assert.rejects(g.wallet.settle(params), /pending transaction/);
  assert.equal(maintenanceJournal(scope).read().length, 2);
});

for (const mode of ['complete', 'matched-failure', 'absent-after-matched-failure', 'lost-delete-ack']) test(`settlement stream isolates its registered batch: ${mode}`, async t => {
  environment(t);
  const { ArkAddress } = await import('@arkade-os/sdk');
  const ownAddress = new ArkAddress(Uint8Array.from(Buffer.from('a'.repeat(64), 'hex')), Uint8Array.from(Buffer.from('b'.repeat(64), 'hex')), 'tark').encode();
  const f = walletFixture();
  const registeredHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('registered'))).toString('hex');
  f.wallet.arkProvider.getEventStream = async function* () {
    yield { type: 'batch_failed', id: 'unrelated-before-registration', reason: 'unrelated' };
    yield { type: 'batch_started', id: 'own-batch', intentIdHashes: [registeredHash] };
    yield { type: 'batch_failed', id: 'unrelated-batch', reason: 'unrelated' };
    yield { type: 'batch_finalized', id: 'unrelated-batch', commitmentTxid: hash };
    yield mode === 'complete' ? { type: 'batch_finalized', id: 'own-batch', commitmentTxid: tx.id } : { type: 'batch_failed', id: 'own-batch', reason: 'matched failure' };
  };
  let deletions = 0;
  f.wallet.arkProvider.deleteIntent = async () => {
    deletions++;
    if (mode === 'lost-delete-ack') throw Error('delete acknowledgement lost');
    if (mode === 'absent-after-matched-failure') throw Object.assign(Error('no matching intents found for intent proof'), {name:'INVALID_INTENT_PROOF'});
  };
  const observed = [];
  f.wallet.settle = async () => {
    const stream = f.wallet.arkProvider.getEventStream(new AbortController().signal, []);
    const first = stream.next(); // Exercise event delivery before registration returns.
    await f.wallet.arkProvider.registerIntent({});
    let next = await first;
    while (!next.done) {
      const event = next.value; observed.push(event.id);
      if (event.type === 'batch_failed') { await f.wallet.arkProvider.deleteIntent({}); throw Error('matched failure'); }
      if (event.type === 'batch_finalized') return event.commitmentTxid;
      next = await stream.next();
    }
  };
  await installWalletMaintenance(f.wallet, 'signet', descriptor);
  const params = {inputs: [{...input,script,assets:[{assetId,amount:1n}]}],outputs:[{address:ownAddress,amount:330}]};
  if (mode === 'complete') assert.equal(await f.wallet.settle(params), tx.id);
  else await assert.rejects(f.wallet.settle(params), /matched failure|delete acknowledgement lost|no matching intents/);
  assert.deepEqual(observed,['own-batch','own-batch']);
  const rows=maintenanceJournal(await walletMaintenanceScope('signet',descriptor)).read();
  assert.equal(rows[0].intentHash,registeredHash);
  assert.equal(rows[0].batchId,'own-batch');
  assert.equal(rows[0].state,mode==='complete'?'settled':mode==='lost-delete-ack'?'pending':'failed');
  assert.equal(deletions,mode==='complete'?0:1);
  if(mode==='lost-delete-ack') await assert.rejects(f.wallet.send({address:ownAddress,amount:330}),/pending transaction/);
});

for (const mode of ['complete', 'asset-missing', 'fee-changed', 'contract-restricted']) test(`recovery verifies value and assets before success: ${mode}`, async t => {
  environment(t);
  const { ArkAddress } = await import('@arkade-os/sdk');
  const ownAddress = new ArkAddress(Uint8Array.from(Buffer.from('a'.repeat(64), 'hex')), Uint8Array.from(Buffer.from('b'.repeat(64), 'hex')), 'tark').encode();
  const f = walletFixture();
  f.wallet.getAddress = async () => ownAddress;
  f.wallet.finalizePendingTxs = async () => ({ pending: [], finalized: [] });
  let submissions = 0;
  const params = { inputs: [{ ...input, script, isSwept: true, createdAt: new Date(), assets: [{ assetId, amount: 1n }] }], outputs: [{ address: ownAddress, amount: 330 }] };
  f.wallet.settle = async () => { submissions++; await f.wallet.arkProvider.registerIntent({}); return tx.id; };
  f.wallet.getVtxoManager = async () => ({ getRecoverableBalance: async () => ({ recoverable: 330, subdust: 0 }), recoverVtxos: async () => f.wallet.settle(params) });
  if (mode === 'asset-missing') f.receipt.assets = [];
  if (mode === 'fee-changed') f.wallet.arkProvider.getInfo = async () => ({ fees: { intentFee: { offchainInput: '1.0', offchainOutput: '0.0' } } });
  if (mode === 'contract-restricted') f.wallet.getContractManager = async () => ({ refreshVtxos: async () => {}, getContracts: async () => [{ type: 'conditional-vault', script }] });
  await installWalletMaintenance(f.wallet, 'signet', descriptor);
  const scope = await walletMaintenanceScope('signet', descriptor);
  if (mode === 'complete') {
    assert.equal(await cleanManagedWallet(f.wallet, scope), 'Wallet cleaned.');
    assert.equal(maintenanceJournal(scope).read()[0].state, 'settled');
    assert.deepEqual(maintenanceAssets(maintenanceJournal(scope).read()[0].inputs), [{ assetId, amount: '1' }]);
    assert.equal(maintenanceJournal(scope).read()[0].outputs[0].amount, '330');
    assert.equal(submissions, 1);
  } else if (mode === 'asset-missing') {
    await assert.rejects(cleanManagedWallet(f.wallet, scope), /pending transaction/);
    await assert.rejects(cleanManagedWallet(f.wallet, scope), /pending transaction/);
    assert.equal(submissions, 1, 'a second cleanup must not resubmit an unresolved recovery');
    assert.equal(maintenanceJournal(scope).pending().length, 1);
  } else {
    await assert.rejects(cleanManagedWallet(f.wallet, scope), mode === 'contract-restricted' ? /Recovery excludes contract outputs/ : /Recovery fees changed/);
    assert.equal(submissions, 0);
    assert.equal(maintenanceJournal(scope).read().length, 0);
  }
});
