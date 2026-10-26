import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MnemonicIdentity, Transaction, TxTree, CosignerPublicKey, setArkPsbtField } from '@arkade-os/sdk';
import { p2wpkh } from '@scure/btc-signer';
import { schnorr } from '@noble/curves/secp256k1.js';
import { Session, keyAggregate, sortKeys, nonceAggregate } from '@scure/btc-signer/musig2.js';
import { createLocalSigner } from '../src/server/signer.ts';
import { createSignerMiddleware } from '../src/server/vite.ts';
import { loadSignerEnvironment } from '../src/server/environment.ts';
import { encodeSigningValue, decodeSigningValue, fromHex, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { probeGameSigner, remoteSigningIdentity } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';

// Public BIP39 vector. Never funded and never loaded from private environment.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const config = { mnemonic, network: 'signet' as const, gameId: 'stealth-and-steel' };
const testOutput = fileURLToPath(new URL('../../../../output/reports/bis-server/local-tests/', import.meta.url));

async function host(t, options: Parameters<typeof createSignerMiddleware>[0] = config) {
  const adapter = createSignerMiddleware(options);
  const server = createServer((req, res) => void adapter.middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { adapter.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/api/bis/`;
}

test('local pooled reconnection resolves the original slot and refuses a substituted identity', async t => {
  const second = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const identity = createLocalSigner({ ...config, mnemonic: second });
  t.after(() => identity.dispose());
  const original = await identity.info();
  const endpoint = await host(t, { ...config, walletEnvironment: { BIS_GAME_WALLET_SIGNET_01_MNEMONIC: mnemonic, BIS_GAME_WALLET_SIGNET_02_MNEMONIC: second } });
  const initial = await probeGameSigner('signet', { endpoint });
  assert.equal(initial.status, 'connected');
  if (initial.status !== 'connected') throw Error('Fixture connection failed.');
  assert.notEqual(initial.account.profileId, original.profileId);
  const pinned = await probeGameSigner('signet', { endpoint, profileId: original.profileId });
  assert.equal(pinned.status, 'connected');
  if (pinned.status !== 'connected') throw Error('Original fixture connection failed.');
  assert.equal(pinned.account.profileId, original.profileId);
  assert.equal((await probeGameSigner('signet', { endpoint, profileId: 'ff'.repeat(32) })).status, 'error');
  const other = await host(t);
  assert.equal((await probeGameSigner('signet', { endpoint: other, profileId: original.profileId })).status, 'error');
  const excludedLegacy = await fetch(other + 'connect', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({network:'signet',gameId:config.gameId,requirement:{excludedProfiles:[initial.account.profileId]}})});
  assert.equal(excludedLegacy.status,503,'legacy single-wallet selection must not ignore an excluded Player profile');
  const substitute = await probeGameSigner('signet', { endpoint, profileId: original.profileId, fetcher: async (url, options) => {
    const body = JSON.parse(String(options?.body)); delete body.profileId;
    return fetch(url, { ...options, body: JSON.stringify(body) });
  } });
  assert.equal(substitute.status, 'error');
});

test('environment uses explicit values and reports missing config without inventing keys', async () => {
  const missing = loadSignerEnvironment({ env: {}, path: 'output/nonexistent-bis-server-env' });
  assert.equal(missing.mnemonic, undefined); assert.equal(missing.network, 'signet');
  assert.equal(loadSignerEnvironment({ env: { BIS_GAME_WALLET_NETWORK: 'mutinynet' }, path: 'output/nonexistent-bis-server-env' }).network, 'mutinynet');
  assert.throws(() => loadSignerEnvironment({ env: { BIS_GAME_WALLET_NETWORK: 'bitcoin' }, path: 'output/nonexistent-bis-server-env' }), /unsupported/);
  await assert.rejects(createLocalSigner(missing).info(), /not configured/);
  await assert.rejects(createLocalSigner({ ...config, mnemonic: 'invalid mnemonic' }).info(), /not configured/);
});

test('private file configuration honors process precedence and blank overrides', async t => {
  await mkdir(testOutput, { recursive: true });
  const directory = await mkdtemp(join(testOutput, 'environment-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, '.env.local');
  await writeFile(path, `BIS_GAME_WALLET_MNEMONIC=${mnemonic}\nBIS_GAME_WALLET_NETWORK=signet\nBIS_SERVER_ENABLED=false\n`);
  assert.equal(loadSignerEnvironment({ env: {}, path }).mnemonic, mnemonic);
  assert.equal(loadSignerEnvironment({ env: { BIS_GAME_WALLET_NETWORK: 'mutinynet', BIS_GAME_WALLET_MNEMONIC: '' }, path }).mnemonic, '');
  assert.equal(loadSignerEnvironment({ env: { BIS_GAME_WALLET_NETWORK: 'mutinynet' }, path }).network, 'mutinynet');
  assert.equal(loadSignerEnvironment({ env: {}, path }).enabled, false);
});

test('HTTP signer keeps key private and produces real verifiable message signatures', async t => {
  const endpoint = await host(t);
  const probe = await probeGameSigner('signet', { endpoint }); assert.equal(probe.status, 'connected');
  if (probe.status !== 'connected') return;
  assert.equal('phrase' in probe.account, false); assert.equal(JSON.stringify(probe).includes(mnemonic), false);
  const identity = remoteSigningIdentity(probe.account), message = new Uint8Array(32).fill(7);
  const signature = await identity.signMessage(message, 'schnorr');
  assert.equal(schnorr.verify(signature, message, await identity.xOnlyPublicKey()), true);
  assert.deepEqual(await identity.signMessage(message, 'ecdsa'), await MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false }).signMessage(message, 'ecdsa'));
  const readonly = await (await fetch(endpoint + 'identity')).json();
  assert.equal(JSON.stringify(readonly).includes(mnemonic), false); assert.equal('token' in readonly, false);
});

test('remote transaction signing equals local signing and preserves other inputs', async t => {
  const endpoint = await host(t), probe = await probeGameSigner('signet', { endpoint });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  const local = MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false });
  const other = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
  const payment = p2wpkh(await local.compressedPublicKey());
  const otherPayment = p2wpkh(await other.compressedPublicKey());
  const tx = new Transaction();
  tx.addInput({ txid: '11'.repeat(32), index: 0, witnessUtxo: { script: payment.script, amount: 2000n } });
  tx.addInput({ txid: '22'.repeat(32), index: 0, witnessUtxo: { script: otherPayment.script, amount: 2000n } });
  tx.addOutput({ script: payment.script, amount: 3000n });
  await other.sign(tx, [1]);
  const expected = await local.sign(Transaction.fromPSBT(tx.toPSBT()), [0]);
  const signed = await remoteSigningIdentity(probe.account).sign(tx, [0]);
  assert.equal(toHex(signed.toPSBT()), toHex(expected.toPSBT()));
  assert.deepEqual(signed.getInput(1).partialSig, tx.getInput(1).partialSig);
  const conflicting = Transaction.fromPSBT(tx.toPSBT()); conflicting.updateOutput(0, { amount: 2999n });
  await assert.rejects(remoteSigningIdentity(probe.account).sign(conflicting, [0]), /unavailable/);
});

test('exact replay is stable; changed scope, changed replay and unknown sessions fail', async () => {
  const signer = createLocalSigner(config), connection = await signer.connect();
  const request = { id: 'request-1', network: config.network, profileId: connection.profileId, method: 'signMessage', args: encodeSigningValue([new Uint8Array(32), 'schnorr']) };
  const first = await signer.request(connection.token, request);
  assert.deepEqual(await signer.request(connection.token, request), first);
  await assert.rejects(signer.request(connection.token, { ...request, method: 'sign' }), /changed/);
  await assert.rejects(signer.request(connection.token, { ...request, id: 'request-2', network: 'mutinynet' }), /scope/);
  await assert.rejects(signer.request(connection.token, { ...request, id: 'request-3', method: 'session.sign', sessionId: 'missing', args: [] }), /lost/);
  signer.dispose(); await assert.rejects(signer.request(connection.token, request), /expired/);
});

test('stateful sessions retain nonces, reject changed transcript and expire safely', async () => {
  let now = 100;
  const signer = createLocalSigner(config, () => now), connection = await signer.connect();
  let sequence = 0;
  const send = async (method, args, sessionId?) => decodeSigningValue(await signer.request(connection.token, { id: `r-${++sequence}`, network: config.network, profileId: connection.profileId, method, sessionId, args: encodeSigningValue(args) }));
  const id = await send('session.create', []);
  const sessionKey = toHex(await send('session.getPublicKey', [], id));
  assert.match(sessionKey, /^0[23][0-9a-f]{64}$/);
  assert.equal(toHex(await send('session.getPublicKey', [], id)), sessionKey);
  const tx = new Transaction(); tx.addInput({ txid: '33'.repeat(32), index: 0 }); tx.addOutput({ script: fromHex('51'), amount: 1000n });
  await send('session.init', [new TxTree(tx), new Uint8Array(32), 1000n], id);
  const nonces = await send('session.getNonces', [], id);
  assert.deepEqual(await send('session.getNonces', [], id), nonces);
  assert.equal([...nonces.values()].every(value => Object.keys(value).join() === 'pubNonce'), true);
  await assert.rejects(send('session.init', [new TxTree(tx), new Uint8Array(32), 1000n], id), /already set/);
  now += 11 * 60 * 1000;
  await assert.rejects(send('session.sign', [], id), /expired/);
});

test('local middleware rejects public hosts, cross-site sessions and non-JSON signing', async t => {
  const endpoint = await host(t);
  assert.equal((await fetch(endpoint + 'connect', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(endpoint + 'connect', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(endpoint + 'sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
});

for (const settlement of [false, true]) test('complete HTTP MuSig2 tree signatures aggregate into a valid Schnorr signature' + (settlement ? ' with local settlement binding' : ''), async t => {
  const endpoint = await host(t), probe = await probeGameSigner('signet', { endpoint });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  const operation = { id: 'local-settlement-test', settlement: { active: { outpoints: [], registerProof: new Transaction() } } };
  const remote = remoteSigningIdentity(probe.account, settlement ? () => operation : undefined).signerSession();
  const local = MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false }).signerSession();
  const keys = await Promise.all([remote.getPublicKey(), local.getPublicKey()]);
  assert.notEqual(toHex(keys[0]), probe.account.server.publicKey, 'the SDK session key is not the wallet identity');
  // A UI connection refresh must not invalidate the already-created tree session.
  assert.equal((await probeGameSigner('signet', { endpoint })).status, 'connected');
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ script: fromHex('51'), amount: 1500n });
  keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), scriptRoot = new Uint8Array(32), amount = 2000n;
  await Promise.all([remote.init(tree, scriptRoot, amount), local.init(tree, scriptRoot, amount)]);
  const nonceSets = await Promise.all([remote.getNonces(), local.getNonces()]);
  const publicNonces = new Map(keys.map((key, index) => [toHex(key.slice(1)), { pubNonce: nonceSets[index].get(tree.txid)!.pubNonce }]));
  await remote.aggregatedNonces(tree.txid, publicNonces);
  await local.aggregatedNonces(tree.txid, new Map(publicNonces));
  const partials = await Promise.all([remote.sign(), local.sign()]);
  const sorted = sortKeys(keys), untweaked = keyAggregate(sorted).aggPublicKey.toBytes(true);
  const tweak = schnorr.utils.taggedHash('TapTweak', untweaked.slice(1), scriptRoot);
  const finalKey = keyAggregate(sorted, [tweak], [true]).aggPublicKey.toBytes(true);
  const prevoutScript = Uint8Array.from([0x51, 0x20, ...finalKey.slice(1)]);
  const message = tx.preimageWitnessV1(0, [prevoutScript], 0, [amount]);
  const nonces = sorted.map(key => publicNonces.get(toHex(key.slice(1)))!.pubNonce);
  const session = new Session(nonceAggregate(nonces), sorted, message, [tweak], [true]);
  const signatures = sorted.map(key => partials[keys.findIndex(candidate => toHex(candidate) === toHex(key))].get(tree.txid)!.encode());
  signatures.forEach((signature, index) => assert.equal(session.partialSigVerify(signature, nonces, index), true));
  assert.equal(schnorr.verify(session.partialSigAgg(signatures), message, finalKey.slice(1)), true);
  await assert.rejects(remote.sign(), /unavailable/);
});

test('missing local signer retains manual login, reachable invalid configuration is an error', async t => {
  const endpoint = await host(t, { ...config, mnemonic: undefined });
  assert.equal((await probeGameSigner('signet', { endpoint })).status, 'absent');
  const invalid = await host(t, { ...config, mnemonic: 'invalid mnemonic' });
  assert.equal((await probeGameSigner('signet', { endpoint: invalid })).status, 'error');
  const valid = await host(t);
  assert.equal((await probeGameSigner('mutinynet', { endpoint: valid })).status, 'error');
});
