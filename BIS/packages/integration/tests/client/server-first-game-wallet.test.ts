import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerFirstStorage, createServerProfileMemory } from '../../src/client/state-layer-core/server-first-game-wallet.ts';
import { probeGameSigner } from '../../src/client/wallet-layer-arkade/server-wallet.ts';
import { createLocalGameWallet } from '../../src/client/state-layer-core/game-wallet.ts';
import { preserveGameWalletSource } from '../../src/client/state-layer-core/game-wallet-source.ts';

function fixture() {
  let account: any = { profileId: 'saved-manual', phrase: 'local-only', network: 'signet' };
  const local = { load: async () => account, select: async value => { account = value; }, logout: async () => { account = null; }, reset: async () => { account = null; }, subscribe: () => () => {}, dispose() {} };
  let result: any = { status: 'absent', message: 'Server not found.' };
  const network = { value: 'signet' as 'signet' | 'mutinynet' };
  const backend = createServerFirstStorage(local, () => network.value, async () => result);
  return { local, backend, network, set: next => { result = next; }, account: () => account };
}
const remote: any = { profileId: 'server-wallet', network: 'signet', server: { endpoint: '/api/bis/', publicKey: '02' + '11'.repeat(32), gameId: 'stealth-and-steel' } };

test('missing server preserves explicit manual login and local storage', async () => {
  const { backend, account } = fixture(); await backend.refresh();
  assert.equal(backend.source().source, 'manual');
  assert.equal((await backend.storage.load())?.profileId, 'saved-manual');
  await backend.storage.select({ profileId: 'manual-new', phrase: 'local-only' });
  assert.equal(account().profileId, 'manual-new');
});

test('server takes precedence without saving a secret or deleting the manual identity', async () => {
  const { backend, set, account } = fixture(); set({ status: 'connected', account: remote }); await backend.refresh();
  assert.deepEqual(await backend.storage.load(), remote);
  assert.equal(account().profileId, 'saved-manual');
  await backend.storage.logout(); assert.deepEqual(await backend.storage.load(), remote);
  await assert.rejects(backend.storage.select({ profileId: 'other', phrase: 'local' }), /server selected/);
});

test('server loss offers manual login but never activates retained identity; return does not replace manual selection', async () => {
  const { backend, set } = fixture(); set({ status: 'connected', account: remote }); await backend.refresh();
  const original = await backend.storage.load();
  set({ status: 'absent', message: 'Stopped.' }); await backend.refresh();
  assert.equal(await backend.storage.load(), null);
  await backend.storage.select({ profileId: 'explicit-manual', phrase: 'local' });
  set({ status: 'connected', account: remote }); await backend.refresh();
  assert.equal((await backend.storage.load())?.profileId, 'explicit-manual');
  assert.equal(backend.source().source, 'manual'); assert.equal(original?.profileId, 'server-wallet');
});

test('reachable incompatible server stays an explicit error', async () => {
  const { backend, set } = fixture(); set({ status: 'error', message: 'Network mismatch.' }); await backend.refresh();
  await assert.rejects(backend.storage.load(), /mismatch/);
});

test('late probe response cannot replace a changed network', async () => {
  let resolve!: (value: any) => void;
  const { local, network } = fixture();
  const backend = createServerFirstStorage(local, () => network.value, () => new Promise(done => { resolve = done; }));
  const pending = backend.refresh(); network.value = 'mutinynet'; resolve({ status: 'connected', account: remote }); await pending;
  assert.equal(backend.source().source, 'manual');
});

test('source refresh pins each network profile and rejects a substitute after loss', async () => {
  const { local, network } = fixture();
  const calls: { network: string; profileId?: string }[] = [];
  let replacement = false, absent = false;
  const backend = createServerFirstStorage(local, () => network.value, async (network, options) => {
    calls.push({ network, profileId: options?.profileId });
    if (absent) return { status: 'absent', message: 'Stopped.' };
    return { status: 'connected', account: { ...remote, network, profileId: replacement ? 'substitute' : network + '-original' } };
  });
  await backend.refresh(); await backend.refresh();
  assert.deepEqual(calls.slice(0, 2), [{ network: 'signet', profileId: undefined }, { network: 'signet', profileId: 'signet-original' }]);
  network.value = 'mutinynet'; await backend.refresh(); await backend.refresh();
  assert.equal(calls.at(-1)?.profileId, 'mutinynet-original');
  network.value = 'signet'; absent = true; await backend.refresh();
  assert.equal(await backend.storage.load(), null);
  absent = false; replacement = true; await backend.refresh();
  assert.equal(calls.at(-1)?.profileId, 'signet-original');
  assert.equal(backend.source().serverStatus, 'error');
  await assert.rejects(backend.storage.load(), /Original BIS server wallet/);
  replacement = false; await backend.refresh();
  assert.equal((await backend.storage.load())?.profileId, 'signet-original');
  backend.storage.dispose();
});

test('public profile memory is scoped by endpoint and network and stores no signing material', () => {
  const rows = new Map<string, string>();
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } };
  let endpoint = 'https://signer.test/api/bis';
  const memory = createServerProfileMemory(storage, () => endpoint);
  const account = { ...remote, profileId: 'aa'.repeat(32), server: { ...remote.server, endpoint: endpoint + '/' } };
  assert.equal(memory.load('signet'), undefined);
  memory.save(account);
  assert.equal(memory.load('signet'), account.profileId);
  assert.equal(memory.load('mutinynet'), undefined);
  assert.deepEqual([...rows.values()], [account.profileId]);
  endpoint = 'https://other.test/api/bis/';
  assert.equal(memory.load('signet'), undefined);
  assert.throws(() => memory.save(account), /changed/);
  endpoint = account.server.endpoint;
  assert.equal(memory.load('signet'), account.profileId);
  rows.set([...rows.keys()][0], 'malformed');
  assert.throws(() => memory.load('signet'), /invalid/);
});

test('reloaded source reconnects the remembered profile and never silently replaces a removed slot', async () => {
  const rows = new Map<string, string>(), calls: (string | undefined)[] = [];
  const memory = createServerProfileMemory({ getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } }, () => '/api/bis/');
  const { local } = fixture();
  let original = { ...remote, profileId: 'bb'.repeat(32) };
  const probe = async (_network, options) => { calls.push(options?.profileId); return { status: 'connected' as const, account: original }; };
  const first = createServerFirstStorage(local, () => 'signet', probe, memory);
  await first.refresh(); assert.equal(calls.at(-1), undefined);
  first.storage.dispose();
  const reloaded = createServerFirstStorage(local, () => 'signet', probe, memory);
  await reloaded.refresh(); assert.equal(calls.at(-1), original.profileId);
  assert.equal((await reloaded.storage.load())?.profileId, original.profileId);
  original = { ...original, profileId: 'cc'.repeat(32) };
  await reloaded.refresh();
  await assert.rejects(reloaded.storage.load(), /Original BIS server wallet/);
  assert.deepEqual([...rows.values()], ['bb'.repeat(32)]);
  reloaded.storage.dispose();
});

test('unreadable or unwriteable public selection does not silently select a fresh signer', async () => {
  const { local } = fixture();
  let probes = 0;
  const probe = async () => { probes++; return { status: 'connected' as const, account: { ...remote, profileId: 'dd'.repeat(32) } }; };
  const unreadable = createServerFirstStorage(local, () => 'signet', probe, { load() { throw Error('denied'); }, save() {} });
  await unreadable.refresh(); assert.equal(probes, 1);
  await assert.rejects(unreadable.storage.load(), /could not be read/);
  const unwritable = createServerFirstStorage(local, () => 'signet', probe, { load() { return undefined; }, save() { throw Error('quota'); } });
  await unwritable.refresh(); assert.equal(probes, 2);
  assert.equal(unwritable.source().serverStatus, 'error');
  await assert.rejects(unwritable.storage.load(), /could not be saved/);
  const absent = createServerFirstStorage(local, () => 'signet', async () => ({ status: 'absent', message: 'Stopped.' }), { load() { throw Error('denied'); }, save() {} });
  await absent.refresh();
  await absent.storage.select({ profileId: 'explicit-manual', phrase: 'local-only' });
  assert.equal((await absent.storage.load())?.profileId, 'explicit-manual');
});

test('reload provenance rejects a different endpoint or local signer while original work remains unresolved', () => {
  const data = new Map<string, string>(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
  preserveGameWalletSource(remote, storage, () => false);
  const replacement = { ...remote, server: { ...remote.server, endpoint: 'https://another.example/api/bis/' } };
  assert.throws(() => preserveGameWalletSource(replacement, storage, () => true), /original signing source/);
  assert.throws(() => preserveGameWalletSource({ profileId: remote.profileId, network: remote.network, phrase: 'local' }, storage, () => true), /original signing source/);
  preserveGameWalletSource(remote, storage, () => true);
  preserveGameWalletSource(replacement, storage, () => false);
  assert.equal([...data.values()].some(value => value.includes('local')), false);
});

test('stopped and timed-out configured endpoints permit manual fallback; authorization errors do not', async () => {
  const stopped = await probeGameSigner('signet', { endpoint: 'http://127.0.0.1:9/api/bis/', fetcher: async () => { throw Error('refused'); } });
  assert.equal(stopped.status, 'absent');
  const timed = await probeGameSigner('signet', { endpoint: '/api/bis/', timeoutMs: 5, fetcher: async (_url, options) => new Promise((_resolve, reject) => { options!.signal!.addEventListener('abort', () => reject(Error('timeout')), { once: true }); }) });
  assert.equal(timed.status, 'absent');
  assert.equal((await probeGameSigner('signet', { endpoint: '/api/bis/', fetcher: async () => new Response('{}', { status: 403 }) })).status, 'error');
});

test('controller publishes server source before player login and keeps connected server on logout', async () => {
  const { backend, set } = fixture(); set({ status: 'connected', account: remote });
  let player: string | undefined;
  const listeners = new Set<() => void>();
  const wallet = createLocalGameWallet({ playerProfileId: () => player, playerSubscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } }, {
    storage: backend.storage, source: backend.source, probe: backend.refresh,
    restore: async () => { throw Error('Must not import'); }, addresses: async () => ({ arkadeAddress: 'tark1test', bitcoinAddress: 'tb1test' }), balance: async () => ({ availableSats: 1000, totalSats: 1000, bitcoinSats: 0, arkadeSats: 1000, availableArkadeSats: 1000, availableBitcoinSats: 0 }), watch: undefined,
  });
  await wallet.refresh(); assert.equal(wallet.getState().source, 'server');
  player = 'player'; listeners.forEach(listener => listener()); await wallet.refresh();
  assert.equal(wallet.getState().profileId, 'server-wallet');
  assert.equal(await wallet.importWallet('never-send'), false);
  await wallet.logout(); assert.equal(wallet.getState().profileId, 'server-wallet');
  wallet.dispose();
});
