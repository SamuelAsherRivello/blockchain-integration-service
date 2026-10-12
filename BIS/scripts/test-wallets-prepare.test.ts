import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { register } from './test-wallets/inventory.ts';
import { Operations } from './test-wallets/operations.ts';
import { prepare } from './test-wallets/prepare.ts';
import { argumentsFor } from './test-wallets/arguments.ts';

const zero = { availableSats: 0, availableBitcoinSats: 0, availableArkadeSats: 0, totalSats: 0, bitcoinSats: 0, arkadeSats: 0 };
const funded = { ...zero, availableSats: 1000, availableArkadeSats: 1000, totalSats: 1000, arkadeSats: 1000 };
const options = { account: 'recipient', network: 'signet', expect: 'funded', arkade: '1000', source: 'faucet', amount: '50000', operation: 'prepare-funding' };
async function fixture() {
  const state = { accounts: [], pairs: [] }, vault = { transaction: async read => read(state) };
  await register(vault, [{ label: 'recipient', phrase: generateMnemonic(wordlist) }], 'supplied');
  return { state, vault };
}
const observations = balance => ({ balance: async () => balance, assets: async () => [] });

test('preparation validates explicit target and funding selection before touching private data', async () => {
  const vault = { transaction: () => assert.fail('invalid input must not open vault') };
  for (const changed of [{ ...options, source: 'personal-wallet' }, { ...options, expect: 'empty' },
    { ...options, amount: '1' }, { ...options, operation: 'invalid phrase input' }])
    await assert.rejects(prepare(vault, changed), /preparation|account-label|readiness-target/);
  assert.equal(argumentsFor(['prepare', '--account', 'recipient', '--network', 'signet', '--expect', 'empty']).command, 'prepare');
});

test('existing spendable funds prevent redundant funding without claiming absent journal proof', async () => {
  const { vault } = await fixture();
  const result = await prepare(vault, options, { observations: observations(funded), fund: () => assert.fail('already funded') });
  assert.equal(result.funding, 'not-needed');
  assert.equal(result.accounts[0].networks[0].readiness, 'incomplete');
  assert.equal(result.accounts[0].networks[0].reason, 'application-journals-unverified');
});

test('empty preparation preserves existing assets and never drains, burns or requests funding', async () => {
  const { vault } = await fixture();
  const assets = [{ assetId: 'a'.repeat(64), quantity: '123' }];
  const result = await prepare(vault, { account: 'recipient', network: 'signet', expect: 'empty' }, {
    observations: { balance: async () => zero, assets: async () => assets }, fund: () => assert.fail('empty targets never fund') });
  assert.equal(result.accounts[0].networks[0].readiness, 'dirty');
  assert.equal(result.funding, 'not-requested'); assert.equal(assets[0].quantity, '123');
});

test('unavailable reads and missing Bitcoin funding support never trigger an Arkade faucet request', async () => {
  const { vault } = await fixture();
  const unavailable = await prepare(vault, options, { observations: { balance: async () => { throw Error('private-sentinel'); }, assets: async () => [] }, fund: () => assert.fail('unavailable read') });
  assert.equal(unavailable.accounts[0].networks[0].readiness, 'unavailable'); assert.equal(unavailable.funding, 'not-requested');
  const bitcoin = await prepare(vault, { ...options, bitcoin: '1000' }, { observations: observations(zero), fund: () => assert.fail('wrong asset funding') });
  assert.equal(bitcoin.reason, 'bitcoin-funding-adapter-unavailable');
});

test('optional funding retains original ID and re-observes instead of treating an acknowledgement as readiness', async () => {
  const { vault } = await fixture();
  let reads = 0, funds = 0;
  const result = await prepare(vault, options, { observations: { balance: async () => { reads++; return zero; }, assets: async () => [] },
    fund: async (_vault, captured) => {
      funds++; assert.deepEqual(captured, { account: 'recipient', network: 'signet', source: 'faucet', amount: '50000', operation: 'prepare-funding' });
      return { operation: { intent: { id: captured.operation }, state: 'pending' }, readiness: 'pending' };
    } });
  assert.equal(funds, 1); assert.equal(reads, 2); assert.equal(result.operation.intent.id, 'prepare-funding');
  assert.equal(result.recovery.readiness, 'pending'); assert.notEqual(result.accounts[0].networks[0].readiness, 'ready');
});

test('partial preparation checks the original unknown intent and never creates a replacement request', async () => {
  const { vault, state } = await fixture(), account = state.accounts[0], ledger = new Operations(vault);
  await ledger.prepare({ id: options.operation, account: account.label, profileId: account.profileId, generation: 1,
    network: 'signet', kind: 'faucet', recipient: `tark1${'a'.repeat(30)}`, amountSats: 50000, feeSats: null, sourceOrigin: 'http://127.0.0.1:5190' });
  const unknown = await ledger.submit(options.operation, async () => { throw Error('lost-ack'); });
  let checks = 0;
  const adapters = { observations: observations(funded), fund: () => assert.fail('unknown work must not fund again'),
    reconcile: async (_vault, id) => { checks++; assert.equal(id, options.operation); return { operation: unknown, readiness: 'pending' }; } };
  const result = await prepare(vault, options, adapters);
  assert.equal(checks, 1); assert.equal(result.funding, 'original-operation-checked');
  assert.equal(result.operation.state, 'unknown'); assert.equal(result.accounts[0].networks[0].readiness, 'pending');
  await assert.rejects(prepare(vault, { ...options, amount: '100000' }, adapters), /preparation-intent-conflict/);
  assert.equal(checks, 1);
});

