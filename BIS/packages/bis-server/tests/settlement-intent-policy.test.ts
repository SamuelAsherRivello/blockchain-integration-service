import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Intent, Extension, createAssetPacket, verifyTapscriptSignatures, type IntentCoin, type Recipient } from '@arkade-os/sdk';
import { validateSettlementIntent, type TrustedSettlementContext } from '../src/server/settlement-intent-policy.ts';

// Actual SDK Intent.create and signatures with trusted fixture sources. No
// registration, batch signing, submitted transfer or financial receipt is faked.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const operator = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const gameKey = await game.xOnlyPublicKey(), operatorKey = await operator.xOnlyPublicKey(), gamePublicKey = hex(await game.compressedPublicKey());
const script = (delay: bigint, key = gameKey) => new DefaultVtxo.Script({ pubKey: key, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: delay } });
const offchain = script(1024n), boarding = script(4096n), stranger = script(1024n, await MnemonicIdentity.fromMnemonic('letter advice cage absurd amount doctor acoustic avoid letter advice cage above', { isMainnet: false }).xOnlyPublicKey());
const coin = (source = boarding, value = 20000, assets: { assetId: string; amount: bigint }[] = []) => ({
  txid: '11'.repeat(32), vout: 0, value, tapTree: source.encode(), intentTapLeafScript: source.forfeit(), status: { confirmed: true }, assets,
} as IntentCoin);
const context = (inputs = [coin()]): TrustedSettlementContext => ({ inputs, gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 });
const message = (onchain: number[] = [], offchainOutput = true): Intent.RegisterMessage => ({ type: 'register', onchain_output_indexes: onchain, valid_at: 0, expire_at: 0, cosigners_public_keys: offchainOutput ? [gamePublicKey] : [] });

test('real SDK boarding and offboarding ownership proofs count net fees, not their gross 20000-sat source', async () => {
  for (const toArkade of [true, false]) {
    const trusted = context([coin(toArkade ? boarding : offchain)]), msg = message(toArkade ? [] : [0], toArkade);
    const proof = Intent.create(msg, [...trusted.inputs], [{ amount: 20000n, script: toArkade ? offchain.pkScript : boarding.pkScript }]);
    const verified = validateSettlementIntent(proof, trusted);
    assert.equal(verified.kind, 'register'); assert.equal(verified.exposureSats, 0);
    assert.deepEqual(verified.sourceOutpoints, ['11'.repeat(32) + ':0']);
    const signed = await game.sign(proof, [0, 1]);
    validateSettlementIntent(signed, trusted);
    for (const index of [0, 1]) await verifyTapscriptSignatures(signed, index, [hex(gameKey)], [], [1]);
  }
});

test('settlement intent fees obey the 5000-sat operation ceiling and cannot forge source amounts', () => {
  const trusted = context();
  const proof = (amount: bigint) => Intent.create(message(), [...trusted.inputs], [{ amount, script: offchain.pkScript }]);
  assert.equal(validateSettlementIntent(proof(15000n), trusted).exposureSats, 5000);
  assert.throws(() => validateSettlementIntent(proof(14999n), trusted), /policy/);
  assert.throws(() => validateSettlementIntent(proof(20001n), trusted), /policy/);
  const forged = proof(20000n); forged.updateInput(1, { witnessUtxo: { script: boarding.pkScript, amount: 25000n } });
  assert.throws(() => validateSettlementIntent(forged, trusted), /policy/);
  assert.throws(() => validateSettlementIntent(proof(20000n), { ...trusted, maximumExposureSats: 5001 }), /policy/);
});

test('delete and pending-status proofs have no transfer exposure but must retain their exact SDK intent', () => {
  const trusted = context();
  for (const type of ['delete', 'get-pending-tx'] as const) {
    const proof = Intent.create({ type, expire_at: 0 }, [...trusted.inputs]);
    const verified = validateSettlementIntent(proof, trusted);
    assert.equal(verified.kind, type); assert.equal(verified.exposureSats, 0);
    const changed = proof.clone(); changed.updateOutput(0, { amount: 1n });
    assert.throws(() => validateSettlementIntent(changed, trusted), /policy/);
  }
});

test('register proof permits only properly classified Game destinations and the exact Game cosigner', () => {
  const trusted = context();
  for (const [msg, output] of [
    [message(), { amount: 20000n, script: stranger.pkScript }],
    [message([0], false), { amount: 20000n, script: offchain.pkScript }],
    [message([], false), { amount: 20000n, script: offchain.pkScript }],
    [{ ...message(), cosigners_public_keys: ['02' + 'aa'.repeat(32)] }, { amount: 20000n, script: offchain.pkScript }],
    [message([1]), { amount: 20000n, script: offchain.pkScript }],
    [message([0, 0], false), { amount: 20000n, script: boarding.pkScript }],
  ] as const) {
    assert.throws(() => validateSettlementIntent(Intent.create(msg, [...trusted.inputs], [output]), trusted), /policy/);
  }
});

test('settlement preserves typed Game assets above 2^53 using real source indexes after synthetic input 0', () => {
  const holdings = [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }], trusted = context([coin(offchain, 20000, holdings)]);
  const outputs = [{ amount: 10000n, script: boarding.pkScript }, { amount: 10000n, script: offchain.pkScript }];
  const recipients: Recipient[] = [{ address: '', amount: 10000 }, { address: '', amount: 10000, assets: holdings }];
  const packet = Extension.create([createAssetPacket(new Map([[1, holdings]]), recipients)]).txOut();
  const proof = Intent.create(message([0]), [...trusted.inputs], [...outputs, packet]);
  assert.equal(validateSettlementIntent(proof, trusted).exposureSats, 0);
  assert.throws(() => validateSettlementIntent(Intent.create(message([0]), [...trusted.inputs], outputs), trusted), /policy/);
  const wrongIndex = Extension.create([createAssetPacket(new Map([[0, holdings]]), recipients)]).txOut();
  assert.throws(() => validateSettlementIntent(Intent.create(message([0]), [...trusted.inputs], [...outputs, wrongIndex]), trusted), /policy/);
  const lost = Extension.create([createAssetPacket(new Map([[1, holdings]]), [{ ...recipients[0] }, { ...recipients[1], assets: [{ ...holdings[0], amount: holdings[0].amount - 1n }] }])]).txOut();
  assert.throws(() => validateSettlementIntent(Intent.create(message([0]), [...trusted.inputs], [...outputs, lost]), trusted), /policy/);
});

test('arbitrary messages, future timing, extra authority fields, duplicate sources and foreign scripts fail closed', () => {
  const trusted = context(), outputs = [{ amount: 20000n, script: offchain.pkScript }];
  for (const msg of ['sign this arbitrary message', JSON.stringify({ ...message(), approved: true }), JSON.stringify({ ...message(), expire_at: 123 }), JSON.stringify({ ...message(), valid_at: 123 }), JSON.stringify({ type: 'register' }), JSON.stringify({ type: 'unknown', expire_at: 0 })]) {
    assert.throws(() => validateSettlementIntent(Intent.create(msg, [...trusted.inputs], outputs), trusted), /policy/);
  }
  const actual = Intent.create(message(), [...trusted.inputs], outputs);
  assert.throws(() => validateSettlementIntent(actual, context([coin(), coin()])), /policy/);
  assert.throws(() => validateSettlementIntent(actual, context([coin(stranger)])), /policy/);
  const badHash = actual.clone(); badHash.updateInput(0, { txid: 'ff'.repeat(32) });
  assert.throws(() => validateSettlementIntent(badHash, trusted), /policy/);
});
