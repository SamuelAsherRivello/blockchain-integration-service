import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Transaction, TxTree, buildForfeitTx, verifyTapscriptSignatures, type IntentCoin } from '@arkade-os/sdk';
import { settlementFinalizationSources, validateSettlementFinalization, type TrustedSettlementFinalization } from '../src/server/settlement-finalization-policy.ts';

// Actual SDK reconstruction and cryptography. These are public unfunded
// fixtures, not submitted commitments, operator receipts or financial acceptance.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const operator = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const key = await game.xOnlyPublicKey(), operatorKey = await operator.xOnlyPublicKey(), hex = (v: Uint8Array) => Buffer.from(v).toString('hex');
const script = (value: bigint, pubKey = key) => new DefaultVtxo.Script({ pubKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value } });
const own = script(1024n), boarding = script(4096n), other = script(1024n, operatorKey);
const leaf = (which: 'boarding' | 'virtual', txid = '11'.repeat(32), value = 20000): IntentCoin => {
  const selected = which === 'boarding' ? boarding : own;
  return { txid, vout: 0, value, tapTree: selected.encode(), intentTapLeafScript: selected.forfeit(), forfeitTapLeafScript: selected.forfeit(), status: { confirmed: true },
    ...(which === 'virtual' ? { script: hex(own.pkScript), isSwept: false, isUnrolled: false } : {}) } as IntentCoin;
};

function fixture(inputs: IntentCoin[] = [leaf('boarding')]) {
  const commitment = new Transaction();
  commitment.addInput({ txid: 'ff'.repeat(32), index: 0, witnessUtxo: { amount: 30000n, script: other.pkScript }, tapLeafScript: [other.forfeit()] });
  for (const input of inputs.filter(input => hex(input.tapTree) === hex(boarding.encode()))) commitment.addInput({ txid: input.txid, index: input.vout,
    witnessUtxo: { amount: BigInt(input.value), script: boarding.pkScript }, tapLeafScript: [boarding.forfeit()] });
  commitment.addOutput({ amount: 20000n, script: own.pkScript }); commitment.addOutput({ amount: 1000n, script: other.pkScript });
  const connector = new Transaction(); connector.addInput({ txid: commitment.id, index: 1 }); connector.addOutput({ amount: 1000n, script: other.pkScript }); connector.addOutput({ amount: 0n, script: Uint8Array.of(0x6a) });
  const connectors = new TxTree(connector);
  const trusted: TrustedSettlementFinalization = { commitmentId: commitment.id, sources: settlementFinalizationSources(inputs, boarding.pkScript, own.pkScript), dustAmount: 330n, forfeitScript: other.pkScript };
  return { commitment, connectors, trusted };
}
const forfeit = (f: ReturnType<typeof fixture>, index = 0) => {
  const source = f.trusted.sources.filter(source => source.kind === 'virtual')[index], connector = f.connectors.leaves()[index], output = connector.getOutput(0);
  return buildForfeitTx([{ txid: source.txid, index: source.vout, witnessUtxo: { amount: BigInt(source.value), script: source.script }, sighashType: 0, tapLeafScript: [source.forfeitTapLeafScript] },
    { txid: connector.id, index: 0, witnessUtxo: { amount: output.amount!, script: output.script! } }], f.trusted.forfeitScript);
};

test('Game boarding commitment signatures use only original selected inputs and retain foreign partial signatures', async () => {
  const f = fixture(), actual = await operator.sign(f.commitment, [0]);
  const foreign = actual.getInput(0).tapScriptSig;
  assert.deepEqual(validateSettlementFinalization(actual, [1], f, f.trusted), { kind: 'commitment', indexes: [1] });
  const signed = await game.sign(actual, [1]);
  assert.deepEqual(signed.getInput(0).tapScriptSig, foreign);
  await verifyTapscriptSignatures(signed, 0, [hex(operatorKey)], [], [0]);
  await verifyTapscriptSignatures(signed, 1, [hex(key)], [], [0]);
  validateSettlementFinalization(signed, [1], f, f.trusted);
  assert.throws(() => validateSettlementFinalization(actual, [0], f, f.trusted), /policy/);
  assert.throws(() => validateSettlementFinalization(actual, undefined, f, f.trusted), /policy/);
});

test('multiple boarding sources support successive SDK input signing without signing foreign inputs', async () => {
  const f = fixture([leaf('boarding'), leaf('boarding', '22'.repeat(32), 50000)]);
  let signed = f.commitment;
  for (const index of [1, 2]) {
    validateSettlementFinalization(signed, [index], f, f.trusted); signed = await game.sign(signed, [index]);
  }
  for (const index of [1, 2]) await verifyTapscriptSignatures(signed, index, [hex(key)], [], [0]);
  assert.deepEqual(validateSettlementFinalization(signed, [1, 2], f, f.trusted).indexes, [1, 2]);
  assert.throws(() => validateSettlementFinalization(signed, [2, 1], f, f.trusted), /policy/);
});

test('same transaction ID cannot hide changed Game witness amount, script path, sighash or PSBT metadata', () => {
  const f = fixture();
  for (const change of [
    { witnessUtxo: { amount: 20001n, script: boarding.pkScript } },
    { witnessUtxo: { amount: 20000n, script: own.pkScript } },
    { tapLeafScript: [own.forfeit()] }, { sighashType: 1 },
    { unknown: [[{ type: 222, key: new Uint8Array() }, Uint8Array.of(1)]] }
  ]) {
    assert.throws(() => {
      const tx = f.commitment.clone(); tx.updateInput(1, change as any);
      assert.equal(tx.id, f.commitment.id);
      validateSettlementFinalization(tx, [1], f, f.trusted);
    }, /policy|Taproot commitment/);
  }
});

test('changed commitment, duplicate or missing original boarding sources and virtual Bitcoin inputs are refused', () => {
  const f = fixture(), changed = f.commitment.clone(); changed.updateOutput(0, { amount: 19999n });
  assert.throws(() => validateSettlementFinalization(changed, [1], { ...f, commitment: changed }, f.trusted), /policy/);
  const missing = fixture([leaf('boarding', '22'.repeat(32))]);
  assert.throws(() => validateSettlementFinalization(f.commitment, [1], f, { ...f.trusted, sources: missing.trusted.sources }), /policy/);
  assert.throws(() => validateSettlementFinalization(f.commitment, [1], f, { ...f.trusted, sources: [...f.trusted.sources, ...f.trusted.sources] }), /policy/);
  assert.throws(() => validateSettlementFinalization(f.commitment, [1], f, { ...f.trusted, sources: [{ ...f.trusted.sources[0], kind: 'virtual' }] }), /policy/);
});

test('real SDK forfeit to the fixed operator reconstructs exactly and yields a verifiable Game signature', async () => {
  const f = fixture([leaf('virtual')]), actual = forfeit(f);
  assert.deepEqual(validateSettlementFinalization(actual, [0], f, f.trusted), { kind: 'forfeit', indexes: [0] });
  const signed = await game.sign(actual, [0]);
  await verifyTapscriptSignatures(signed, 0, [hex(key)], [], [0]); validateSettlementFinalization(signed, [0], f, f.trusted);
  assert.equal(actual.getOutput(0).amount, 21000n, 'gross forfeit value is not an additional spending charge');
  assert.throws(() => validateSettlementFinalization(actual, [1], f, f.trusted), /policy/);
  assert.throws(() => validateSettlementFinalization(actual, [0, 1], f, f.trusted), /policy/);
});

test('forfeit cannot substitute destination, connector value/reference, source, sighash or P2A output', () => {
  const f = fixture([leaf('virtual')]);
  for (const mutate of [
    (tx: Transaction) => tx.updateOutput(0, { script: own.pkScript }),
    (tx: Transaction) => tx.updateInput(1, { witnessUtxo: { amount: 999n, script: other.pkScript } }),
    (tx: Transaction) => tx.updateInput(1, { txid: 'ee'.repeat(32) }),
    (tx: Transaction) => tx.updateInput(0, { txid: 'dd'.repeat(32) }),
    (tx: Transaction) => tx.updateInput(0, { sighashType: 1 }),
    (tx: Transaction) => tx.updateOutput(1, { amount: 1n })
  ]) {
    const actual = forfeit(f); mutate(actual); assert.throws(() => validateSettlementFinalization(actual, [0], f, f.trusted), /policy/);
  }
});

test('connectors must link to the original commitment and conserve its connector output before Game signing', () => {
  const f = fixture([leaf('virtual')]), actual = forfeit(f);
  const wrong = fixture([leaf('virtual')]); wrong.connectors.root.updateInput(0, { index: 0 });
  assert.throws(() => validateSettlementFinalization(actual, [0], { ...f, connectors: wrong.connectors }, f.trusted), /policy/);
  const value = fixture([leaf('virtual')]); value.connectors.root.updateOutput(0, { amount: 999n });
  assert.throws(() => validateSettlementFinalization(actual, [0], { ...f, connectors: value.connectors }, f.trusted), /policy/);
  const cycle = fixture([leaf('virtual')]); cycle.connectors.children.set(0, cycle.connectors);
  assert.throws(() => validateSettlementFinalization(actual, [0], { ...f, connectors: cycle.connectors }, f.trusted), /policy/);
  assert.throws(() => validateSettlementFinalization(actual, [0], { commitment: f.commitment }, f.trusted), /policy/);
});

test('subdust virtual coins and unverified foreign source scripts cannot acquire finalization authority', () => {
  const f = fixture([leaf('virtual', '11'.repeat(32), 329)]), actual = forfeit(f);
  assert.throws(() => validateSettlementFinalization(actual, [0], f, f.trusted), /policy/);
  const foreign = leaf('virtual'); foreign.tapTree = other.encode();
  assert.throws(() => settlementFinalizationSources([foreign], boarding.pkScript, own.pkScript), /policy/);
  assert.throws(() => validateSettlementFinalization(actual, [0], f, { ...f.trusted, dustAmount: 0n }), /policy/);
});
