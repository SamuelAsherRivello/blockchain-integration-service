import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';
import { MnemonicIdentity, Transaction, TxTree, CosignerPublicKey, SingleKey, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, Extension, EmulatorPacket, PrevArkTxField, setArkPsbtField, type ArkInfo, type VirtualCoin } from '@arkade-os/sdk';
import { Session, keyAggregate, nonceAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { RawWitness } from '@scure/btc-signer';
import { base64, hex } from '@scure/base';
import { createHostedHandler } from '../src/server/hosted.ts';
import { createWalletPool } from '../src/server/wallet-pool.ts';
import { createSigningAuthorization, signingDigest } from '../src/server/signing-authorization.ts';
import { coordinatedSigning, type SigningStore, type SigningClaim, type TreasureCheckpointClaim } from '../src/server/signing-store.ts';
import { encodeSigningValue, fromHex, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { configureBisServer, probeGameSigner, remoteSigningIdentity } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { createAppWalletSession } from '../../integration/src/client/wallet-layer-arkade/app-wallet-session.ts';
import { p2wpkh } from '@scure/btc-signer';
import { playerProofMessage } from '../../integration/src/client/wallet-layer-arkade/player-proof-protocol.ts';
import { buildAuthorizedTreasureScript, treasureAuthorizationDigest } from '../../integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import { TREASURE_EMULATOR } from '../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import type { AuthenticatedTreasureActorScope } from '../src/server/treasure-actor-authorization.ts';

// Deterministic store model checks the coordinator contract, not Redis Lua.
function memoryStore(): SigningStore {
  const rows = new Map<string, { digest: string; owner: string; result?: unknown; done: boolean; batch?: SigningClaim['settlementBatch'] }>();
  const locks = new Set<string>(), inputs = new Map<string, string>(), budgets = new Map<string, number>();
  const sessions = new Map<string, string>();
  const operations = new Map<string, number>();
  const batches = new Map<string, string>(), exposures = new Map<string, number>(),checkpointFamilies=new Map<string,string>();
  const sameBatch = (a: SigningClaim['settlementBatch'], b: SigningClaim['settlementBatch']) => a?.reservationId === b?.reservationId && a?.digest === b?.digest;
  return {
    async readCompleted(input) {
      const row=rows.get(`${input.scope}:${input.id}`);
      if(!row)return {status:'missing'};
      if(row.digest!==input.digest)throw Error('changed');
      return row.done?{status:'completed',result:row.result}:{status:'unresolved'};
    },
    async assetAllowed() { return false; },
    async consumePublicRequest() {},
    async ping() {},
    async claim(input) {
      const key = `${input.scope}:${input.id}`, prior = rows.get(key);
      if (prior) {
        if (prior.digest !== input.digest) throw Error('changed');
        if (!sameBatch(prior.batch, input.settlementBatch)) throw Error('changed-batch');
        if (!prior.done) throw Error('unresolved');
        return { status: 'replay', result: prior.result };
      }
      if (locks.has(input.scope)) throw Error('busy');
      if (input.inputs.some(outpoint => inputs.has(input.scope + ':' + outpoint) && inputs.get(input.scope + ':' + outpoint) !== input.transactionId)) throw Error('conflict');
      const batchKey = input.settlementBatch && input.scope + ':' + input.settlementBatch.reservationId;
      if (batchKey && batches.has(batchKey) && batches.get(batchKey) !== input.settlementBatch!.digest) throw Error('batch-conflict');
      const exposureKey = input.exposureId && JSON.stringify([input.scope, input.operationId, input.exposureId]);
      if (exposureKey && exposures.has(exposureKey) && exposures.get(exposureKey) !== input.exposureSats) throw Error('changed-exposure');
      const cost = exposureKey && exposures.has(exposureKey) ? 0 : input.exposureSats;
      const budgetKey = input.scope.split(':').slice(0, 2).join(':') + input.day;
      const total = (budgets.get(budgetKey) ?? 0) + cost;
      const operationKey = input.scope.split(':').slice(0, 2).join(':') + input.operationId;
      const operation = (operations.get(operationKey) ?? 0) + cost;
      if (total > input.dailyCapSats || operation > input.operationCapSats) throw Error('budget');
      operations.set(operationKey, operation);
      if (exposureKey) exposures.set(exposureKey, input.exposureSats);
      if (batchKey) batches.set(batchKey, input.settlementBatch!.digest);
      budgets.set(budgetKey, total); locks.add(input.scope);
      for (const outpoint of input.inputs) inputs.set(input.scope + ':' + outpoint, input.transactionId);
      rows.set(key, { digest: input.digest, owner: key, done: false, batch: input.settlementBatch && { ...input.settlementBatch } });
      return { status: 'acquired', owner: key };
    },
    async claimTreasureCheckpoint(input:TreasureCheckpointClaim){
      const parentRow=rows.get(`${input.parent.scope}:${input.parent.id}`);
      if(!parentRow||parentRow.digest!==input.parent.digest||!parentRow.done||JSON.stringify(parentRow.result)!==JSON.stringify(input.parentResult))throw Error('parent-mismatch');
      if(input.parent.inputs.some(outpoint=>inputs.get(input.parent.scope+':'+outpoint)!==input.parent.transactionId))throw Error('parent-reservation');
      const exposureKey=JSON.stringify([input.parent.scope,input.parent.operationId,input.parent.exposureId]);
      if(exposures.get(exposureKey)!==input.parent.exposureSats)throw Error('parent-exposure');
      const familyKey=`${input.parent.scope}:treasure-checkpoint:${input.parent.transactionId}:${input.checkpointOutpoint.txid}:${input.checkpointOutpoint.index}`;
      const familyRecord=JSON.stringify({id:input.checkpoint.id,digest:input.checkpoint.digest,family:input.checkpointFamilyDigest});
      const family=checkpointFamilies.get(familyKey),childKey=`${input.checkpoint.scope}:${input.checkpoint.id}`,prior=rows.get(childKey);
      if(family&&family!==familyRecord)throw Error('checkpoint-family');
      if(Boolean(family)!==Boolean(prior))throw Error('checkpoint-family');
      if(prior){if(prior.digest!==input.checkpoint.digest)throw Error('changed');if(prior.done)return {status:'replay',result:prior.result};throw Error('unresolved');}
      if(locks.has(input.checkpoint.scope))throw Error('busy');
      if(input.checkpoint.inputs.some(outpoint=>inputs.has(input.checkpoint.scope+':'+outpoint)&&inputs.get(input.checkpoint.scope+':'+outpoint)!==input.checkpoint.transactionId))throw Error('conflict');
      checkpointFamilies.set(familyKey,familyRecord);locks.add(input.checkpoint.scope);
      for(const outpoint of input.checkpoint.inputs)inputs.set(input.checkpoint.scope+':'+outpoint,input.checkpoint.transactionId);
      rows.set(childKey,{digest:input.checkpoint.digest,owner:childKey,done:false});return {status:'acquired',owner:childKey};
    },
    async complete(input, owner, result) {
      const row = rows.get(`${input.scope}:${input.id}`);
      if (!row || row.owner !== owner || !sameBatch(row.batch, input.settlementBatch)) throw Error('owner');
      row.result = result; row.done = true; locks.delete(input.scope);
    },
    async session(input, owner, id, encrypted) {
      const row = rows.get(`${input.scope}:${input.id}`);
      if (!row || row.owner !== owner || !locks.has(input.scope)) throw Error('owner');
      const key = `${input.scope}:${id}`;
      if (encrypted !== undefined) sessions.set(key, encrypted);
      return sessions.get(key) ?? null;
    },
  };
}
const claim: SigningClaim = { scope: 'test:signet:profile', id: 'request-1', operationId: 'op-1', digest: 'a'.repeat(64), inputs: ['outpoint'], transactionId: 'tx-1', exposureSats: 1000, operationCapSats: 1000, dailyCapSats: 10000, day: '2026-10-21' };

test('one original reservation permits linked sessions for its exact batch, never a replacement batch', async () => {
  const store = memoryStore(), reservationId = 'b'.repeat(64);
  const base = { ...claim, transactionId: reservationId, exposureId: reservationId,
    settlementBatch: { reservationId, digest: 'c'.repeat(64) }, exposureSats: 5000, operationCapSats: 5000 };
  let signatures = 0;
  assert.equal(await coordinatedSigning(store, base, async () => ++signatures), 1);
  assert.equal(await coordinatedSigning(store, { ...base, id: 'linked', digest: 'd'.repeat(64) }, async () => ++signatures), 2);
  assert.equal(await coordinatedSigning(store, base, async () => ++signatures), 1);
  await assert.rejects(coordinatedSigning(store, { ...base, id: 'changed-batch', settlementBatch: { reservationId, digest: 'e'.repeat(64) } }, async () => ++signatures), /batch-conflict/);
  await assert.rejects(coordinatedSigning(store, { ...base, settlementBatch: { reservationId, digest: 'e'.repeat(64) } }, async () => ++signatures), /changed-batch/);
  await assert.rejects(coordinatedSigning(store, { ...base, settlementBatch: undefined }, async () => ++signatures), /changed-batch/);
  assert.equal(signatures, 2);
  await coordinatedSigning(store, { ...base, scope: 'test:mutinynet:profile' }, async () => ++signatures);
  assert.equal(signatures, 3);
});

test('malformed or reassigned batch metadata is rejected before store or signing work', async () => {
  const store = memoryStore(), reservationId = 'b'.repeat(64);
  let touched = false;
  const claimStore = store.claim.bind(store); store.claim = async input => { touched = true; return claimStore(input); };
  for (const settlementBatch of [null, {}, [], { reservationId, digest: 'bad' }, { reservationId: 'e'.repeat(64), digest: 'c'.repeat(64) }]) {
    await assert.rejects(coordinatedSigning(store, { ...claim, transactionId: reservationId, exposureId: reservationId, settlementBatch } as SigningClaim, async () => { touched = true; }), /batch binding/);
  }
  assert.equal(touched, false);
});

test('two 5000-sat operations exhaust the shared 10000-sat daily budget before further signing', async () => {
  const store = memoryStore();
  let signed = 0;
  const bounded = { ...claim, exposureSats: 5000, operationCapSats: 5000, inputs: [] };
  await coordinatedSigning(store, bounded, async () => ++signed);
  await coordinatedSigning(store, { ...bounded, scope: 'test:signet:other-profile', id: 'second', operationId: 'op-2' }, async () => ++signed);
  await assert.rejects(coordinatedSigning(store, { ...bounded, id: 'third', operationId: 'op-3', exposureSats: 1 }, async () => ++signed), /budget/);
  assert.equal(signed, 2);
  await coordinatedSigning(store, { ...bounded, scope: 'test:mutinynet:profile' }, async () => ++signed);
  assert.equal(signed, 3);
});
test('shared coordinator returns exact committed results and refuses changed replay and conflicting spends', async () => {
  const store = memoryStore(); let calls = 0;
  assert.deepEqual(await coordinatedSigning(store, claim, async () => ({ signature: ++calls })), { signature: 1 });
  assert.deepEqual(await coordinatedSigning(store, claim, async () => ++calls), { signature: 1 });
  assert.equal(calls, 1);
  await assert.rejects(coordinatedSigning(store, { ...claim, digest: 'b'.repeat(64) }, async () => 0), /changed/);
  await assert.rejects(coordinatedSigning(store, { ...claim, id: 'request-2', transactionId: 'tx-2' }, async () => 0), /conflict/);
});
test('crash or lost persistence permanently refuses a new conflicting signature, not an expired lease', async () => {
  const store = memoryStore();
  await assert.rejects(coordinatedSigning(store, claim, async () => { throw Error('response lost'); }), /response lost/);
  await assert.rejects(coordinatedSigning(store, claim, async () => 0), /unresolved/);
  await assert.rejects(coordinatedSigning(store, { ...claim, id: 'other' }, async () => 0), /busy/);
});

test('receipt reservations permit linked root/checkpoint claims but refuse a different fulfillment',async()=>{
  const store=memoryStore(),receiptKey='marketplace-payment:'+'bb'.repeat(32)+':0';let signed=0;
  const first={...claim,inputs:[receiptKey],transactionId:'cc'.repeat(32),exposureSats:0,operationCapSats:0,dailyCapSats:0};
  await coordinatedSigning(store,first,async()=>++signed);
  await coordinatedSigning(store,{...first,id:'checkpoint'},async()=>++signed);
  await assert.rejects(coordinatedSigning(store,{...first,id:'another-fulfillment',operationId:'another-operation',transactionId:'dd'.repeat(32)},async()=>++signed),/conflict/);
  assert.equal(signed,2);
});
test('two instances cannot sign concurrently and the successful result survives a lost client response', async () => {
  const store = memoryStore();
  let finish: (value: unknown) => void = () => {};
  let started: () => void = () => {};
  const signingStarted = new Promise<void>(resolve => { started = resolve; });
  const first = coordinatedSigning(store, claim, async () => { started(); return new Promise(resolve => { finish = resolve; }); });
  await signingStarted;
  await assert.rejects(coordinatedSigning(store, { ...claim, id: 'other-instance' }, async () => 'second-signature'), /busy/);
  finish('first-signature');
  assert.equal(await first, 'first-signature');
  assert.equal(await coordinatedSigning(store, claim, async () => 'must-not-sign-again'), 'first-signature');
});
test('daily cap is shared across wallet slots on a network and checked before signing', async () => {
  const store = memoryStore();
  await coordinatedSigning(store, { ...claim, dailyCapSats: 1000 }, async () => 1);
  await assert.rejects(coordinatedSigning(store, { ...claim, scope: 'test:signet:other-profile', id: 'request-2', inputs: [], dailyCapSats: 1000 }, async () => 2), /budget/);
  assert.equal(await coordinatedSigning(store, { ...claim, scope: 'test:mutinynet:profile', inputs: [], dailyCapSats: 1000 }, async () => 3), 3);
});
test('private grants bind request digest, operation, game, network and wallet and expire', () => {
  let now = 1000;
  const auth = createSigningAuthorization('test-owner-secret-'.repeat(3), () => now);
  const scope = { gameId: 'game', network: 'signet' as const, profileId: 'a'.repeat(64), operationId: 'operation-1', digest: signingDigest({ tx: 'exact' }) };
  assert.throws(() => auth.issue(null, scope), /authorization/);
  const token = auth.issue('Bearer ' + 'test-owner-secret-'.repeat(3), scope);
  assert.equal(auth.verify(token, scope).purpose, 'owner-signing');
  for (const key of ['gameId', 'network', 'profileId', 'operationId', 'digest']) assert.throws(() => auth.verify(token, { ...scope, [key]: 'changed' }), /scope/);
  assert.throws(() => auth.verify(token + 'x', scope), /invalid/);
  now += 60000; assert.throws(() => auth.verify(token, scope), /expired/);
});
test('connection credentials survive instances but cannot change scope, become grants or outlive rotation', () => {
  let time = 1000;
  const secret = 'test-connection-secret-'.repeat(3), scope = { gameId: 'game', network: 'signet' as const, profileId: 'a'.repeat(64) };
  const first = createSigningAuthorization(secret, () => time), cold = createSigningAuthorization(secret, () => time);
  const token = first.connect(scope);
  assert.equal(cold.connection(token, scope).purpose, 'connection');
  for (const key of ['gameId', 'network', 'profileId']) assert.throws(() => cold.connection(token, { ...scope, [key]: 'changed' }), /authorization/);
  assert.throws(() => cold.verify(token, { ...scope, operationId: 'operation-1', digest: 'b'.repeat(64) }), /invalid/);
  assert.throws(() => createSigningAuthorization(secret + 'rotated').connection(token, scope), /authorization/);
  time += 600000; assert.throws(() => cold.connection(token, scope), /authorization/);
});
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const values = { BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrase, BIS_GAME_WALLET_MUTINYNET_02_MNEMONIC: phrase, BIS_OWNER_SIGNING_NETWORKS: 'signet,mutinynet' };
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request('https://example.test/api/bis/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
test('hosted identity/proof never return secrets or claim public signing readiness', async () => {
  const handler = createHostedHandler({ env: values, store: memoryStore() });
  const health = await (await handler(new Request('https://example.test/api/bis/health'))).json();
  assert.equal(health.publicSigning, false); assert.equal(health.storage, 'ready');
  assert.deepEqual(health.networks, { signet: 1, mutinynet: 1 });
  const identity = await (await handler(new Request('https://example.test/api/bis/identity?network=mutinynet'))).json();
  assert.equal(identity.slot, '02'); assert.deepEqual(identity.capabilities, []);
  const proofHandler = createHostedHandler({ env: { ...values, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' }, store: memoryStore() });
  const proof = await (await proofHandler(post('proof', { network: 'signet', message: 'must-be-ignored' }))).json();
  assert.equal(schnorr.verify(Buffer.from(proof.signature, 'hex'), Buffer.from(proof.message, 'hex'), Buffer.from(proof.publicKey.slice(2), 'hex')), true);
  assert.equal(JSON.stringify([health, identity, proof]).includes(phrase), false);
  assert.equal((await handler(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }))).status, 403);
  assert.equal((await handler(post('proof', { network: 'bitcoin' }))).status, 503);
  assert.equal((await handler(post('proof', { network: 'signet' }, { Origin: 'https://evil.test' }))).status, 403);
});
test('public signing is explicitly network-scoped and fails closed for an unlisted test network', async () => {
  const env = { ...values, BIS_OWNER_TOKEN: 'scoped-public-owner-secret-'.repeat(3), BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' };
  const handler = createHostedHandler({ env, store: memoryStore() });
  const signetIdentity = await (await handler(new Request('https://example.test/api/bis/identity?network=signet'))).json();
  const mutinynetIdentity = await (await handler(new Request('https://example.test/api/bis/identity?network=mutinynet'))).json();
  assert.equal(signetIdentity.signingReady, true);
  assert.deepEqual(signetIdentity.capabilities, ['sign', 'signMessage', 'signerSession']);
  assert.equal(mutinynetIdentity.signingReady, false);
  assert.deepEqual(mutinynetIdentity.capabilities, []);
  assert.equal((await handler(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }))).status, 200);
  assert.equal((await handler(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }))).status, 403);
  assert.equal((await handler(post('proof', { network: 'mutinynet' }))).status, 403);
  for (const configured of [undefined, '', 'signet,invalid', 'SIGNET']) {
    const denied = createHostedHandler({ env: { ...env, BIS_PUBLIC_SIGNING_NETWORKS: configured }, store: memoryStore() });
    assert.equal((await denied(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }))).status, 403);
  }
});
test('owner signing defaults to the deployment network allowlist and can be explicitly widened without widening public signing', async () => {
  const owner = 'owner-network-policy-secret-'.repeat(3);
  const { BIS_OWNER_SIGNING_NETWORKS: _testOverride, ...defaults } = values;
  const env = { ...defaults, BIS_OWNER_TOKEN: owner, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' };
  const handler = createHostedHandler({ env, store: memoryStore() });
  assert.equal((await handler(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${owner}` }))).status, 200);
  assert.equal((await handler(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('authorize', { request: { network: 'mutinynet' } }, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('owner/plan', { request: { network: 'mutinynet' } }, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('owner/settlement/plan', { request: { network: 'mutinynet' } }, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('sign', { network: 'mutinynet', ownerPlan: 'not-a-grant' }, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('owner/treasure/actor/plan', {}, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('owner/treasure/checkpoint/complete', {}, { Authorization: `Bearer ${owner}` }))).status, 403);
  assert.equal((await handler(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }))).status, 403);
  const profileId = 'a'.repeat(64), connectionToken = createSigningAuthorization(owner).connect({ gameId: 'stealth-and-steel', network: 'mutinynet', profileId });
  const ownerReplay = { id: 'mutinynet-owner-replay', operationId: 'mutinynet-owner-replay', network: 'mutinynet', profileId, method: 'sign', args: encodeSigningValue([new Uint8Array(32)]), connectionToken, ownerPlan: 'owner-plan' };
  const replayDigest = signingDigest(ownerReplay);
  assert.equal((await handler(post('treasure/recover', { version: 1, requestId: ownerReplay.id, requestDigest: replayDigest, requestJson: JSON.stringify(ownerReplay), connectionToken }, { Authorization: `Bearer ${owner}` }))).status, 403);
  const { ownerPlan: _ownerPlan, ...publicReplayBase } = ownerReplay;
  const publicReplay = { ...publicReplayBase, id: 'mutinynet-public-replay', operationId: 'mutinynet-public-replay', paymentPlan: 'public-plan' };
  const publicDigest = signingDigest(publicReplay);
  assert.equal((await handler(post('treasure/recover', { version: 1, requestId: publicReplay.id, requestDigest: publicDigest, requestJson: JSON.stringify(publicReplay), connectionToken, playerToken: 'player-token' }, { Authorization: `Bearer ${connectionToken}` }))).status, 403);

  const optedIn = createHostedHandler({ env: { ...env, BIS_OWNER_SIGNING_NETWORKS: 'signet,mutinynet' }, store: memoryStore() });
  assert.equal((await optedIn(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${owner}` }))).status, 200);
  assert.equal((await optedIn(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }))).status, 403);
  for (const configured of ['', 'signet,invalid', 'SIGNET']) {
    const denied = createHostedHandler({ env: { ...env, BIS_OWNER_SIGNING_NETWORKS: configured }, store: memoryStore() });
    assert.equal((await denied(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${owner}` }))).status, 403);
  }
});
test('Mutinynet identity and connect stay unavailable when no Mutinynet signer is configured', async () => {
  const owner = 'missing-mutinynet-owner-secret-'.repeat(3);
  const handler = createHostedHandler({ env: {
    BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrase,
    BIS_OWNER_TOKEN: owner,
    BIS_OWNER_SIGNING_NETWORKS: 'signet,mutinynet',
    BIS_PUBLIC_PAYMENT_SIGNING: 'true',
    BIS_PUBLIC_SIGNING_NETWORKS: 'signet',
  }, store: memoryStore() });
  const signet = await handler(new Request('https://example.test/api/bis/identity?network=signet'));
  const signetIdentity = await signet.json();
  assert.equal(signet.status, 200);
  assert.equal(signetIdentity.signingReady, true);
  const mutinynet = await handler(new Request('https://example.test/api/bis/identity?network=mutinynet'));
  assert.equal(mutinynet.status, 503);
  const identityFailure = await mutinynet.json();
  assert.equal('publicKey' in identityFailure, false);
  const connect = await handler(post('connect', { network: 'mutinynet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${owner}` }));
  assert.equal(connect.status, 503);
  assert.equal(JSON.stringify([identityFailure, await connect.json()]).includes(phrase), false);
});
test('owner signing and exact response replay work across cold instances with scoped connection tokens', async () => {
  const secret = 'test-owner-secret-'.repeat(3), env = { ...values, BIS_OWNER_TOKEN: secret }, store = memoryStore();
  const handler = createHostedHandler({ env, store });
  const connected = await (await handler(post('connect', { network: 'signet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${secret}` }))).json();
  const body = { id: 'signature-1', operationId: 'proof-1', network: 'signet', profileId: connected.profileId, method: 'signMessage', args: encodeSigningValue([new Uint8Array(32), 'schnorr']) };
  const grant = await (await handler(post('authorize', { request: body, operationId: body.operationId }, { Authorization: `Bearer ${secret}` }))).json();
  const headers = { Authorization: `Bearer ${connected.token}`, 'X-BIS-Signing-Grant': grant.grant };
  const signed = await handler(post('sign', body, headers)); assert.equal(signed.status, 200);
  assert.equal((await handler(post('sign', { ...body, id: 'changed' }, headers))).status, 403);
  const cold = createHostedHandler({ env, store });
  const replay = await cold(post('sign', body, headers));
  assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), await signed.json());
  assert.equal((await cold(post('sign', body, { ...headers, Authorization: `Bearer ${connected.token}x` }))).status, 403);
});

test('opt-in public connections are rate limited and never authorize arbitrary or owner signing', async () => {
  const secret = 'public-connect-test-secret-'.repeat(3), store = memoryStore();
  let consumed = 0, exhausted = false;
  store.consumePublicRequest = async scope => {
    assert.equal(scope, 'stealth-and-steel:signet');
    if (exhausted) throw Error('Public signing request limit exceeded.');
    consumed++;
  };
  const env = { ...values, BIS_OWNER_TOKEN: secret, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' };
  const handler = createHostedHandler({ env, store });
  const scope = { network: 'signet', gameId: 'stealth-and-steel' };
  const response = await handler(post('connect', scope));
  assert.equal(response.status, 200);
  const connected = await response.json();
  assert.equal(consumed, 1);
  const binding = { gameId: scope.gameId, network: 'signet' as const, profileId: connected.profileId };
  assert.equal(createSigningAuthorization(secret).connection(connected.token, binding).purpose, 'connection');
  assert.equal(JSON.stringify(connected).includes(secret), false);
  assert.equal(JSON.stringify(connected).includes(phrase), false);
  const raw = { id: 'public-request', operationId: 'public-operation', ...binding, method: 'signMessage', args: encodeSigningValue([new Uint8Array(32), 'schnorr']) };
  const headers = { Authorization: `Bearer ${connected.token}`, 'X-BIS-Signing-Grant': connected.token };
  assert.equal((await handler(post('authorize', { request: raw, operationId: raw.operationId }, headers))).status, 403);
  assert.equal((await handler(post('sign', raw, headers))).status, 403);
  assert.equal((await handler(post('owner/plan', { request: raw }, headers))).status, 403);
  assert.equal((await handler(post('connect', scope, { Authorization: 'Bearer incorrect-owner' }))).status, 403);
  assert.equal(consumed, 1);
  exhausted = true;
  assert.equal((await handler(post('connect', scope))).status, 429);
  // Owner diagnostics remain available without consuming public quotas.
  assert.equal((await handler(post('connect', scope, { Authorization: `Bearer ${secret}` }))).status, 200);
  assert.equal((await createHostedHandler({ env: { ...env, BIS_PUBLIC_PAYMENT_SIGNING: 'false' }, store })(post('connect', scope))).status, 403);
  assert.equal((await createHostedHandler({ env: { ...values, BIS_PUBLIC_PAYMENT_SIGNING: 'true' }, store })(post('connect', scope))).status, 403);
});

test('V4 actor endpoints require Player proof, exact connection binding, coordinated Game signature and read-only replay',async()=>{
  const secret='treasure-actor-route-secret-'.repeat(2),env={...values,BIS_OWNER_TOKEN:secret,BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'mutinynet'},store=memoryStore();
  const counters={reads:0,claims:0,completions:0,quotas:0},readCompleted=store.readCompleted!.bind(store),claimSigning=store.claim.bind(store),completeSigning=store.complete.bind(store),consume=store.consumePublicRequest.bind(store);
  store.readCompleted=async input=>{counters.reads++;return readCompleted(input);};
  store.claim=async input=>{counters.claims++;return claimSigning(input);};
  store.complete=async(input,owner,result)=>{counters.completions++;return completeSigning(input,owner,result);};
  store.consumePublicRequest=async(...args)=>{counters.quotas++;return consume(...args);};
  let now=1_800_000_001_000,reads=0;
  const game=MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}),[player,operator]=[2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const gamePublicKey=toHex(await game.compressedPublicKey()),playerPublicKey=toHex(await player.compressedPublicKey()),operatorPublicKey=toHex(await operator.compressedPublicKey());
  const gameKey=fromHex(gamePublicKey.slice(2)),playerKey=fromHex(playerPublicKey.slice(2)),operatorKey=fromHex(operatorPublicKey.slice(2));
  const exitScript=CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:86016n}});
  const info={network:'mutinynet',signerPubkey:operatorPublicKey,forfeitPubkey:operatorPublicKey,unilateralExitDelay:2048n,
    checkpointTapscript:toHex(exitScript.script),dust:330n,vtxoMinAmount:330n,vtxoMaxAmount:-1n,fees:{txFeeRate:'0',intentFee:{offchainInput:'amount*0.001'}}} as unknown as ArkInfo;
  const startedAtMs=1_800_000_000_000,offer={offerSessionId:'route-offer',hostReference:'route-host',startedAtMs};
  const script=(pubKey:Uint8Array)=>new DefaultVtxo.Script({pubKey,serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:2048n}});
  const gameWallet=script(gameKey),playerWallet=script(playerKey),terms={network:'mutinynet' as const,...offer,player:toHex(playerKey),game:toHex(gameKey),
    operator:toHex(operatorKey),emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:toHex(playerWallet.pkScript.slice(2)),
    gameDestination:toHex(gameWallet.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName('reject')!;
  const previous=new Transaction({version:3});previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});
  const funding={txid:previous.id,vout:0},coin={...funding,value:1000,script:toHex(built.script.pkScript),status:{confirmed:true},createdAt:new Date(startedAtMs),
    isSpent:false,isSwept:false,isPreconfirmed:false,spentBy:'',isUnrolled:false,expiresAt:new Date('2100-01-01'),virtualStatus:{state:'settled'},assets:[]} as unknown as VirtualCoin;
  const initialProof=new Uint8Array(64),initialWitness=RawWitness.encode([initialProof,new Uint8Array(64)]);
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:initialWitness}])]);
  const initial=buildOffchainTx([{...funding,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:gameWallet.pkScript,amount:1000n},packet.txOut()],exitScript);
  setArkPsbtField(initial.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
  const message=treasureAuthorizationDigest(terms,'reject',{arkTx:initial.arkTx,checkpoint:initial.checkpoints[0],funding:{...funding,value:1000},checkpointTapscript:exitScript});
  const playerProof=await player.signMessage(message,'schnorr'),witness=RawWitness.encode([playerProof,new Uint8Array(64)]);
  const signedConsent=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness}])]);
  const pair=buildOffchainTx([{...funding,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:gameWallet.pkScript,amount:1000n},signedConsent.txOut()],exitScript);
  setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
  const proof={artifactVersion:4,branch:'reject',operationId:'actor-route-operation',...offer,funding,arkTx:base64.encode(pair.arkTx.toPSBT()),checkpoint:base64.encode(pair.checkpoints[0].toPSBT()),playerProof:toHex(playerProof)};
  const actorReader=(scope:Readonly<{network:'mutinynet';gamePublicKey:string;playerPublicKey:string;operationId:string}>)=>({authenticatedScope:async()=>scope,
    info:async()=>{reads++;return info;},coins:async()=>{reads++;return {vtxos:[coin]};},transactions:async()=>{reads++;return {txs:[toHex(previous.toBytes(false,false))]};},now:()=>now});
  const handler=createHostedHandler({env,store,now:()=>now,actorAuthorizationReader:actorReader});
  const connected=await(await handler(post('connect',{network:'mutinynet',gameId:'stealth-and-steel'}))).json();
  const binding={audience:'https://example.test',gameId:'stealth-and-steel',network:'mutinynet' as const,profileId:connected.profileId,operationId:'actor-route-operation'};
  const challenge=await(await handler(post('player/challenge',{...binding,playerPublicKey}))).json();
  const playerSignature=toHex(await player.signMessage(createHash('sha256').update(playerProofMessage(challenge.scope)).digest(),'schnorr'));
  const authenticated=await(await handler(post('player/authenticate',{...binding,challenge:challenge.challenge,signature:playerSignature}))).json();
  const prepared={id:'actor-route-signature',operationId:'actor-route-operation',network:'mutinynet',profileId:connected.profileId,method:'signMessage',
    args:encodeSigningValue([message,'schnorr']),treasureActorProof:proof,connectionToken:connected.token};
  const publicHeaders={Authorization:`Bearer ${connected.token}`};
  const planResponse=await handler(post('treasure/actor/plan',{request:prepared,playerToken:authenticated.token},publicHeaders));assert.equal(planResponse.status,200);
  const plan=(await planResponse.json()).treasureActorPlan;assert.equal(typeof plan,'string');
  const planned={...prepared,treasureActorPlan:plan};
  const grantResponse=await handler(post('treasure/actor/authorize',{request:planned,playerToken:authenticated.token},publicHeaders));assert.equal(grantResponse.status,200);
  const grant=(await grantResponse.json()).grant;assert.equal(typeof grant,'string');
  const signed=await handler(post('sign',planned,{...publicHeaders,'X-BIS-Signing-Grant':grant}));assert.equal(signed.status,200);
  const signedBody=await signed.json(),result=signedBody.result,signature=fromHex(result.value);
  assert.equal(schnorr.verify(signature,message,gameKey),true);const readsAfterSign=reads;
  const replay=await handler(post('sign',planned,{...publicHeaders,'X-BIS-Signing-Grant':grant}));assert.equal(replay.status,200);
  assert.deepEqual(await replay.json(),signedBody);assert.equal(reads,readsAfterSign,'completed replay must not perform a fresh provider/time observation');
  const finalWitness=RawWitness.encode([playerProof,signature]),finalPacket=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:finalWitness}])]);
  const finalPair=buildOffchainTx([{...funding,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:gameWallet.pkScript,amount:1000n},finalPacket.txOut()],exitScript);
  setArkPsbtField(finalPair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
  assert.notEqual(pair.arkTx.id,finalPair.arkTx.id,'inserting the Game VM proof creates the final ROOT family ID');
  const rootClaim:SigningClaim={scope:`stealth-and-steel:mutinynet:${connected.profileId}`,id:'actor-root-request',operationId:'actor-route-operation',
    digest:'1'.repeat(64),inputs:[`${funding.txid}:${funding.vout}`],transactionId:finalPair.arkTx.id,exposureSats:0,dailyCapSats:10000,
    operationCapSats:5000,day:new Date(now).toISOString().slice(0,10)};
  const rootAcquired=await store.claim(rootClaim);assert.equal(rootAcquired.status,'acquired','the actor claim must not reserve the spend input');
  if(rootAcquired.status==='acquired')await store.complete(rootClaim,rootAcquired.owner,{accepted:true});
  assert.equal((await handler(post('treasure/actor/plan',{request:prepared,playerToken:authenticated.token,ownerPlan:'mixed'}))).status,403);
  const ownerConnection=await(await handler(post('connect',{network:'mutinynet',gameId:'stealth-and-steel'},{Authorization:`Bearer ${secret}`}))).json();
  const ownerOperation='owner-actor-operation',ownerPrepared={...prepared,id:'owner-actor-signature',operationId:ownerOperation,
    treasureActorProof:{...proof,operationId:ownerOperation},connectionToken:ownerConnection.token};
  const ownerReader=(scope:AuthenticatedTreasureActorScope)=>actorReader(scope);
  const ownerOptions={env,store,now:()=>now,actorAuthorizationReader:ownerReader};
  const ownerHandler=createHostedHandler(ownerOptions);
  const ownerPlan=await(await ownerHandler(post('owner/treasure/actor/plan',
    {request:ownerPrepared,connectionToken:ownerConnection.token,contractPlayerPublicKey:playerPublicKey},{Authorization:`Bearer ${secret}`}))).json();
  assert.equal(typeof ownerPlan.treasureActorPlan,'string');
  const ownerPlanned={...ownerPrepared,treasureActorPlan:ownerPlan.treasureActorPlan};
  const ownerGrantResponse=await ownerHandler(post('owner/treasure/actor/authorize',
    {request:ownerPlanned,connectionToken:ownerConnection.token,contractPlayerPublicKey:playerPublicKey},{Authorization:`Bearer ${secret}`}));
  assert.equal(ownerGrantResponse.status,200);const ownerGrant=(await ownerGrantResponse.json()).grant;
  const ownerSigned=await ownerHandler(post('sign',ownerPlanned,{'X-BIS-Signing-Grant':ownerGrant}));assert.equal(ownerSigned.status,200);
  const ownerSignedBody=await ownerSigned.json(),ownerResult=ownerSignedBody.result;
  assert.equal(schnorr.verify(fromHex(ownerResult.value),message,gameKey),true);
  const beforeRecovery={...counters},beforeProviderReads=reads;
  now+=600_001; // Both original connection tokens and actor plans have expired.
  const recovery=(original:Record<string,any>,token:string,headers:Record<string,string>)=>post('treasure/recover',{
    version:1,requestId:original.id,requestDigest:signingDigest(original),requestJson:JSON.stringify(original),connectionToken:token,
  },headers);
  const recovered=await handler(recovery(planned,connected.token,publicHeaders));assert.equal(recovered.status,200,await recovered.clone().text());
  assert.deepEqual(await recovered.json(),signedBody);
  const ownerRecovered=await ownerHandler(recovery(ownerPlanned,ownerConnection.token,{Authorization:`Bearer ${secret}`}));
  assert.equal(ownerRecovered.status,200,await ownerRecovered.clone().text());assert.deepEqual(await ownerRecovered.json(),ownerSignedBody);
  assert.equal(counters.reads,beforeRecovery.reads+2,'each authorized recovery performs one result lookup');
  assert.deepEqual({...counters,reads:beforeRecovery.reads},{...beforeRecovery,reads:beforeRecovery.reads},'recovery performs no new claim, completion, or quota operation');
  assert.equal(reads,beforeProviderReads,'recovery performs no provider or wallet-state observation');
  const beforeFreshSign={...counters},freshAction={...planned,id:'actor-fresh-after-expiry'};
  const freshSign=await handler(post('sign',freshAction,{...publicHeaders,'X-BIS-Signing-Grant':grant}));assert.equal(freshSign.status,403);
  assert.deepEqual(counters,beforeFreshSign,'expired original actor authorization cannot start another signing action');
  const readsBeforeDenials=counters.reads;
  const nonCanonical=JSON.stringify(planned,null,2),badCanonical=await handler(post('treasure/recover',{
    version:1,requestId:planned.id,requestDigest:signingDigest(planned),requestJson:nonCanonical,connectionToken:connected.token,
  },publicHeaders));assert.equal(badCanonical.status,403);assert.equal(counters.reads,readsBeforeDenials);
  const foreignProfile={...planned,profileId:'f'.repeat(64)},badProfile=await handler(recovery(foreignProfile,connected.token,publicHeaders));
  assert.equal(badProfile.status,403);assert.equal(counters.reads,readsBeforeDenials);
  const wrongAuthority=await handler(recovery(planned,connected.token,{Authorization:`Bearer ${secret}`}));
  assert.equal(wrongAuthority.status,403);assert.equal(counters.reads,readsBeforeDenials);
  const foreignNetwork={...planned,network:'signet'},badNetwork=await handler(recovery(foreignNetwork,connected.token,publicHeaders));
  assert.equal(badNetwork.status,403);assert.equal(counters.reads,readsBeforeDenials);
  const foreignOriginBody=recovery(planned,connected.token,publicHeaders),foreignOrigin=await handler(new Request('https://other.test/api/bis/treasure/recover',{
    method:'POST',headers:foreignOriginBody.headers,body:await foreignOriginBody.text(),
  }));assert.equal(foreignOrigin.status,403);assert.equal(counters.reads,readsBeforeDenials);
  const realRead=store.readCompleted;
  for(const status of ['missing','unresolved'] as const){
    store.readCompleted=async input=>{counters.reads++;return {status};};
    const unavailable=await handler(recovery(planned,connected.token,publicHeaders));assert.equal(unavailable.status,409);
  }
  store.readCompleted=realRead;
  const badGrantResult={...signedBody,result:encodeSigningValue(await player.signMessage(message,'schnorr'))};
  store.readCompleted=async input=>{const prior=await readCompleted(input);return prior.status==='completed'?{status:'completed',result:badGrantResult}:prior;};
  const corrupt=await handler(recovery(planned,connected.token,publicHeaders));assert.equal(corrupt.status,403,'a foreign signer result must not be returned');
  store.readCompleted=realRead;assert.equal(reads,beforeProviderReads);
});

test('public connection selection checks fresh per-network requirements but original connections keep their profile', async () => {
  const second = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const secret = 'public-pool-test-secret-'.repeat(3), store = memoryStore(), visited: string[] = [];
  let drained = false;
  const env = { ...values, BIS_GAME_WALLET_SIGNET_02_MNEMONIC: second, BIS_OWNER_TOKEN: secret, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' };
  const pool = createWalletPool(env, async wallet => {
    visited.push(`${wallet.network}:${wallet.slot}`);
    return { availableArkadeSats: wallet.slot === '02' && !drained ? 2000 : 0, availableBitcoinSats: 20000 };
  });
  const handler = createHostedHandler({ env, store, pool });
  const scope = { network: 'signet', gameId: 'stealth-and-steel' };
  const identityOnly = await (await handler(post('connect', scope))).json();
  assert.equal(identityOnly.slot, '01'); assert.deepEqual(visited, []);
  const fundedResponse = await handler(post('connect', { ...scope, requirement: { arkadeSats: 1000 } }));
  assert.equal(fundedResponse.status, 200);
  const funded = await fundedResponse.json();
  assert.equal(funded.slot, '02'); assert.deepEqual(visited, ['signet:01', 'signet:02']);
  assert.notEqual(funded.profileId, identityOnly.profileId);
  drained = true;
  assert.equal((await handler(post('connect', { ...scope, requirement: { arkadeSats: 1000 } }))).status, 503);
  assert.equal((await pool.original('signet', funded.profileId)).slot, '02');
  const beforeReconnect = visited.length;
  const reconnected = await handler(post('connect', { ...scope, profileId: funded.profileId }));
  assert.equal(reconnected.status, 200);
  assert.equal((await reconnected.json()).profileId, funded.profileId);
  assert.equal(visited.length, beforeReconnect, 'original-profile recovery must not repeat balance selection');
  assert.equal((await handler(post('connect', { ...scope, profileId: funded.profileId, requirement: {} }))).status, 503);
  assert.equal((await handler(post('connect', { ...scope, profileId: 'ff'.repeat(32) }))).status, 503);
  assert.equal(createSigningAuthorization(secret).connection(funded.token, { ...scope, network: 'signet', profileId: funded.profileId }).profileId, funded.profileId);
  // Mutinynet is outside this public signing allowlist; reject before any balance selection.
  const beforeMutinynet = visited.length;
  assert.equal((await handler(post('connect', { ...scope, network: 'mutinynet', requirement: { arkadeSats: 1000 } }))).status, 403);
  assert.equal(visited.length, beforeMutinynet);
  const before = visited.length;
  const cancelled = new Request(post('connect', { ...scope, requirement: { arkadeSats: 1 } }), { signal: AbortSignal.abort() });
  assert.equal((await handler(cancelled)).status, 503);
  assert.equal(visited.length, before);
});

test('encrypted MuSig state survives a cold instance on every exchange and produces a real aggregate signature', async t => {
  const secret = 'test-cold-owner-secret-'.repeat(3), store = memoryStore();
  const env = { ...values, BIS_OWNER_TOKEN: secret, BIS_SIGNING_OPERATION_CAP_SATS: '1000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const blobs: string[] = [], baseSession = store.session.bind(store);
  store.session = async (...args) => { if (args[3] !== undefined) blobs.push(args[3]); return baseSession(...args); };
  const fetcher: typeof fetch = async (url, init) => createHostedHandler({ env, store })(new Request(String(url), init));
  configureBisServer({ ownerToken: secret }); t.after(() => configureBisServer({}));
  const probe = await probeGameSigner('signet', { endpoint: 'https://cold.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  const remote = remoteSigningIdentity(probe.account).signerSession();
  const local = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }).signerSession();
  const keys = await Promise.all([remote.getPublicKey(), local.getPublicKey()]);
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ script: fromHex('51'), amount: 500n });
  keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), scriptRoot = new Uint8Array(32), amount = 1000n;
  await Promise.all([remote.init(tree, scriptRoot, amount), local.init(tree, scriptRoot, amount)]);
  const nonceSets = await Promise.all([remote.getNonces(), local.getNonces()]);
  assert.deepEqual(await remote.getNonces(), nonceSets[0]);
  const publicNonces = new Map(keys.map((key, index) => [toHex(key.slice(1)), { pubNonce: nonceSets[index].get(tree.txid)!.pubNonce }]));
  await remote.aggregatedNonces(tree.txid, new Map(publicNonces));
  await local.aggregatedNonces(tree.txid, new Map(publicNonces));
  const partials = await Promise.all([remote.sign(), local.sign()]);
  const sorted = sortKeys(keys), untweaked = keyAggregate(sorted).aggPublicKey.toBytes(true);
  const tweak = schnorr.utils.taggedHash('TapTweak', untweaked.slice(1), scriptRoot);
  const finalKey = keyAggregate(sorted, [tweak], [true]).aggPublicKey.toBytes(true);
  const message = tx.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey.slice(1)])], 0, [amount]);
  const nonces = sorted.map(key => publicNonces.get(toHex(key.slice(1)))!.pubNonce);
  const session = new Session(nonceAggregate(nonces), sorted, message, [tweak], [true]);
  const signatures = sorted.map(key => partials[keys.findIndex(candidate => toHex(candidate) === toHex(key))].get(tree.txid)!.encode());
  assert.equal(schnorr.verify(session.partialSigAgg(signatures), message, finalKey.slice(1)), true);
  assert.ok(blobs.length >= 6);
  for (const blob of blobs) {
    const decoded = Buffer.from(blob, 'base64url').toString('utf8');
    assert.equal(decoded.includes('secretKey'), false); assert.equal(decoded.includes('secNonce'), false); assert.equal(decoded.includes(phrase), false);
  }
  await assert.rejects(remote.sign(), /unavailable/);
});

for (const failure of ['missing', 'corrupt', 'wrong-operation', 'expired', 'write-lost'] as const) {
  test(`hosted session ${failure} refuses signing and preserves the unresolved wallet claim`, async () => {
    const secret = 'test-session-safety-'.repeat(3), store = memoryStore();
    let time = 1000, damage = false;
    const session = store.session.bind(store);
    store.session = async (...args) => {
      if (damage && args[3] !== undefined && failure === 'write-lost') throw Error('write lost');
      const value = await session(...args);
      if (!damage || args[3] !== undefined) return value;
      return failure === 'missing' ? null : failure === 'corrupt' && value ? value.slice(0, -4) + 'AAAA' : value;
    };
    const env = { ...values, BIS_OWNER_TOKEN: secret };
    const send = (path: string, body: unknown, headers = {}) => createHostedHandler({ env, store, now: () => time })(post(path, body, headers));
    const connected = await (await send('connect', { network: 'signet', gameId: 'stealth-and-steel' }, { Authorization: `Bearer ${secret}` })).json();
    const perform = async (id: string, method: string, sessionId?: string, operationId = 'operation-1') => {
      const body = { id, operationId, network: 'signet', profileId: connected.profileId, method, args: [], sessionId };
      const granted = await (await send('authorize', { request: body, operationId }, { Authorization: `Bearer ${secret}` })).json();
      return send('sign', body, { Authorization: `Bearer ${connected.token}`, 'X-BIS-Signing-Grant': granted.grant });
    };
    const created = await perform('create-1', 'session.create'); assert.equal(created.status, 200);
    const sessionId = (await created.json()).result; damage = true;
    if (failure === 'expired') time += 600000;
    const response = await perform('key-1', 'session.getPublicKey', sessionId, failure === 'wrong-operation' ? 'operation-2' : 'operation-1');
    assert.notEqual(response.status, 200);
    if (failure !== 'expired') {
      damage = false;
      assert.equal((await perform('key-2', 'session.getPublicKey', sessionId)).status, 503);
    }
  });
}
test('real client adapter obtains exact owner grants without exposing or persisting owner credentials', async t => {
  const secret = 'test-client-owner-secret-'.repeat(3);
  const handler = createHostedHandler({ env: { ...values, BIS_OWNER_TOKEN: secret }, store: memoryStore() });
  const fetcher: typeof fetch = async (url, init) => handler(new Request(String(url), init));
  configureBisServer({ ownerToken: secret });
  t.after(() => configureBisServer({}));
  const probe = await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  assert.equal(JSON.stringify(probe).includes(secret), false);
  const identity = remoteSigningIdentity(probe.account), message = new Uint8Array(32).fill(42);
  assert.equal(schnorr.verify(await identity.signMessage(message, 'schnorr'), message, await identity.xOnlyPublicKey()), true);
  configureBisServer({});
  await assert.rejects(identity.signMessage(message, 'schnorr'), /Private owner grant is required/);
  assert.equal((await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher })).status, 'error');
});

async function retainedHostedFixture(t: test.TestContext) {
  const secret = 'test-retained-owner-'.repeat(3), env = { ...values, BIS_OWNER_TOKEN: secret, BIS_SIGNING_OPERATION_CAP_SATS: '1000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const store = memoryStore(), requests: any[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/sign')) requests.push(JSON.parse(String(init?.body)));
    return createHostedHandler({ env, store })(new Request(String(url), init));
  };
  configureBisServer({ ownerToken: secret }); t.after(() => configureBisServer({}));
  const probe = await probeGameSigner('signet', { endpoint: 'https://retained.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') throw Error('Fixture did not connect.');
  let created = 0;
  const owner = createAppWalletSession({ createWallet: async config => {
    created++;
    return { identity: config.identity, async dispose() {} };
  } });
  t.after(() => owner.dispose());
  return { owner, account: probe.account, requests, creations: () => created };
}

test('retained remote wallet uses one operation per exclusive lease, not one per wallet lifetime', async t => {
  const { owner, account, requests, creations } = await retainedHostedFixture(t);
  const local = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
  const payment = p2wpkh(await local.compressedPublicKey());
  for (const byte of ['56', '57']) {
    await owner.sign('game', account, new AbortController().signal, async wallet => {
      const tx = new Transaction();
      tx.addInput({ txid: byte.repeat(32), index: 0, witnessUtxo: { script: payment.script, amount: 600n } });
      tx.addOutput({ script: payment.script, amount: 599n });
      await wallet.identity.signMessage(new Uint8Array(32), 'schnorr');
      assert.ok((await wallet.identity.sign(tx)).getInput(0).partialSig?.length);
    });
  }
  assert.equal(creations(), 1);
  assert.equal(requests[0].operationId, requests[1].operationId);
  assert.equal(requests[2].operationId, requests[3].operationId);
  assert.notEqual(requests[0].operationId, requests[2].operationId);
  const before = requests.length;
  await assert.rejects(owner.read('game', account, new AbortController().signal, wallet => wallet.identity.signMessage(new Uint8Array(32), 'schnorr')), /active operation lease/);
  assert.equal(requests.length, before);
});

test('a signer session cannot migrate from its completed lease into another operation', async t => {
  const { owner, account, requests } = await retainedHostedFixture(t);
  let oldSession: ReturnType<ReturnType<typeof remoteSigningIdentity>['signerSession']>;
  await owner.sign('game', account, new AbortController().signal, async wallet => {
    oldSession = wallet.identity.signerSession(); await oldSession.getPublicKey();
  });
  const before = requests.length;
  await owner.sign('game', account, new AbortController().signal, async wallet => {
    await assert.rejects(oldSession.getPublicKey(), /operation ended/);
    assert.equal(requests.length, before);
    await wallet.identity.signerSession().getPublicKey();
  });
  assert.notEqual(requests[0].operationId, requests[before].operationId);
});

test('cancelled caller leaves its real SDK lease held until completion and cannot authorize late signing', async t => {
  const { owner, account, requests } = await retainedHostedFixture(t);
  let release!: () => void, started!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  const abort = new AbortController();
  const first = owner.sign('game', account, abort.signal, async wallet => {
    await wallet.identity.signMessage(new Uint8Array(32), 'schnorr');
    started(); await hold;
    await assert.rejects(wallet.identity.signMessage(new Uint8Array(32), 'schnorr'));
  });
  await ready; assert.equal(owner.hasActiveSigning('game'), true);
  abort.abort(); await assert.rejects(first);
  assert.equal(owner.hasActiveSigning('game'), true, 'caller cancellation cannot permit profile replacement while the SDK still owns its lease');
  let secondStarted = false;
  const second = owner.sign('game', account, new AbortController().signal, async wallet => {
    secondStarted = true; await wallet.identity.signMessage(new Uint8Array(32), 'schnorr');
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(secondStarted, false); assert.equal(requests.length, 1);
  release(); await second;
  assert.equal(owner.hasActiveSigning('game'), false);
  assert.equal(requests.length, 2); assert.notEqual(requests[0].operationId, requests[1].operationId);
});
