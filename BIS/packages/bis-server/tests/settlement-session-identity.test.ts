import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Intent, Transaction, type IntentCoin } from '@arkade-os/sdk';
import { schnorr } from '@noble/curves/secp256k1.js';
import { keyAggregate, nonceAggregate, sortKeys, Session } from '@scure/btc-signer/musig2.js';
import { settlementSessionIdentity } from '../src/server/settlement-session-identity.ts';
import { TxTree, CosignerPublicKey, setArkPsbtField } from '@arkade-os/sdk';
import type { SettlementBinding } from '../src/server/settlement-authorization.ts';
import { boundSdkSession } from '../src/server/sdk-session-layout.ts';

const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const gameKey = await game.xOnlyPublicKey(), publicKey = Buffer.from(await game.compressedPublicKey()).toString('hex');
const source = new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: gameKey, csvTimelock: { type: 'seconds', value: 1024n } });
const coin = { txid: '11'.repeat(32), vout: 0, value: 10000, tapTree: source.encode(), intentTapLeafScript: source.forfeit(), status: { confirmed: true } } as IntentCoin;
const draft = (amount = 10000n) => Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [publicKey] }, [coin], [{ amount, script: source.pkScript }]);
const binding: SettlementBinding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet', profileId: 'aa'.repeat(32), operationId: 'settlement-1', connectionId: 'connection-1' };
const secret = 'public-test-session-derivation-secret-'.repeat(2);
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');

test('cold derivation is stable only for the original draft, scope and server secret', async () => {
  const identity = settlementSessionIdentity(secret, binding, draft());
  assert.deepEqual(Object.keys(identity).sort(), ['compressedPublicKey', 'signerSession', 'xOnlyPublicKey']);
  assert.equal('sign' in identity, false); assert.equal('toHex' in identity, false);
  const original = await identity.compressedPublicKey();
  assert.deepEqual(await identity.signerSession().getPublicKey(), original, 'the real SDK session must use the sealed key, not its random default');
  assert.deepEqual(await identity.signerSession().getPublicKey(), original);
  assert.deepEqual(await settlementSessionIdentity(secret, binding, draft()).compressedPublicKey(), original);
  assert.notEqual(hex(original), publicKey);
  const changedKeys = new Set<string>();
  for (const key of Object.keys(binding)) {
    const changed = { ...binding, [key]: key === 'network' ? 'mutinynet' : key === 'profileId' ? 'bb'.repeat(32) : 'changed' } as SettlementBinding;
    const next = hex(await settlementSessionIdentity(secret, changed, draft()).compressedPublicKey());
    assert.notEqual(next, hex(original)); changedKeys.add(next);
  }
  assert.equal(changedKeys.size, Object.keys(binding).length);
  assert.notEqual(hex(await settlementSessionIdentity(secret, binding, draft(9999n)).compressedPublicKey()), hex(original));
  assert.notEqual(hex(await settlementSessionIdentity(secret + 'rotated', binding, draft()).compressedPublicKey()), hex(original));
  assert.throws(() => settlementSessionIdentity(undefined, binding, draft()), /unavailable/);
});

test('derived identity uses the actual SDK MuSig session and produces a verifiable aggregate signature', async () => {
  // This is a cryptographic fixture, not an authorized or submitted batch.
  const first = settlementSessionIdentity(secret, binding, draft()).signerSession(), second = game.signerSession();
  const originalKeys = await Promise.all([first.getPublicKey(), second.getPublicKey()]), keys = sortKeys(originalKeys);
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ amount: 500n, script: Uint8Array.from([0x51]) });
  keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), root = new Uint8Array(32), amount = 1000n;
  await Promise.all([first.init(tree, root, amount), second.init(tree, root, amount)]);
  const nonceSets = await Promise.all([first.getNonces(), second.getNonces()]);
  const publicNonces = new Map<string, { pubNonce: Uint8Array }>();
  const sessions = [first, second];
  for (let i = 0; i < 2; i++) publicNonces.set(hex((await sessions[i].getPublicKey()).slice(1)), { pubNonce: nonceSets[i].get(tx.id)!.pubNonce });
  await Promise.all(sessions.map(session => session.aggregatedNonces(tx.id, publicNonces)));
  const partials = await Promise.all(sessions.map(session => session.sign()));
  const internal = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internal, root);
  const outputKey = keyAggregate(keys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
  const message = tx.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...outputKey])], 0, [amount]);
  const orderedNonces = keys.map(key => publicNonces.get(hex(key.slice(1)))!.pubNonce);
  const aggregate = new Session(nonceAggregate(orderedNonces), keys, message, [tweak], [true]);
  const signature = aggregate.partialSigAgg(keys.map(key => partials[originalKeys.findIndex(original => hex(original) === hex(key))].get(tx.id)!.encode()));
  assert.equal(schnorr.verify(signature, message, outputKey), true);
});

test('bound session codec rejects changed SDK layout or an already used session before overwriting its key', () => {
  const privateKey = new Uint8Array(32).fill(7);
  const changed = game.signerSession() as any, original = Uint8Array.from(changed.secretKey);
  changed.sdkUpgradeField = true;
  assert.throws(() => boundSdkSession({ signerSession: () => changed }, privateKey), /Unsupported SDK/);
  assert.deepEqual(changed.secretKey, original);
  const used = game.signerSession() as any, usedKey = Uint8Array.from(used.secretKey);
  used.myNonces = new Map();
  assert.throws(() => boundSdkSession({ signerSession: () => used }, privateKey), /Unsupported SDK/);
  assert.deepEqual(used.secretKey, usedKey);
});
