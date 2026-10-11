import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { register, assign } from './test-wallets/inventory.mjs';
import { Operations } from './test-wallets/operations.mjs';
import { Vault } from './test-wallets/vault.mjs';
import { rotate } from './test-wallets/rotation.mjs';

const zero = { availableSats: 0, availableBitcoinSats: 0, availableArkadeSats: 0, totalSats: 0, bitcoinSats: 0, arkadeSats: 0 };
const request = { account: 'old', network: 'signet' };
const fresh = () => ({ phrase: generateMnemonic(wordlist) });
const adapters = () => ({ balance: async () => ({ ...zero }), assets: async () => [], pending: async () => 0,
  makeAccount: async () => fresh(), assertNoOwnedSessions: async () => {} });
async function fixture(vault) {
  const state = { accounts: [], pairs: [] };
  vault ??= { transaction: async use => use(state) };
  await register(vault, ['old', 'other'].map(label => ({ label, ...fresh() })), 'supplied');
  await assign(vault, { pair: 'retained-pair', player: 'old', game: 'other', network: 'signet' });
  return { state, vault };
}

test('rotation validates target and malformed journal adapter before accessing private inventory', async () => {
  const vault = { transaction: () => assert.fail('invalid request cannot access vault') };
  for (const bad of [{ ...request, network: 'mainnet' }, { ...request, phrase: 'private-sentinel' }, { ...request, account: '../human' }])
    await assert.rejects(rotate(vault, bad, adapters()), /rotation|network|account-label/);
  await assert.rejects(rotate(vault, request, { pending: 'cached-zero' }), /rotation-journals-unavailable/);
});

test('default journal proof accepts only private never-exposed agent-created identities', async () => {
  for (const kind of ['supplied', 'paired', 'used', 'new-agent']) {
    const { vault, state } = await fixture();
    if (kind !== 'supplied') state.accounts[0].provenance = 'agent-created';
    if (kind !== 'paired') state.pairs = [];
    if (kind === 'used') {
      const source = state.accounts[0], ledger = new Operations(vault);
      await ledger.prepare({ id: 'old-operation', account: source.label, profileId: source.profileId,
        generation: 1, network: 'signet', kind: 'arkade-send', recipient: 'public-recipient', amountSats: 1, feeSats: 0 });
      await ledger.cancelPrepared('old-operation');
    }
    const hooks = adapters(); delete hooks.pending;
    if (kind === 'new-agent') assert.equal((await rotate(vault, request, hooks)).generation, 2);
    else await assert.rejects(rotate(vault, request, hooks), /rotation-journals-unavailable/);
  }
});

test('rotation freshly verifies both networks, archives recovery and preserves grants, assignments and journals', async () => {
  const { vault, state } = await fixture(), old = structuredClone(state.accounts[0]);
  state.operations = []; state.preparations = [{ id: 'retained-scenario' }];
  const pairs = structuredClone(state.pairs), observed = [];
  const result = await rotate(vault, { ...request, network: 'mutinynet' }, { ...adapters(), balance: async scope => {
    observed.push(scope.network); assert.equal(scope.profileId, old.profileId); return zero;
  } });
  assert.deepEqual(observed, ['signet', 'mutinynet']);
  assert.equal(result.generation, 2); assert.equal(state.accounts[0].provenance, 'agent-created');
  assert.notEqual(result.profileId, old.profileId); assert.deepEqual(state.accounts[0].grant, old.grant);
  assert.deepEqual(state.archivedAccounts[0].account, old);
  assert.deepEqual(state.pairs, pairs); assert.deepEqual(state.preparations, [{ id: 'retained-scenario' }]);
  assert.deepEqual(state.operations, []); assert.equal(JSON.stringify(result).includes(old.phrase), false);
  assert.equal(JSON.stringify(result).includes(state.accounts[0].phrase), false);
  const second = await rotate(vault, request, adapters());
  assert.equal(second.generation, 3); assert.equal(state.archivedAccounts.length, 2);
  assert.equal(state.archivedAccounts[1].account.generation, 2);
});

test('funded, assets, pending, unreadable and malformed observations refuse rotation without replacing identity', async () => {
  for (const change of [
    { balance: async () => ({ ...zero, bitcoinSats: 1, totalSats: 1 }) },
    { balance: async scope => scope.network === 'mutinynet' ? { ...zero, arkadeSats: 1, totalSats: 1 } : zero },
    { assets: async () => [{ assetId: 'retained-asset' }] }, { pending: async () => 1 },
    { pending: async () => undefined }, { pending: async () => { throw Error('private-sentinel'); } },
    { balance: async () => { throw Error('private-sentinel'); } }, { assets: async () => undefined },
    { balance: async () => ({ ...zero, availableSats: 1 }) },
  ]) {
    const { vault, state } = await fixture(), old = structuredClone(state.accounts[0]);
    await assert.rejects(rotate(vault, request, { ...adapters(), ...change,
      makeAccount: () => assert.fail('must reject before account creation') }), /rotation-/);
    assert.deepEqual(state.accounts[0], old); assert.equal(state.archivedAccounts, undefined);
  }
});

test('reported external work and unresolved source or target reservations refuse rotation', async () => {
  for (const kind of ['reported', 'source', 'recipient']) {
    const { vault, state } = await fixture(), old = structuredClone(state.accounts[0]);
    if (kind === 'reported') state.accounts[0].reportedPending = { signet: { kind: 'onboard', source: 'user-reported', reportedAt: new Date().toISOString() } };
    else {
      const source = kind === 'source' ? state.accounts[0] : state.accounts[1];
      await new Operations(vault).prepare({ id: 'original-intent', account: source.label, profileId: source.profileId,
        generation: 1, network: 'signet', kind: 'arkade-send', recipient: 'public-recipient', amountSats: 1, feeSats: 0,
        ...(kind === 'recipient' ? { target: { account: old.label, profileId: old.profileId, generation: 1 } } : {}) });
    }
    const before = structuredClone(state);
    await assert.rejects(rotate(vault, request, adapters()), /rotation-operation-unresolved/);
    assert.deepEqual(state, before);
  }
});

test('revocation, owned sessions, duplicate or failed new identity cannot replace current recovery', async () => {
  for (const kind of ['revoked', 'session', 'duplicate', 'bad-creation', 'bad-archive', 'changed-session']) {
    const { vault, state } = await fixture();
    if (kind === 'revoked') state.accounts[0].grant.active = false;
    if (kind === 'bad-archive') state.archivedAccounts = {};
    const old = structuredClone(state.accounts[0]), hooks = adapters();
    if (kind === 'session') hooks.assertNoOwnedSessions = async () => { throw Error('rotation-owned-session-active'); };
    if (kind === 'changed-session') {
      let calls = 0; hooks.assertNoOwnedSessions = async () => { if (++calls > 1) throw Error('rotation-owned-session-active'); };
    }
    if (kind === 'duplicate') hooks.makeAccount = async () => ({ phrase: old.phrase });
    if (kind === 'bad-creation') hooks.makeAccount = async () => { throw Error('private-sentinel'); };
    await assert.rejects(rotate(vault, request, hooks), /grant|rotation|duplicate/);
    assert.deepEqual(state.accounts[0], old);
    if (kind !== 'bad-archive') assert.equal(state.archivedAccounts, undefined);
  }
});

test('atomic encrypted rotation preserves old generation across failed commit and restart', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'bis-rotation-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const key = randomBytes(32), protector = {
    secure: async () => {}, check: async () => {},
    protect: async bytes => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
    },
    unprotect: async bytes => {
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
    },
  };
  const vault = new Vault({ root: join(parent, 'private'), protector }); await vault.initialize();
  await fixture(vault);
  const old = await vault.transaction(state => structuredClone(state.accounts[0]));
  const profileLock = join(vault.root, 'profile-synthetic.lock');
  await writeFile(profileLock, 'synthetic-owner-marker');
  const hooks = adapters(); delete hooks.assertNoOwnedSessions;
  await assert.rejects(rotate(vault, request, hooks), /rotation-owned-session-active/);
  assert.equal(await readFile(profileLock, 'utf8'), 'synthetic-owner-marker');
  await unlink(profileLock);
  vault.beforeCommit = () => { throw Error('simulated-interrupted-rotation'); };
  await assert.rejects(rotate(vault, request, adapters()), /simulated-interrupted-rotation/);
  await vault.transaction(state => { assert.deepEqual(state.accounts[0], old); assert.equal(state.archivedAccounts, undefined); });
  vault.beforeCommit = undefined;
  const result = await rotate(vault, request, adapters());
  const restarted = new Vault({ root: vault.root, protector });
  await restarted.transaction(state => {
    assert.deepEqual(state.archivedAccounts[0].account, old);
    assert.equal(state.accounts[0].profileId, result.profileId);
  });
  const disk = await readFile(join(vault.root, 'vault.json'), 'utf8');
  assert.equal(disk.includes(old.phrase), false);
  assert.equal(disk.includes('archivedAccounts'), false);
});
