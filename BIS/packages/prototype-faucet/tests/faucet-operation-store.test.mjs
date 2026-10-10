import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createFaucetOperationStore, createProcessWalletLock } from '../src/shared/faucet-operation-store.mjs';

test('faucet operation store persists public operation state without recovery material', async () => {
  await mkdir(join(process.cwd(), 'output/reports/update-wallet-wrapper-for-general-use-on-faucet'), { recursive: true });
  const root = await mkdtemp(join(process.cwd(), 'output/reports/update-wallet-wrapper-for-general-use-on-faucet/test-'));
  const path = join(root, 'signet.json');
  const store = createFaucetOperationStore(path);
  await store.write({ id: 'operation-1', status: 'pending', phrase: 'never-persist-this', scope: { network: 'signet' } });
  const raw = await readFile(path, 'utf8');
  assert.equal(raw.includes('never-persist-this'), false);
  assert.deepEqual((await store.read()).scope, { network: 'signet' });
  await rm(root, { recursive: true, force: true });
});

test('faucet process lock serializes wallet mutations', async () => {
  const lock = createProcessWalletLock();
  const order = [];
  const first = lock('wallet', async () => { order.push('first-start'); await new Promise(resolve => setTimeout(resolve, 10)); order.push('first-end'); });
  const second = lock('wallet', async () => { order.push('second-start'); order.push('second-end'); });
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end']);
});
