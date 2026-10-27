import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { register, assign, create } from './test-wallets/inventory.ts';
import { observe } from './test-wallets/observations.ts';
import { readinessTarget, classifyReadiness, boundedObservation, pollOwnedObservation } from './test-wallets/readiness.ts';
import { ownedReadiness } from './test-wallets/owned-readiness.ts';
import { argumentsFor } from './test-wallets/arguments.ts';
import { joinedRequest } from './test-wallets/joined-browser.ts';
import { Operations } from './test-wallets/operations.ts';

const zero = { availableSats: 0, availableBitcoinSats: 0, availableArkadeSats: 0, totalSats: 0, bitcoinSats: 0, arkadeSats: 0 };
const funded = { ...zero, availableSats: 1000, availableArkadeSats: 1000, totalSats: 1000, arkadeSats: 1000 };

test('owned observation awaits asynchronous false values instead of accepting their Promises',async()=>{
  let reads=0;
  assert.equal(await pollOwnedObservation(async()=>++reads===3,AbortSignal.timeout(1000),0),true);
  assert.equal(reads,3);
});

test('owned observation bounds an unresolved read without reporting readiness',async()=>{
  const controller=new AbortController();
  const result=pollOwnedObservation(()=>new Promise(()=>{}),controller.signal,0);
  controller.abort();
  await assert.rejects(result,/observation-cancelled/);
});
// In-memory transaction seam: synthetic accounts never touch the private user
// vault or Shared environment. Production encrypted-vault tests run separately.
async function fixture() {
  const state = { accounts: [], pairs: [], applications: [] };
  const vault = { transaction: async read => read(state) };
  await register(vault, ['player', 'game', 'used'].map(label => ({ label, phrase: generateMnemonic(wordlist) })), 'supplied');
  await assign(vault, { pair: 'pair', player: 'player', game: 'game', network: 'signet' });
  return { vault, state };
}

test('readiness target validation is strict before private access, and amounts are requirements not spend budgets', () => {
  assert.deepEqual(readinessTarget({ expect: 'funded' }), { expect: 'funded', bitcoinSats: 0, arkadeSats: 1 });
  assert.deepEqual(readinessTarget({ expect: 'funded', bitcoin: '1000' }), { expect: 'funded', bitcoinSats: 1000, arkadeSats: 0 });
  for (const options of [{ expect: 'empty', arkade: 0 }, { expect: 'funded', bitcoin: 0, arkade: 0 },
    { expect: 'funded', bitcoin: '-1' }, { expect: 'funded', arkade: '1e3' }, { arkade: '1000' },
    { expect: 'mainnet' }, { expect: 'funded', bitcoin: Number.MAX_SAFE_INTEGER + 1 }])
    assert.throws(() => readinessTarget(options), /readiness/);
  assert.equal(argumentsFor(['status', '--live', '--expect', 'empty']).values.expect, 'empty');
  assert.throws(() => argumentsFor(['status', '--expect', 'empty']), /requires-live/);
  assert.throws(() => argumentsFor(['create', '--account', 'fresh', '--network', 'signet', '--expect', 'funded']), /requires-live/);
});

test('readiness distinguishes all six states without fabricating journal evidence', () => {
  const empty = readinessTarget({ expect: 'empty' }), target = readinessTarget({ expect: 'funded', arkade: 1000 });
  assert.equal(classifyReadiness(zero, 0, empty, 0).readiness, 'empty');
  assert.equal(classifyReadiness(funded, 0, target, 0).readiness, 'ready');
  assert.equal(classifyReadiness(funded, 0, empty, 0).readiness, 'dirty');
  assert.equal(classifyReadiness(zero, 1, empty, 0).readiness, 'dirty');
  assert.equal(classifyReadiness(zero, 0, empty, 1).readiness, 'pending');
  assert.equal(classifyReadiness(zero, 0, empty).readiness, 'incomplete');
  assert.equal(classifyReadiness(zero, 0, target, 0).reason, 'insufficient-spendable-funds');
  assert.equal(classifyReadiness(funded, 0, empty).readiness, 'dirty');
  assert.throws(() => classifyReadiness(zero, 0, empty, -1), /live-read-invalid/);
});

test('observations classify used accounts honestly, scope each network, and keep failed reads unavailable', async () => {
  const { vault } = await fixture();
  const adapters = { balance: async account => account.network === 'signet' ? funded : zero, assets: async () => [], pending: async () => 0 };
  const result = await observe(vault, { account: 'used', expect: 'empty' }, adapters);
  assert.deepEqual(result.accounts[0].networks.map(row => row.readiness), ['dirty', 'empty']);
  const sufficient = await observe(vault, { account: 'used', expect: 'funded', arkade: 1000 }, adapters);
  assert.deepEqual(sufficient.accounts[0].networks.map(row => row.readiness), ['ready', 'incomplete']);
  for (const changed of [{ balance: async () => { throw Error('private-sentinel'); } },
    { assets: async () => { throw Error('private-sentinel'); } },
    { balance: async () => ({ ...funded, availableArkadeSats: 9999 }) }]) {
    const failure = await observe(vault, { account: 'used', expect: 'empty' }, { ...adapters, ...changed });
    assert.equal(failure.accounts[0].networks.every(row => row.readiness === 'unavailable' && row.balances === undefined), true);
    assert.equal(JSON.stringify(failure).includes('private-sentinel'), false);
  }
  const pendingFailure = await observe(vault, { account: 'used', expect: 'empty' },
    { ...adapters, pending: async () => { throw Error('private-sentinel'); } });
  assert.equal(pendingFailure.accounts[0].networks.every(row => row.reads.appPending === 'unavailable' && row.balances !== undefined), true);
  assert.equal(JSON.stringify(pendingFailure).includes('private-sentinel'), false);
  const noJournals = await observe(vault, { account: 'used', network: 'mutinynet', expect: 'empty' }, { balance: async () => zero, assets: async () => [] });
  assert.equal(noJournals.accounts[0].networks[0].reason, 'application-journals-unverified');
});

test('live observation isolates balance, asset and application-journal failures without error details', async () => {
  const { vault } = await fixture();
  const base = { balance: async () => funded, assets: async () => [], pending: async () => 0 };
  const balanceFailed = await observe(vault, { account: 'used', network: 'signet', expect: 'funded', arkade: 1000 },
    { ...base, balance: async () => { throw Error('private provider detail'); } });
  assert.deepEqual(balanceFailed.accounts[0].networks[0].reads, { balance: 'failed', assets: 'ok', appPending: 'zero' });
  assert.equal(balanceFailed.accounts[0].networks[0].reason, 'live-read-unavailable');
  assert.equal(JSON.stringify(balanceFailed).includes('private provider detail'), false);

  const assetsFailed = await observe(vault, { account: 'used', network: 'signet', expect: 'funded', arkade: 1000 },
    { ...base, assets: async () => { throw Error('private indexer detail'); } });
  assert.deepEqual(assetsFailed.accounts[0].networks[0].reads, { balance: 'ok', assets: 'failed', appPending: 'zero' });
  assert.equal(assetsFailed.accounts[0].networks[0].reason, 'live-read-unavailable');

  const journalFailed = await observe(vault, { account: 'used', network: 'signet', expect: 'funded', arkade: 1000 },
    { ...base, pending: async () => { throw Error('private journal detail'); } });
  assert.deepEqual(journalFailed.accounts[0].networks[0].reads, { balance: 'ok', assets: 'ok', appPending: 'unavailable' });
  assert.equal(journalFailed.accounts[0].networks[0].reason, 'application-journals-unverified');
  assert.equal(JSON.stringify(journalFailed).includes('private journal detail'), false);
});

test('funding recipient reservations also prevent ready classification, without poisoning the other network', async () => {
  const { vault, state } = await fixture();
  const player = state.accounts[0], target = state.accounts[2];
  const ledger = new Operations(vault);
  await ledger.prepare({ id: 'original-funding', account: player.label, profileId: player.profileId, generation: 1,
    network: 'signet', kind: 'arkade-send', recipient: 'public-recipient', amountSats: 1000, feeSats: 0,
    target: { account: target.label, profileId: target.profileId, generation: 1 } });
  const result = await observe(vault, { account: target.label, expect: 'funded' }, {
    balance: async () => funded, assets: async () => [], pending: async () => 0 });
  assert.deepEqual(result.accounts[0].networks.map(row => row.readiness), ['pending', 'ready']);
  assert.deepEqual(result.accounts[0].networks[0].operationIds, ['original-funding']);
});

test('owned readiness binds role/network and rechecks context; joined mode never gains the reader', async () => {
  const { vault, state } = await fixture();
  let inspections = 0;
  const owner = { vault, registration: { application: { app: 'marketplace', origin: 'http://127.0.0.1:5174' },
    pair: state.pairs[0], player: state.accounts[0], game: state.accounts[1] },
    inspect: async () => { inspections++; return { mode: 'owned' }; }, close: async () => {} };
  const request = { command: 'status', live: true, role: 'game', expect: 'empty' };
  const result = await ownedReadiness(owner, request, { balance: async account => {
    assert.equal(account.label, 'game'); assert.equal(account.network, 'signet'); return zero;
  }, assets: async () => [], pending: async () => 0 });
  assert.equal(result.accounts.length, 1); assert.equal(result.accounts[0].label, 'game');
  assert.equal(result.accounts[0].networks[0].readiness, 'empty');
  assert.match(result.journalScope, /selected-application/); assert.equal(inspections, 2);
  assert.throws(() => joinedRequest(request), /joined-action-denied/);
  await assert.rejects(ownedReadiness(owner, { ...request, network: 'mutinynet' }), /invalid-readiness-request/);
  let closed = false;
  owner.close = async () => { closed = true; };
  owner.inspect = async () => { if (inspections++ > 2) throw Error('private-sentinel'); return { mode: 'owned' }; };
  await assert.rejects(ownedReadiness(owner, request, { balance: async () => zero, assets: async () => [], pending: async () => 0 }), /context-unavailable/);
  assert.equal(closed, true);
  closed = false;
  owner.inspect = async () => { throw Error('private-sentinel'); };
  await assert.rejects(ownedReadiness(owner, request), /context-unavailable/);
  assert.equal(closed, true);
});

test('on-demand empty-account creation retains agent provenance and both-network standing permission without funding', async () => {
  const { vault, state } = await fixture();
  await create(vault, 'fresh', 'mutinynet', { makeAccount: async (signal, network) => {
    assert.equal(signal.aborted, false); assert.equal(network, 'mutinynet');
    return { phrase: generateMnemonic(wordlist) };
  } });
  const fresh = state.accounts.find(account => account.label === 'fresh');
  assert.equal(fresh.provenance, 'agent-created');
  assert.deepEqual(fresh.grant.networks, ['signet', 'mutinynet']);
  assert.equal(fresh.grant.active, true); assert.equal(state.operations, undefined);
  const result = await observe(vault, { account: 'fresh', expect: 'empty' }, { balance: async () => zero, assets: async () => [], pending: async () => 0 });
  assert.equal(result.accounts[0].networks.every(row => row.readiness === 'empty'), true);
});

test('bounded observations cancel even a provider that ignores AbortSignal', async () => {
  const controller = new AbortController();
  const read = boundedObservation(() => new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(read, /observation-cancelled/);
});

