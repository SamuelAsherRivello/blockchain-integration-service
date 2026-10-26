import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MnemonicIdentity, DefaultVtxo, Intent, Transaction, TxTree, CosignerPublicKey, setArkPsbtField, type IntentCoin } from '@arkade-os/sdk';
import { schnorr } from '@noble/curves/secp256k1.js';
import { Session, keyAggregate, nonceAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { settlementSessionIdentity } from '../src/server/settlement-session-identity.ts';
import { executeHostedSigning } from '../src/server/hosted-session.ts';
import { coordinatedSigning, type SigningClaim, type SigningStore } from '../src/server/signing-store.ts';
import { signingDigest } from '../src/server/signing-authorization.ts';
import { decodeSigningValue, encodeSigningValue, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

// Private codec tests use deliberately permissive storage to prove encrypted
// state binding independently of the ledger. Real Redis exclusion, budgets and
// quarantine are verified separately. These are not live/authorized batches.
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const game = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }), gameKey = await game.xOnlyPublicKey(), gamePublicKey = toHex(await game.compressedPublicKey());
const script = new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: gameKey, csvTimelock: { type: 'seconds', value: 1024n } });
const input = { txid: '11'.repeat(32), vout: 0, value: 10000, tapTree: script.encode(), intentTapLeafScript: script.forfeit(), status: { confirmed: true } } as IntentCoin;
const draft = Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [gamePublicKey] }, [input], [{ amount: 10000n, script: script.pkScript }]);
const binding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet' as const, profileId: 'aa'.repeat(32), operationId: 'settlement-1', connectionId: 'connection-1' };
const secret = 'encrypted-operation-session-fixture-'.repeat(2), reservationId = 'bb'.repeat(32), batch = { reservationId, digest: 'cc'.repeat(32) };

async function fixture() {
  const blobs = new Map<string, string>(), claims: SigningClaim[] = [];
  const store: SigningStore = { ping: async () => {}, assetAllowed: async () => false, consumePublicRequest: async () => {},
    claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {},
    session: async (_claim, _owner, id, encrypted) => { if (encrypted !== undefined) blobs.set(id, encrypted); return blobs.get(id) ?? null; } };
  const sessionKey = toHex(await settlementSessionIdentity(secret, binding, draft).compressedPublicKey());
  type Policy = NonNullable<Parameters<typeof executeHostedSigning>[0]['sessionPolicy']>;
  const invoke = async (method: string, args: any[] = [], sessionId?: string, change: { claim?: Partial<SigningClaim>; policy?: false | Partial<Policy>; now?: number } = {}) => {
    const claim: SigningClaim = { scope: 'fixture:signet:profile', id: randomUUID(), operationId: binding.operationId,
      digest: signingDigest([method, encodeSigningValue(args), sessionId]), transactionId: reservationId, exposureId: reservationId,
      inputs: [input.txid + ':0'], exposureSats: 0, dailyCapSats: 10000, operationCapSats: 5000, day: '2026-10-21',
      ...(!['session.create', 'session.getPublicKey'].includes(method) ? { settlementBatch: batch } : {}), ...change.claim };
    const sessionPolicy = change.policy === false ? undefined : { reservationId, publicKey: sessionKey, identity: settlementSessionIdentity(secret, binding, draft), ...change.policy };
    const result = await coordinatedSigning(store, claim, owner => executeHostedSigning({ identity: game, secret, connectionId: binding.connectionId,
      connectionExpires: 1000000, now: change.now ?? 100000, store, claim, owner, method, args, sessionId, sessionPolicy }));
    return decodeSigningValue(result);
  };
  return { blobs, claims, sessionKey, invoke };
}

test('cold encrypted session restores the exact derived operation key and produces a real aggregate signature', async () => {
  const f = await fixture(), id = await f.invoke('session.create');
  const remoteKey = await f.invoke('session.getPublicKey', [], id);
  assert.equal(toHex(remoteKey), f.sessionKey); assert.notEqual(f.sessionKey, gamePublicKey);
  const local = game.signerSession(), localKey = await local.getPublicKey(), keys = [remoteKey, localKey];
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ amount: 500n, script: Uint8Array.from([0x51]) });
  keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), root = new Uint8Array(32), amount = 1000n;
  await f.invoke('session.init', [tree, root, amount], id); await local.init(tree, root, amount);
  const remoteNonces = await f.invoke('session.getNonces', [], id), localNonces = await local.getNonces();
  assert.deepEqual(await f.invoke('session.getNonces', [], id), remoteNonces);
  const nonces = new Map([[toHex(remoteKey.slice(1)), { pubNonce: remoteNonces.get(tx.id).pubNonce }], [toHex(localKey.slice(1)), { pubNonce: localNonces.get(tx.id)!.pubNonce }]]);
  await f.invoke('session.aggregatedNonces', [tx.id, nonces], id); await local.aggregatedNonces(tx.id, nonces);
  const partials = [await f.invoke('session.sign', [], id), await local.sign()];
  const sorted = sortKeys(keys), internal = keyAggregate(sorted).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internal, root);
  const finalKey = keyAggregate(sorted, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
  const message = tx.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey])], 0, [amount]);
  const aggregate = new Session(nonceAggregate(sorted.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), sorted, message, [tweak], [true]);
  const signature = aggregate.partialSigAgg(sorted.map(key => partials[keys.findIndex(k => toHex(k) === toHex(key))].get(tx.id).encode()));
  assert.equal(schnorr.verify(signature, message, finalKey), true);
  await assert.rejects(f.invoke('session.sign', [], id), /consumed|phase/);
  for (const blob of f.blobs.values()) {
    const text = Buffer.from(blob, 'base64url').toString('utf8');
    assert.equal(text.includes('secretKey'), false); assert.equal(text.includes('secNonce'), false); assert.equal(text.includes(phrase), false);
  }
});

test('reservation encryption binding rejects legacy or reassigned session use without overwriting saved state', async () => {
  for (const changed of ['legacy', 'reservation', 'key'] as const) {
    const f = await fixture(), id = await f.invoke('session.create'), original = f.blobs.get(id);
    const change = changed === 'legacy' ? { policy: false as const } : changed === 'key' ? { policy: { publicKey: gamePublicKey } }
      : { policy: { reservationId: 'dd'.repeat(32) }, claim: { transactionId: 'dd'.repeat(32), exposureId: 'dd'.repeat(32) } };
    await assert.rejects(f.invoke('session.getPublicKey', [], id, change));
    assert.equal(f.blobs.get(id), original);
  }
});

test('session initialization requires a validated batch binding and later phases cannot replace or omit it', async () => {
  const f = await fixture(), id = await f.invoke('session.create');
  const key = await f.invoke('session.getPublicKey', [], id);
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ amount: 500n, script: Uint8Array.from([0x51]) });
  setArkPsbtField(tx, 0, CosignerPublicKey, { index: 0, key });
  const args = [new TxTree(tx), new Uint8Array(32), 1000n];
  const uninitialized = f.blobs.get(id);
  await assert.rejects(f.invoke('session.init', args, id, { claim: { settlementBatch: undefined } }), /batch binding required/);
  assert.equal(f.blobs.get(id), uninitialized);
  await f.invoke('session.init', args, id);
  const initialized = f.blobs.get(id);
  await assert.rejects(f.invoke('session.getNonces', [], id, { claim: { settlementBatch: { reservationId, digest: 'dd'.repeat(32) } } }), /batch binding invalid/);
  await assert.rejects(f.invoke('session.getNonces', [], id, { claim: { settlementBatch: undefined } }), /batch binding invalid/);
  assert.equal(f.blobs.get(id), initialized);
  await assert.rejects(f.invoke('session.init', args, id), /already set/);
  await assert.rejects(f.invoke('session.getNonces', [], id, { now: 1000000 }), /expired/);
});
