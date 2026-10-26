import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Redis } from '@upstash/redis';
import { schnorr } from '@noble/curves/secp256k1.js';
import { MnemonicIdentity, Transaction, TxTree, CosignerPublicKey, setArkPsbtField } from '@arkade-os/sdk';
import { Session, keyAggregate, nonceAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { createHostedHandler } from '../src/server/hosted.ts';
import { createRedisSigningStore, coordinatedSigning, type SigningClaim } from '../src/server/signing-store.ts';
import { configureBisServer, probeGameSigner, remoteSigningIdentity } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { fromHex, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

// Only datastore configuration is consumed. Real wallet and owner secrets are
// deliberately excluded: all signatures use this unfunded, public BIP39 vector.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) throw Error('Inject signing-store configuration with vercel env run.');
const config = { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token, VERCEL_ENV: 'production' };
const redis = new Redis({ url, token, automaticDeserialization: false, retry: false });
const run = `acceptance-${randomUUID()}`, prefix = 'bis:signer:v1:production';
const keys = new Set<string>(), checks: string[] = [];
const remember = (input: SigningClaim) => {
  const ledger = `${prefix}:${createHash('sha256').update(input.scope).digest('hex')}`;
  keys.add(ledger);
  keys.add(`${prefix}:budgets:${input.scope.split(':').slice(0, 2).join(':')}`);
  return ledger;
};
const store = () => {
  const real = createRedisSigningStore(config);
  return {
    ...real,
    async consumePublicRequest(scope: string, now: number, limits?: { perMinute: number; perDay: number }) {
      keys.add(`${prefix}:publicquota:${createHash('sha256').update(scope).digest('hex')}:${new Date(now).toISOString().slice(0, 10)}`);
      return real.consumePublicRequest(scope, now, limits);
    },
    async claim(input: SigningClaim) { remember(input); return real.claim(input); },
    async session(input: SigningClaim, owner: string, id: string, encrypted?: string) {
      keys.add(`${remember(input)}:session:${id}`);
      return real.session(input, owner, id, encrypted);
    },
  };
};
const base: SigningClaim = { scope: `${run}:signet:wallet-01`, id: randomUUID(), digest: 'a'.repeat(64), inputs: ['fixture:0'], transactionId: 'fixture-transaction', operationId: randomUUID(), exposureSats: 500, dailyCapSats: 10000, operationCapSats: 1000, day: new Date().toISOString().slice(0, 10) };
try {
  await store().ping();
  const quotaScope = `${run}-quota:signet`, quotaTime = Date.UTC(2026, 9, 21, 12), limits = { perMinute: 2, perDay: 3 };
  const quotaRace = await Promise.allSettled(Array.from({ length: 3 }, () => store().consumePublicRequest(quotaScope, quotaTime, limits)));
  assert.equal(quotaRace.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(quotaRace.filter(result => result.status === 'rejected').length, 1);
  await store().consumePublicRequest(quotaScope, quotaTime + 60000, limits);
  await assert.rejects(store().consumePublicRequest(quotaScope, quotaTime + 120000, limits), /limit exceeded/);
  await store().consumePublicRequest(quotaScope.replace('signet', 'mutinynet'), quotaTime, limits);
  await store().consumePublicRequest(`${run}-other-quota:signet`, quotaTime, limits);
  await store().consumePublicRequest(quotaScope, quotaTime + 86400000, limits);
  checks.push('primary-side public request quotas are atomic under concurrency; minute/day bounds and network/game/day isolation hold');
  let signed = 0;
  assert.deepEqual(await coordinatedSigning(store(), base, async () => ({ signature: ++signed })), { signature: 1 });
  assert.deepEqual(await coordinatedSigning(store(), base, async () => ++signed), { signature: 1 });
  assert.equal(signed, 1);
  await assert.rejects(coordinatedSigning(store(), { ...base, digest: 'b'.repeat(64) }, async () => 0), /changed/);
  await assert.rejects(coordinatedSigning(store(), { ...base, id: randomUUID(), transactionId: 'conflicting' }, async () => 0), /conflict/);
  checks.push('primary-side exact replay, changed replay and conflicting input exclusion');

  const capped = { ...base, scope: `${run}-budget:signet:wallet-01`, id: randomUUID(), inputs: [], dailyCapSats: 500 };
  await coordinatedSigning(store(), capped, async () => true);
  await assert.rejects(coordinatedSigning(store(), { ...capped, scope: `${run}-budget:signet:wallet-02`, id: randomUUID() }, async () => true), /budget/);
  assert.equal(await coordinatedSigning(store(), { ...capped, scope: `${run}-budget:mutinynet:wallet-01`, id: randomUUID() }, async () => true), true);
  const operation = { ...base, scope: `${run}-operation:signet:wallet-01`, id: randomUUID(), inputs: [], exposureSats: 600 };
  await coordinatedSigning(store(), operation, async () => true);
  await assert.rejects(coordinatedSigning(store(), { ...operation, scope: `${run}-operation:signet:wallet-02`, id: randomUUID() }, async () => true), /budget/);
  checks.push('daily and operation caps shared across slots; networks isolated');

  const linked = { ...base, scope: `${run}-linked:signet:wallet-01`, id: randomUUID(), inputs: [], exposureSats: 600, exposureId: 'c'.repeat(64), dailyCapSats: 1000 };
  await coordinatedSigning(store(), linked, async () => 'root');
  assert.equal(await coordinatedSigning(store(), { ...linked, id: randomUUID(), digest: 'd'.repeat(64), transactionId: 'checkpoint' }, async () => 'checkpoint'), 'checkpoint');
  let extraSigned = false;
  await assert.rejects(coordinatedSigning(store(), { ...linked, id: randomUUID(), exposureSats: 601 }, async () => { extraSigned = true; }), /changed-exposure/);
  await assert.rejects(coordinatedSigning(store(), { ...linked, id: randomUUID(), exposureId: 'e'.repeat(64) }, async () => { extraSigned = true; }), /budget/);
  await assert.rejects(coordinatedSigning(store(), { ...linked, id: randomUUID(), operationId: randomUUID() }, async () => { extraSigned = true; }), /budget/);
  await assert.rejects(coordinatedSigning(store(), { ...linked, scope: `${run}-linked:signet:wallet-02`, id: randomUUID() }, async () => { extraSigned = true; }), /budget/);
  assert.equal(extraSigned, false);
  checks.push('linked root/checkpoint exposure charged once; changed exposure, other operations and wallet slots cannot reuse it');

  const approved = { ...base, scope: `${run}-approved-cap:signet:wallet-01`, id: randomUUID(), inputs: [], exposureSats: 5000, exposureId: '1'.repeat(64), operationCapSats: 5000, dailyCapSats: 10000 };
  let approvedSignatures = 0;
  await coordinatedSigning(store(), approved, async () => ++approvedSignatures);
  await coordinatedSigning(store(), { ...approved, id: randomUUID(), digest: '2'.repeat(64) }, async () => ++approvedSignatures);
  const secondApproved = { ...approved, scope: `${run}-approved-cap:signet:wallet-02`, id: randomUUID(), operationId: randomUUID(), exposureId: '3'.repeat(64) };
  await coordinatedSigning(store(), secondApproved, async () => ++approvedSignatures);
  await coordinatedSigning(store(), { ...secondApproved, id: randomUUID(), digest: '4'.repeat(64) }, async () => ++approvedSignatures);
  await assert.rejects(coordinatedSigning(store(), { ...approved, id: randomUUID(), operationId: randomUUID(), exposureId: '5'.repeat(64), exposureSats: 1 }, async () => ++approvedSignatures), /budget/);
  await assert.rejects(coordinatedSigning(store(), { ...approved, scope: `${run}-approved-cap:mutinynet:wallet-01`, id: randomUUID(), exposureSats: 5001 }, async () => ++approvedSignatures), /budget/);
  assert.equal(approvedSignatures, 4);
  await coordinatedSigning(store(), { ...approved, scope: `${run}-approved-cap:mutinynet:wallet-01`, id: randomUUID() }, async () => ++approvedSignatures);
  assert.equal(approvedSignatures, 5);
  checks.push('approved 5000-sat operation and 10000-sat network/day limits: linked steps charge once; two operations exhaust daily funds; over-cap calls never sign; other network remains isolated');

  const receipt = { ...base, scope: `${run}-receipt:signet:wallet-01`, id: randomUUID(), inputs: ['marketplace-payment:' + '6'.repeat(64) + ':0'], transactionId: '7'.repeat(64), exposureSats: 0 };
  await coordinatedSigning(store(), receipt, async () => 'receipt-root');
  assert.equal(await coordinatedSigning(store(), { ...receipt, id: randomUUID(), digest: '8'.repeat(64) }, async () => 'receipt-checkpoint'), 'receipt-checkpoint');
  let duplicateReceiptSigned = false;
  await assert.rejects(coordinatedSigning(store(), { ...receipt, id: randomUUID(), operationId: randomUUID(), transactionId: '9'.repeat(64) }, async () => { duplicateReceiptSigned = true; }), /conflict/);
  assert.equal(duplicateReceiptSigned, false);
  checks.push('marketplace payment receipt reservation permits linked signing but rejects a different fulfillment before signing');

  const reservationId = 'ba'.repeat(32), batchDigest = 'ca'.repeat(32);
  const settlement = { ...base, scope: `${run}-batch:signet:wallet-01`, id: randomUUID(), inputs: ['fixture-batch:0'],
    transactionId: reservationId, exposureId: reservationId, exposureSats: 5000, operationCapSats: 5000 };
  let batchSignatures = 0;
  await coordinatedSigning(store(), settlement, async () => ++batchSignatures); // Original ownership proof.
  const initialized = { ...settlement, id: randomUUID(), digest: 'da'.repeat(32), settlementBatch: { reservationId, digest: batchDigest } };
  assert.equal(await coordinatedSigning(store(), initialized, async () => ++batchSignatures), 2);
  assert.equal(await coordinatedSigning(store(), initialized, async () => ++batchSignatures), 2);
  await coordinatedSigning(store(), { ...initialized, id: randomUUID(), digest: 'ea'.repeat(32) }, async () => ++batchSignatures);
  await assert.rejects(coordinatedSigning(store(), { ...initialized, id: randomUUID(), settlementBatch: { reservationId, digest: 'fa'.repeat(32) } }, async () => ++batchSignatures), /batch-conflict/);
  await assert.rejects(coordinatedSigning(store(), { ...initialized, settlementBatch: { reservationId, digest: 'fa'.repeat(32) } }, async () => ++batchSignatures), /changed-batch/);
  await assert.rejects(coordinatedSigning(store(), { ...initialized, settlementBatch: undefined }, async () => ++batchSignatures), /changed-batch/);
  assert.equal(batchSignatures, 3);
  assert.equal(await redis.hget(remember(initialized), `batch:${reservationId}`), batchDigest);
  await coordinatedSigning(store(), { ...initialized, scope: `${run}-batch:mutinynet:wallet-01` }, async () => ++batchSignatures);
  assert.equal(batchSignatures, 4);
  const crashBatch = { ...initialized, scope: `${run}-batch-crash:signet:wallet-01`, id: randomUUID() };
  await assert.rejects(coordinatedSigning(store(), crashBatch, async () => { throw Error('fixture batch crash'); }), /batch crash/);
  assert.equal(await redis.hget(remember(crashBatch), `batch:${reservationId}`), batchDigest);
  await assert.rejects(coordinatedSigning(store(), { ...crashBatch, id: randomUUID(), settlementBatch: { reservationId, digest: 'fa'.repeat(32) } }, async () => ++batchSignatures), /busy/);
  const refusedBatch = { ...initialized, scope: `${run}-batch-budget:signet:wallet-01`, id: randomUUID(), operationCapSats: 0 };
  await assert.rejects(coordinatedSigning(store(), refusedBatch, async () => ++batchSignatures), /budget/);
  assert.equal(await redis.hget(remember(refusedBatch), `batch:${reservationId}`), null);
  await coordinatedSigning(store(), { ...refusedBatch, exposureSats: 0, settlementBatch: { reservationId, digest: 'fa'.repeat(32) } }, async () => ++batchSignatures);
  assert.equal(batchSignatures, 5);
  const completionBatch = { ...initialized, scope: `${run}-batch-completion:signet:wallet-01`, id: randomUUID(), exposureSats: 0 };
  const completionStore = store(), acquired = await completionStore.claim(completionBatch);
  assert.equal(acquired.status, 'acquired');
  if (acquired.status !== 'acquired') throw Error('Fixture batch claim unavailable.');
  await assert.rejects(completionStore.complete({ ...completionBatch, settlementBatch: { reservationId, digest: 'fa'.repeat(32) } }, acquired.owner, 'wrong'), /could not be committed/);
  assert.equal(await redis.hexists(remember(completionBatch), 'lock'), 1);
  await completionStore.complete(completionBatch, acquired.owner, 'correct');
  assert.equal(await coordinatedSigning(store(), completionBatch, async () => 'wrong'), 'correct');
  checks.push('primary-side settlement batch binding: original proofs and linked sessions charge once; changed batch/replay metadata never signs; crash retains binding; budget refusal does not pin; completion cannot change binding; networks remain isolated');

  const assetId = 'ab'.repeat(34), playerPublicKey = '02' + 'cd'.repeat(32), otherPlayer = '03' + 'ef'.repeat(32);
  const issuance = { ...base, scope: `${run}-assets:signet:wallet-01`, id: randomUUID(), inputs: [], exposureSats: 0, issuedAssets: [{ assetId, playerPublicKey }] };
  assert.equal(await store().assetAllowed(issuance.scope, assetId, playerPublicKey), false);
  await coordinatedSigning(store(), issuance, async () => 'fixture-issuance-signature');
  assert.equal(await store().assetAllowed(issuance.scope, assetId, playerPublicKey), true);
  assert.equal(await store().assetAllowed(issuance.scope, assetId, otherPlayer), false);
  assert.equal(await store().assetAllowed(issuance.scope.replace('signet', 'mutinynet'), assetId, playerPublicKey), false);
  assert.equal(await store().assetAllowed(issuance.scope.replace('wallet-01', 'wallet-02'), assetId, playerPublicKey), false);
  let redirected = false;
  await assert.rejects(coordinatedSigning(store(), { ...issuance, id: randomUUID(), issuedAssets: [{ assetId, playerPublicKey: otherPlayer }] }, async () => { redirected = true; }), /asset-conflict/);
  assert.equal(redirected, false);
  const uncertain = { ...issuance, scope: `${run}-asset-crash:signet:wallet-01`, id: randomUUID() };
  await assert.rejects(coordinatedSigning(store(), uncertain, async () => { throw Error('fixture signing crash'); }), /signing crash/);
  assert.equal(await store().assetAllowed(uncertain.scope, assetId, playerPublicKey), false);
  checks.push('issued asset authorization commits with signing result; unknown, other-player/network/profile and uncertain issuance cannot authorize delivery');

  const concurrent = { ...base, scope: `${run}-concurrent:signet:wallet-01`, id: randomUUID(), inputs: [] };
  let release!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const first = coordinatedSigning(store(), concurrent, async () => { started(); await new Promise<void>(resolve => { release = resolve; }); return 'original'; });
  await ready;
  try { await assert.rejects(coordinatedSigning(store(), { ...concurrent, id: randomUUID() }, async () => 'other'), /busy/); }
  finally { release(); }
  assert.equal(await first, 'original');
  const crashed = { ...concurrent, scope: `${run}-crash:signet:wallet-01`, id: randomUUID() };
  await assert.rejects(coordinatedSigning(store(), crashed, async () => { throw Error('simulated crash'); }), /simulated crash/);
  await assert.rejects(coordinatedSigning(store(), crashed, async () => true), /unresolved/);
  await assert.rejects(coordinatedSigning(store(), { ...crashed, id: randomUUID() }, async () => true), /busy/);
  checks.push('separate clients exclude concurrent signing and retain unresolved crash claims');

  const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const owner = randomUUID() + randomUUID();
  const env = { BIS_GAME_ID: run, BIS_OWNER_TOKEN: owner, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrase, BIS_SIGNING_DAILY_CAP_SATS: '10000', BIS_SIGNING_OPERATION_CAP_SATS: '1000' };
  const fetcher: typeof fetch = async (url, init) => createHostedHandler({ env, store: store() })(new Request(String(url), init));
  configureBisServer({ ownerToken: owner });
  const probe = await probeGameSigner('signet', { gameId: run, endpoint: 'https://fixture.test/api/bis/', fetcher, timeoutMs: 10000 });
  assert.equal(probe.status, 'connected');
  if (probe.status !== 'connected') throw Error('Fixture connection failed.');
  const remote = remoteSigningIdentity(probe.account).signerSession();
  const local = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }).signerSession();
  const publicKeys = await Promise.all([remote.getPublicKey(), local.getPublicKey()]);
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ script: fromHex('51'), amount: 500n });
  publicKeys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), root = new Uint8Array(32), amount = 1000n;
  await Promise.all([remote.init(tree, root, amount), local.init(tree, root, amount)]);
  const nonceSets = await Promise.all([remote.getNonces(), local.getNonces()]);
  assert.deepEqual(await remote.getNonces(), nonceSets[0]);
  const nonces = new Map(publicKeys.map((key, index) => [toHex(key.slice(1)), { pubNonce: nonceSets[index].get(tree.txid)!.pubNonce }]));
  await remote.aggregatedNonces(tree.txid, new Map(nonces));
  await local.aggregatedNonces(tree.txid, new Map(nonces));
  const partials = await Promise.all([remote.sign(), local.sign()]);
  const sorted = sortKeys(publicKeys), untweaked = keyAggregate(sorted).aggPublicKey.toBytes(true);
  const tweak = schnorr.utils.taggedHash('TapTweak', untweaked.slice(1), root);
  const finalKey = keyAggregate(sorted, [tweak], [true]).aggPublicKey.toBytes(true);
  const message = tx.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey.slice(1)])], 0, [amount]);
  const session = new Session(nonceAggregate(sorted.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), sorted, message, [tweak], [true]);
  const signatures = sorted.map(key => partials[publicKeys.findIndex(candidate => toHex(candidate) === toHex(key))].get(tree.txid)!.encode());
  assert.equal(schnorr.verify(session.partialSigAgg(signatures), message, finalKey.slice(1)), true);
  await assert.rejects(remote.sign());
  checks.push('real MuSig aggregate verifies with fresh handlers and Redis clients on every exchange');

  for (const failure of ['missing', 'corrupt', 'wrong-operation', 'expired', 'write-lost'] as const) {
    const gameId = `${run}-${failure}`, safetyEnv = { ...env, BIS_GAME_ID: gameId };
    let time = Date.now(), damaged = false;
    const send = async (path: string, body: unknown, headers = {}) => {
      const backing = store(), persist = backing.session.bind(backing);
      backing.session = async (...args) => {
        if (damaged && failure === 'write-lost' && args[3] !== undefined) throw Error('simulated persistence failure');
        return persist(...args);
      };
      return createHostedHandler({ env: safetyEnv, store: backing, now: () => time })(new Request('https://fixture.test/api/bis/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    };
    const connectedResponse = await send('connect', { network: 'signet', gameId }, { Authorization: `Bearer ${owner}` });
    assert.equal(connectedResponse.status, 200);
    const connected = await connectedResponse.json();
    const perform = async (method: string, sessionId?: string, operationId = 'operation-1') => {
      const body = { id: randomUUID(), network: 'signet', profileId: connected.profileId, operationId, method, args: [], sessionId };
      const response = await send('authorize', { request: body, operationId }, { Authorization: `Bearer ${owner}` });
      assert.equal(response.status, 200);
      const grant = await response.json();
      return send('sign', body, { Authorization: `Bearer ${connected.token}`, 'X-BIS-Signing-Grant': grant.grant });
    };
    const created = await perform('session.create'); assert.equal(created.status, 200);
    const sessionId = (await created.json()).result;
    const scope = `${gameId}:signet:${connected.profileId}`;
    const ledger = `${prefix}:${createHash('sha256').update(scope).digest('hex')}`;
    const sessionKey = `${ledger}:session:${sessionId}`;
    assert.equal(keys.has(sessionKey), true);
    if (failure === 'missing') await redis.del(sessionKey);
    if (failure === 'corrupt') await redis.set(sessionKey, 'intentionally-invalid-fixture-ciphertext', { px: 600000 });
    if (failure === 'expired') time += 600000;
    damaged = true;
    const refused = await perform('session.getPublicKey', sessionId, failure === 'wrong-operation' ? 'operation-2' : 'operation-1');
    assert.notEqual(refused.status, 200);
    if (failure !== 'expired') {
      damaged = false;
      assert.notEqual((await perform('session.getPublicKey', sessionId)).status, 200);
      assert.equal(await redis.hexists(ledger, 'lock'), 1);
    }
  }
  checks.push('missing, corrupt, wrongly bound, expired and failed-persistence sessions refuse signing; acquired unresolved locks remain');
} catch {
  // Never serialize provider errors or request objects: they may carry credentials.
  console.error('Live Redis acceptance failed; no credential or provider error was logged.');
  process.exitCode = 1;
} finally {
  configureBisServer({});
  // Exact keys only, derived exclusively from this random, unfunded test scope.
  // No SCAN, wildcard deletion, real wallet claims or production budgets touched.
  try { for (const key of keys) await redis.del(key); }
  catch { console.error('Test-key cleanup failed. Signing acceptance is not complete.'); process.exitCode = 1; }
  const directory = new URL('../../../../output/reports/bis-server/milestone-1/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const report = { verifiedAt: new Date().toISOString(), passed: !process.exitCode, checks, cleanupKeys: keys.size, scope: 'Real hosted Redis Lua and encrypted sessions, local fresh HTTP handlers, unfunded public fixture. Not proof of a funded workflow or Vercel-instance execution.' };
  await writeFile(new URL('redis-verification.json', directory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
