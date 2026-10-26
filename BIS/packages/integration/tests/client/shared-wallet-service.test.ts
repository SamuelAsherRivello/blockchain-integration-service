import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedArkadeWalletService, normalizeSharedWalletFailure } from '../../src/client/wallet-layer-arkade/shared-wallet-service.ts';

function wallet(overrides = {}) {
  const operation = { settle: async () => 'commitment-id' };
  return {
    arkProvider: { getInfo: async () => ({ network: 'signet', fees: { txFeeRate: '0' } }) },
    getBalance: async () => ({ total: 100_000n, available: 0n, settled: 0n, preconfirmed: 0n, recoverable: 0n, boarding: { total: 100_000n } }),
    getBoardingAddress: async () => 'tb1qboarding',
    getAddress: async () => 'tark1arkade',
    getBoardingUtxos: async () => [{ txid: 'a'.repeat(64), vout: 0, value: 100_000n, status: { confirmed: true } }],
    getTransactionHistory: async () => [{ key: { boardingTxid: 'a'.repeat(64) }, amount: 100_000 }],
    ...operation,
    ...overrides,
  };
}

test('shared service reads scoped public wallet state without exposing secrets', async () => {
  const service = createSharedArkadeWalletService({ scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' }, wallet: wallet() });
  const state = await service.read();
  assert.equal(state.balance.total, 100_000);
  assert.equal(state.balance.boarding, 100_000);
  assert.equal(state.arkadeAddress, 'tark1arkade');
  assert.equal('phrase' in state, false);
});

test('shared service rejects an operator network mismatch before settlement', async () => {
  const service = createSharedArkadeWalletService({
    scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' },
    wallet: wallet({ arkProvider: { getInfo: async () => ({ network: 'mutinynet' }) } }),
  });
  await assert.rejects(() => service.onboard(), error => error.code === 'operator-unavailable');
});

test('shared service preserves fee estimation failures as operator unavailable', async () => {
  const records = [];
  const service = createSharedArkadeWalletService({
    scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' },
    wallet: wallet({ settle: async () => { throw new Error('HTTP 400 fee-estimation-unavailable'); } }),
    store: { read: () => records.at(-1), write: value => records.push(value) },
  });
  await assert.rejects(() => service.onboard(), error => error.code === 'operator-unavailable');
  assert.equal(records.at(-1).failureCode, 'operator-unavailable');
  assert.equal(records.at(-1).status, 'failed');
  assert.equal(normalizeSharedWalletFailure(new Error('fee-estimation-unavailable')).code, 'operator-unavailable');
});

test('shared service requires an explicit retry after an operator failure', async () => {
  const records = [];
  let attempts = 0;
  const service = createSharedArkadeWalletService({
    scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' },
    wallet: wallet({ settle: async () => { attempts += 1; if (attempts === 1) throw new Error('fee-estimation-unavailable'); return 'commitment-id'; } }),
    store: { read: () => records.at(-1), write: value => records.push(value) },
  });
  await assert.rejects(() => service.onboard(), error => error.code === 'operator-unavailable');
  await assert.rejects(() => service.onboard(), error => error.code === 'operator-unavailable');
  assert.equal(attempts, 1);
  await service.onboard({ retryFailed: true });
  assert.equal(attempts, 2);
  assert.equal(records.at(-1).status, 'complete');
});

test('shared service retains an ambiguous settlement as pending', async () => {
  const records = [];
  const service = createSharedArkadeWalletService({
    scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' },
    wallet: wallet({ settle: async () => { throw new Error('settlement outcome unknown'); } }),
    store: { read: () => records.at(-1), write: value => records.push(value) },
  });
  await assert.rejects(() => service.onboard(), error => error.code === 'outcome-unknown');
  assert.equal(records.at(-1).status, 'pending');
  assert.equal(records.at(-1).stage, 'failed');
});

test('already available Arkade funds bypass failed boarding without rewriting its history', async () => {
  const failed = { id: 'original-boarding', status: 'failed', failureCode: 'operator-unavailable', failureMessage: 'fee-estimation-unavailable' };
  let writes = 0;
  const service = createSharedArkadeWalletService({
    scope: { walletId: 'wallet-1', network: 'signet', operator: 'https://signet.arkade.sh', role: 'faucet' },
    wallet: wallet({
      getBalance: async () => ({ total: 150_000n, available: 50_000n, settled: 50_000n, boarding: { total: 100_000n } }),
      settle: async () => { assert.fail('Available offchain funds must not trigger another boarding batch.'); },
      getBoardingUtxos: async () => { assert.fail('Available offchain funds do not require boarding selection.'); },
    }),
    store: { read: () => failed, write: () => { writes += 1; } },
  });
  const state = await service.onboard();
  assert.equal(state.balance.available, 50_000);
  assert.equal(state.balance.boarding, 100_000);
  assert.equal(state.operation, failed);
  assert.equal(state.operation.status, 'failed');
  assert.equal(writes, 0);
});
