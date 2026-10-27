import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from '@arkade-os/sdk';
import { demoCreateWallet, demoRefreshWallet, demoWithFreshWallet } from '../src/client/demo-wallet.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function fixture(failRefresh = false) {
  const calls: string[] = [];
  const vtxos = [{ txid: 'test-output' }];
  const wallet = {
    getContractManager: async () => ({ refreshVtxos: async () => {
      calls.push('contracts');
      if (failRefresh) throw new Error('refresh unavailable');
    } }),
    getVtxos: async () => { calls.push('vtxos'); return vtxos; },
    dispose: async () => { calls.push('dispose'); },
  };
  return { calls, vtxos, wallet };
}

test('refresh discovers contract outputs before fetching wallet VTXOs', async () => {
  const f = fixture();
  assert.equal(await demoRefreshWallet(f.wallet as any), f.vtxos);
  assert.deepEqual(f.calls, ['contracts', 'vtxos']);
  const failed = fixture(true);
  await assert.rejects(demoRefreshWallet(failed.wallet as any), /refresh unavailable/);
  assert.deepEqual(failed.calls, ['contracts']);
});

test('wallet factory preserves network, isolation and signer-only configuration', async t => {
  const f = fixture();
  const create = t.mock.method(Wallet, 'create', async () => f.wallet);
  assert.equal(await demoCreateWallet('mutinynet', { mnemonic, isolated: true }), f.wallet);
  const config = create.mock.calls[0].arguments[0];
  assert.equal(config.arkServerUrl, 'https://mutinynet.arkade.sh');
  assert.equal(config.walletMode, 'hd');
  assert.equal(config.lookAheadWindow, 20);
  assert.equal(config.settlementConfig, false);
  assert.equal(config.storage.walletRepository.constructor.name, 'InMemoryWalletRepository');
  assert.deepEqual(f.calls, ['contracts', 'vtxos']);
  f.calls.length = 0;
  await demoCreateWallet('signet', { mnemonic, isolated: true, signerOnly: true });
  assert.equal(create.mock.calls[1].arguments[0].walletMode, 'static');
  assert.deepEqual(f.calls, []);
  await demoCreateWallet('signet', { mnemonic, isolated: true, refresh: false, walletMode: 'auto' });
  assert.equal(create.mock.calls[2].arguments[0].walletMode, 'auto');
  assert.deepEqual(f.calls, []);
  await assert.rejects(demoCreateWallet('signet', { mnemonic: ' ' }), /Enter Wallet 2 Mnemonic/);
  assert.equal(create.mock.callCount(), 3);
});

test('failed wallet initialization disposes the wallet and preserves the refresh error', async t => {
  const f = fixture(true);
  t.mock.method(Wallet, 'create', async () => f.wallet);
  await assert.rejects(demoCreateWallet('signet', { mnemonic, isolated: true }), /refresh unavailable/);
  assert.deepEqual(f.calls, ['contracts', 'dispose']);
});

test('fresh-wallet wrapper retries only VTXO_NOT_FOUND once and releases each wallet', async t => {
  const first = fixture(), second = fixture();
  const fixtures = [first, second];
  const create = t.mock.method(Wallet, 'create', async () => fixtures.shift()!.wallet);
  let attempts = 0;
  const result = await demoWithFreshWallet('signet', async () => {
    if (++attempts === 1) throw new Error('VTXO_NOT_FOUND');
    return 'verified result';
  }, { mnemonic, isolated: true });
  assert.equal(result, 'verified result');
  assert.equal(create.mock.callCount(), 2);
  for (const f of [first, second]) assert.deepEqual(f.calls, ['contracts', 'vtxos', 'dispose']);
});

test('fresh-wallet wrapper propagates other failures without replaying the operation', async t => {
  const f = fixture();
  const create = t.mock.method(Wallet, 'create', async () => f.wallet);
  await assert.rejects(demoWithFreshWallet('signet', async () => {
    throw new Error('submission outcome unknown');
  }, { mnemonic, isolated: true }), /submission outcome unknown/);
  assert.equal(create.mock.callCount(), 1);
  assert.deepEqual(f.calls, ['contracts', 'vtxos', 'dispose']);
});
