import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, Intent, Transaction, TxTree, CosignerPublicKey, setArkPsbtField, type IntentCoin } from '@arkade-os/sdk';
import { tapLeafHash } from '@scure/btc-signer/payment.js';
import { keyAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { createSettlementAuthorization, type SettlementBinding } from '../src/server/settlement-authorization.ts';
import { coordinatedSigning, type SigningClaim, type SigningStore } from '../src/server/signing-store.ts';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { signingDigest } from '../src/server/signing-authorization.ts';

// Actual SDK proofs, graph and nonce encodings with public unfunded fixtures.
// No registration/broadcast, provider evidence or financial completion.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const operator = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const hex = (v: Uint8Array) => Buffer.from(v).toString('hex'), gamePublicKey = hex(await game.compressedPublicKey()), operatorPublicKey = hex(await operator.compressedPublicKey());
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: Buffer.from(gamePublicKey.slice(2), 'hex'), serverPubKey: Buffer.from(operatorPublicKey.slice(2), 'hex'), csvTimelock: { type: 'seconds', value: delay } });
const own = script(1024n), boarding = script(4096n), input = { txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true } } as IntentCoin;
const context = { inputs: [input], gamePublicKey, arkadeScript: own.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 };
const binding: SettlementBinding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet', profileId: 'aa'.repeat(32), operationId: 'operation-1', connectionId: 'connection-1' };
const secret = 'settlement-session-grant-fixture-'.repeat(2), batchExpiry = 86528n;
const scope = { network: 'signet' as const, publicKey: operatorPublicKey, forfeitPublicKey: operatorPublicKey, batchExpiry };

async function fixture(now = () => 100000) {
  const auth = createSettlementAuthorization(secret, now);
  const draft = Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [gamePublicKey] }, [input], [{ amount: 15000n, script: own.pkScript }]);
  const plan = await auth.operationPlan(binding, draft, context), internal = await auth.sessionIdentity(plan.plan, binding);
  const first = internal.identity.signerSession(), second = operator.signerSession(), keys = sortKeys(await Promise.all([first.getPublicKey(), second.getPublicKey()]));
  const root = tapLeafHash(CSVMultisigTapscript.encode({ pubkeys: [Buffer.from(operatorPublicKey.slice(2), 'hex')], timelock: { type: 'seconds', value: batchExpiry } }).script);
  const internalKey = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internalKey, root);
  const finalKey = keyAggregate(keys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
  const candidate = (nonce = 0) => {
    const commitment = new Transaction(); commitment.addInput({ txid: input.txid, index: 0 });
    commitment.addOutput({ amount: 20000n, script: Uint8Array.from([0x51, 0x20, ...finalKey]) });
    commitment.addOutput({ amount: BigInt(nonce), script: Uint8Array.from([0x6a]) });
    const tx = new Transaction(); tx.addInput({ txid: commitment.id, index: 0 });
    tx.addOutput({ amount: 15000n, script: own.pkScript }); tx.addOutput({ amount: 5000n, script: own.pkScript });
    keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
    return { tree: new TxTree(tx), commitment, scriptRoot: root, sharedAmount: 20000n };
  };
  const request = (method: string, args: any[] = [], sessionId: string | undefined = randomUUID()) => ({ id: randomUUID(), ...binding, method, args: encodeSigningValue(args), ...(sessionId === undefined ? {} : { sessionId }) });
  return { auth, plan, candidate, request, first, second, keys };
}

test('batch grants bind exact validated tree, plan, session request and original fee reservation across cold instances', async () => {
  const f = await fixture(), c = f.candidate(), token = f.auth.batchPlan(f.plan.plan, binding, c, scope);
  const body = f.request('session.init', [c.tree, c.scriptRoot, c.sharedAmount]);
  const grant = f.auth.authorizeSession(f.plan.plan, token, body, binding), cold = createSettlementAuthorization(secret, () => 100000);
  const claim = cold.verifySession(grant, f.plan.plan, token, body, binding);
  assert.equal(claim.sessionPublicKey, f.plan.sessionPublicKey); assert.equal(claim.sessionPolicy, true);
  assert.equal(claim.exposureSats, 5000); assert.equal(claim.settlementBatch!.reservationId, claim.transactionId);
  assert.equal(claim.exposureId, claim.transactionId); assert.deepEqual(claim.inputs, [input.txid + ':0']);
  assert.throws(() => f.auth.verify(grant, f.plan.plan, body, binding), /authorization/);
  assert.throws(() => f.auth.authorize(f.plan.plan, body, binding), /authorization/);
  assert.throws(() => cold.verifySession(grant, f.plan.plan, token, { ...body, id: 'changed' }, binding), /authorization/);
  for (const changed of [{ ...binding, network: 'mutinynet' as const }, { ...binding, connectionId: 'other' }]) assert.throws(() => cold.verifySession(grant, f.plan.plan, token, body, changed), /authorization/);
  assert.throws(() => cold.verifySession(grant, f.plan.plan, token + 'x', body, binding), /authorization/);
  assert.throws(() => createSettlementAuthorization(secret, () => 100000, 'owner').verifySession(grant, f.plan.plan, token, body, binding), /authorization/);
});

test('session setup never authorizes batch work without a batch token and arbitrary methods stay refused', async () => {
  const f = await fixture(), body = { ...f.request('session.create'), sessionId: undefined };
  const grant = f.auth.authorizeSession(f.plan.plan, undefined, body, binding);
  assert.equal(f.auth.verifySession(grant, f.plan.plan, undefined, body, binding).settlementBatch, undefined);
  for (const method of ['session.init', 'session.getNonces', 'session.aggregatedNonces', 'session.sign', 'sign', 'signMessage']) {
    assert.throws(() => f.auth.authorizeSession(f.plan.plan, undefined, f.request(method), binding), /authorization/);
  }
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, undefined, f.request('session.create'), binding), /authorization/);
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, undefined, f.request('session.getPublicKey', [1]), binding), /authorization/);
  const token = f.auth.batchPlan(f.plan.plan, binding, f.candidate(), scope), c = f.candidate();
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, token, f.request('session.init', [c.tree, new Uint8Array(32), c.sharedAmount]), binding), /authorization/);
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, token, f.request('session.init', [c.tree, c.scriptRoot, 19999n]), binding), /authorization/);
  const changed = f.candidate(1);
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, token, f.request('session.init', [changed.tree, changed.scriptRoot, changed.sharedAmount]), binding), /authorization/);
});

test('nonce grants allow only validated node IDs, known cosigners and valid public nonce encodings', async () => {
  const f = await fixture(), c = f.candidate(), token = f.auth.batchPlan(f.plan.plan, binding, c, scope);
  await f.first.init(c.tree, c.scriptRoot, c.sharedAmount); await f.second.init(c.tree, c.scriptRoot, c.sharedAmount);
  const map = new Map([[hex((await f.first.getPublicKey()).slice(1)), { pubNonce: (await f.first.getNonces()).get(c.tree.txid)!.pubNonce }], [hex((await f.second.getPublicKey()).slice(1)), { pubNonce: (await f.second.getNonces()).get(c.tree.txid)!.pubNonce }]]);
  const body = f.request('session.aggregatedNonces', [c.tree.txid, map]);
  assert.doesNotThrow(() => f.auth.authorizeSession(f.plan.plan, token, body, binding));
  for (const args of [['ff'.repeat(32), map], [c.tree.txid, new Map([[gamePublicKey.slice(2), [...map.values()][0]]])],
    [c.tree.txid, new Map([[[...map.keys()][0], { pubNonce: new Uint8Array(66).fill(255) }]])]]) {
    assert.throws(() => f.auth.authorizeSession(f.plan.plan, token, f.request('session.aggregatedNonces', args), binding), /authorization/);
  }
  // Bypass the safe client encoder to exercise the server's hostile-wire check.
  const malicious = JSON.parse(JSON.stringify(body));
  malicious.args[1].value[0][1].secNonce = { $type: 'bytes', value: '00'.repeat(97) };
  assert.throws(() => f.auth.authorizeSession(f.plan.plan, token, malicious, binding), /authorization/);
});

test('different valid candidate batches produce conflicting metadata before the signing callback', async () => {
  const f = await fixture(), pins = new Map<string, string>(); let callbacks = 0;
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false, session: async () => null, complete: async () => {},
    claim: async claim => { const b = claim.settlementBatch!; if (pins.has(b.reservationId) && pins.get(b.reservationId) !== b.digest) throw Error('batch-conflict'); pins.set(b.reservationId, b.digest); return { status: 'acquired', owner: claim.id }; } };
  const makeClaim = (nonce: number): SigningClaim => {
    const c = f.candidate(nonce), token = f.auth.batchPlan(f.plan.plan, binding, c, scope), body = f.request('session.init', [c.tree, c.scriptRoot, c.sharedAmount]);
    const grant = f.auth.authorizeSession(f.plan.plan, token, body, binding);
    return { ...f.auth.verifySession(grant, f.plan.plan, token, body, binding), scope: 'test:signet:profile', id: body.id, digest: signingDigest(body), operationCapSats: 5000, dailyCapSats: 10000, day: '2026-10-21' };
  };
  await coordinatedSigning(store, makeClaim(0), async () => ++callbacks);
  await assert.rejects(coordinatedSigning(store, makeClaim(1), async () => ++callbacks), /batch-conflict/);
  assert.equal(callbacks, 1);
});
