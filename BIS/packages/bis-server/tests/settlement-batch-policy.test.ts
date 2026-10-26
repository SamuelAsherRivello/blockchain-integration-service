import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, Intent, Transaction, TxTree, CosignerPublicKey, setArkPsbtField,
  Extension, createAssetPacket, type IntentCoin } from '@arkade-os/sdk';
import { tapLeafHash } from '@scure/btc-signer/payment.js';
import { keyAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { validateSettlementBatch, type TrustedSettlementBatch } from '../src/server/settlement-batch-policy.ts';

// Real SDK batch structures and key aggregation. No live batch, signed session,
// commitment broadcast or operator evidence is fabricated by these fixtures.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const other = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const gameKey = await game.compressedPublicKey(), otherKey = await other.compressedPublicKey(), hex = (v: Uint8Array) => Buffer.from(v).toString('hex');
const own = new DefaultVtxo.Script({ pubKey: gameKey.slice(1), serverPubKey: otherKey.slice(1), csvTimelock: { type: 'seconds', value: 1024n } });
const boarding = new DefaultVtxo.Script({ pubKey: gameKey.slice(1), serverPubKey: otherKey.slice(1), csvTimelock: { type: 'seconds', value: 4096n } });
const stranger = new DefaultVtxo.Script({ pubKey: otherKey.slice(1), serverPubKey: otherKey.slice(1), csvTimelock: { type: 'seconds', value: 1024n } });
const point = '11'.repeat(32) + ':0', expiry = 86528n;
const scriptRoot = tapLeafHash(CSVMultisigTapscript.encode({ pubkeys: [otherKey.slice(1)], timelock: { type: 'seconds', value: expiry } }).script);
const keys = sortKeys([gameKey, otherKey]), internal = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1);
const aggregate = keyAggregate(keys, [schnorr.utils.taggedHash('TapTweak', internal, scriptRoot)], [true]).aggPublicKey.toBytes(true).slice(1);
const sharedScript = Uint8Array.from([0x51, 0x20, ...aggregate]);

function fixture(assets = false) {
  const holdings = [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }];
  const input = { txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true }, ...(assets ? { assets: holdings } : {}) } as IntentCoin;
  const output = { amount: 15000n, script: own.pkScript };
  const registration = Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [hex(gameKey)] }, [input],
    assets ? [output, Extension.create([createAssetPacket(new Map([[1, holdings]]), [{ address: '', amount: 15000, assets: holdings }])]).txOut()] : [output]);
  const commitment = new Transaction();
  commitment.addInput({ txid: '11'.repeat(32), index: 0 });
  commitment.addOutput({ amount: 20000n, script: sharedScript });
  const leaf = new Transaction();
  leaf.addInput({ txid: commitment.id, index: 0 });
  leaf.addOutput(output);
  leaf.addOutput({ amount: 5000n, script: stranger.pkScript });
  if (assets) leaf.addOutput(Extension.create([createAssetPacket(new Map([[0, holdings]]), [{ address: '', amount: 15000, assets: holdings }, { address: '', amount: 5000 }])]).txOut());
  keys.forEach((key, index) => setArkPsbtField(leaf, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(leaf);
  const trusted: TrustedSettlementBatch = { network: 'signet', registration, sessionPublicKey: hex(gameKey), operatorPublicKey: hex(otherKey), forfeitPublicKey: hex(otherKey), batchExpiry: expiry, boardingOutpoints: [point] };
  return { tree, commitment, scriptRoot, sharedAmount: 20000n, trusted };
}

test('SDK batch validation binds root key and original recipients without treating whole shared value as Game spending', () => {
  const f = fixture(), result = validateSettlementBatch(f, f.trusted);
  assert.equal(result.commitmentId, f.commitment.id);
  assert.equal(result.sharedAmount, '20000');
  assert.deepEqual(result.transactionIds, [f.tree.root.id]);
  assert.match(result.treeDigest, /^[a-f0-9]{64}$/);
  assert.equal('exposureSats' in result, false, 'financial exposure belongs to the sealed original plan');
  assert.equal('grant' in result, false, 'structural validation is not signing authority');
  assert.equal(validateSettlementBatch({ ...f, commitment: Transaction.fromPSBT(f.commitment.toPSBT()) }, f.trusted).commitmentId, result.commitmentId);
});

test('wrong root aggregate, sweep policy, requested amount or original boarding source fails closed', () => {
  const f = fixture();
  assert.throws(() => validateSettlementBatch({ ...f, sharedAmount: 19999n }, f.trusted), /policy/);
  assert.throws(() => validateSettlementBatch({ ...f, scriptRoot: new Uint8Array(32) }, f.trusted), /policy/);
  for (const changed of [{ ...f.trusted, batchExpiry: 512n }, { ...f.trusted, forfeitPublicKey: hex(gameKey) },
    { ...f.trusted, boardingOutpoints: ['22'.repeat(32) + ':0'] }, { ...f.trusted, network: 'mainnet' as 'signet' }]) {
    assert.throws(() => validateSettlementBatch(f, changed), /policy/);
  }
  const changed = fixture(); changed.commitment.updateOutput(0, { script: own.pkScript });
  changed.tree.root.updateInput(0, { txid: changed.commitment.id });
  assert.throws(() => validateSettlementBatch(changed, changed.trusted), /policy/);
});

test('changed or missing Game recipient cannot be hidden by a valid same-value batch tree', () => {
  const f = fixture();
  f.tree.root.updateOutput(0, { script: stranger.pkScript });
  assert.throws(() => validateSettlementBatch(f, f.trusted), /policy/);
  const changed = fixture();
  changed.tree.root.updateOutput(0, { amount: 14999n }); changed.tree.root.updateOutput(1, { amount: 5001n });
  assert.throws(() => validateSettlementBatch(changed, changed.trusted), /policy/);
});

test('asset-bearing batch requires exact registered bigint output quantities', () => {
  const f = fixture(true);
  assert.equal(validateSettlementBatch(f, f.trusted).commitmentId, f.commitment.id);
  const lost = Extension.create([createAssetPacket(new Map([[0, [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }]]]), [{ address: '', amount: 15000, assets: [{ assetId: 'ab'.repeat(34), amount: 9007199254740992n }] }, { address: '', amount: 5000 }])]).txOut();
  f.tree.root.updateOutput(2, lost);
  assert.throws(() => validateSettlementBatch(f, f.trusted), /policy/);
});

test('cycles, duplicate transaction nodes, missing Game cosigner and altered root links are rejected', () => {
  const cyclic = fixture(); cyclic.tree.children.set(0, cyclic.tree);
  assert.throws(() => validateSettlementBatch(cyclic, cyclic.trusted), /policy/);
  const link = fixture(); link.tree.root.updateInput(0, { txid: 'ff'.repeat(32) });
  assert.throws(() => validateSettlementBatch(link, link.trusted), /policy/);
  const keysChanged = fixture();
  const clean = new Transaction(); clean.addInput({ txid: keysChanged.commitment.id, index: 0 });
  clean.addOutput({ amount: 15000n, script: own.pkScript }); clean.addOutput({ amount: 5000n, script: stranger.pkScript });
  setArkPsbtField(clean, 0, CosignerPublicKey, { index: 0, key: otherKey });
  assert.throws(() => validateSettlementBatch({ ...keysChanged, tree: new TxTree(clean) }, keysChanged.trusted), /policy/);
  const duplicates = fixture(); duplicates.tree.children.set(0, new TxTree(duplicates.tree.root.clone()));
  assert.throws(() => validateSettlementBatch(duplicates, duplicates.trusted), /policy/);
});

test('nested SDK tree verifies every child amount, parent link and aggregate script', () => {
  const f = fixture();
  const root = new Transaction(); root.addInput({ txid: f.commitment.id, index: 0 });
  root.addOutput({ amount: 20000n, script: sharedScript }); root.addOutput({ amount: 0n, script: Uint8Array.from([0x6a]) });
  keys.forEach((key, index) => setArkPsbtField(root, 0, CosignerPublicKey, { index, key }));
  const child = f.tree.root.clone(); child.updateInput(0, { txid: root.id, index: 0 });
  const tree = new TxTree(root, new Map([[0, new TxTree(child)]]));
  assert.deepEqual(validateSettlementBatch({ ...f, tree }, f.trusted).transactionIds, [root.id, child.id]);
  child.updateOutput(1, { amount: 4999n });
  assert.throws(() => validateSettlementBatch({ ...f, tree }, f.trusted), /policy/);
  child.updateOutput(1, { amount: 5000n });
  const wrongParent = root.clone(); wrongParent.updateOutput(0, { script: own.pkScript });
  const reconnected = child.clone(); reconnected.updateInput(0, { txid: wrongParent.id });
  const wrongTree = new TxTree(wrongParent, new Map([[0, new TxTree(reconnected)]]));
  assert.throws(() => validateSettlementBatch({ ...f, tree: wrongTree }, f.trusted), /policy/);
});
