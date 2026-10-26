import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Intent, Transaction, type IntentCoin } from '@arkade-os/sdk';
import { RawPSBTV0 } from '@scure/btc-signer/psbt.js';
import { createSettlementAuthorization, type SettlementBinding } from '../src/server/settlement-authorization.ts';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

// Public BIP39 fixtures and real SDK proofs. No submitted settlement or receipt.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const operator = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const gamePublicKey = Buffer.from(await game.compressedPublicKey()).toString('hex');
const gameKey = await game.xOnlyPublicKey();
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: delay } });
const operatorKey = await operator.xOnlyPublicKey();
const offchain = script(1024n), boarding = script(4096n);
const inputs: IntentCoin[] = [{ txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true } } as IntentCoin];
const context = { inputs, gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 };
const binding: SettlementBinding = { audience: 'https://demo.test', gameId: 'stealth-and-steel', network: 'signet', profileId: 'a'.repeat(64), operationId: 'settlement-1', connectionId: 'connection-1' };
const message: Intent.RegisterMessage = { type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [gamePublicKey] };
const register = (amount = 15000n) => Intent.create(message, inputs, [{ amount, script: offchain.pkScript }]);
const request = (proof: Transaction, indexes: unknown = undefined) => ({ id: 'request-1', method: 'sign', network: binding.network, profileId: binding.profileId, operationId: binding.operationId, args: encodeSigningValue([proof, indexes]) });
const secret = 'settlement-test-secret-'.repeat(3);

test('cold instances authorize register, delete and status against one original reservation and fee exposure', () => {
  const first = createSettlementAuthorization(secret, () => 100000), cold = createSettlementAuthorization(secret, () => 100000);
  const plan = first.plan(binding, register(), context);
  const claims = [register(), ...(['delete', 'get-pending-tx'] as const).map(type => Intent.create({ type, expire_at: 0 }, inputs))].map(proof => {
    const body = request(proof, [0, 1]);
    return cold.verify(first.authorize(plan, body, binding), plan, body, binding);
  });
  for (const claim of claims) {
    assert.equal(claim.exposureSats, 5000);
    assert.equal(claim.settlementPolicy, true);
    assert.deepEqual(claim.inputs, [inputs[0].txid + ':0']);
    assert.deepEqual(claim, claims[0]);
  }
  // Reissuing a plan cannot produce a new ledger group for the same intent.
  const later = createSettlementAuthorization(secret, () => 100001), repeated = later.plan(binding, register(), context), body = request(register());
  assert.equal(later.verify(later.authorize(repeated, body, binding), repeated, body, binding).transactionId, claims[0].transactionId);
  const changed = first.plan(binding, register(16000n), context), changedBody = request(register(16000n));
  const changedClaim = first.verify(first.authorize(changed, changedBody, binding), changed, changedBody, binding);
  assert.notEqual(changedClaim.transactionId, claims[0].transactionId);
  assert.deepEqual(changedClaim.inputs, claims[0].inputs);
});

test('settlement rejects changed destinations, inputs, fees, indexes and unsigned global metadata', () => {
  const auth = createSettlementAuthorization(secret, () => 100000), plan = auth.plan(binding, register(), context);
  const input = register(); input.updateInput(1, { witnessUtxo: { script: boarding.pkScript, amount: 21000n } });
  const sighash = register(); sighash.updateInput(1, { sighashType: 0 });
  const raw = RawPSBTV0.decode(register().toPSBT(0));
  raw.global.genericSignedMessage = new TextEncoder().encode('changed metadata');
  const changedGlobal = Transaction.fromPSBT(RawPSBTV0.encode(raw));
  assert.equal(changedGlobal.id, register().id);
  for (const proof of [input, sighash, changedGlobal, register(16000n)]) {
    assert.throws(() => auth.authorize(plan, request(proof), binding), /authorization/);
  }
  for (const indexes of [[1], [1, 0], [0, 1, 2], 'all']) {
    assert.throws(() => auth.authorize(plan, request(register(), indexes), binding), /authorization/);
  }
  assert.throws(() => auth.plan(binding, register(14999n), context), /policy/);
  assert.throws(() => auth.plan(binding, Intent.create({ type: 'delete', expire_at: 0 }, inputs), context), /authorization/);
});

test('plans and grants bind every scope field, exact request and authority domain', () => {
  const auth = createSettlementAuthorization(secret, () => 100000), owner = createSettlementAuthorization(secret, () => 100000, 'owner');
  const plan = auth.plan(binding, register(), context), body = request(register()), grant = auth.authorize(plan, body, binding);
  for (const key of Object.keys(binding)) {
    const changed = { ...binding, [key]: key === 'network' ? 'mutinynet' : 'other' } as SettlementBinding;
    assert.throws(() => auth.authorize(plan, body, changed), /authorization/);
    assert.throws(() => auth.verify(grant, plan, body, changed), /authorization/);
  }
  for (const changed of [{ ...body, id: 'changed' }, { ...body, method: 'signMessage' }, { ...body, sessionId: 'session' }]) {
    assert.throws(() => auth.verify(grant, plan, changed, binding), /authorization/);
  }
  for (const changed of [{ ...body, method: 'signMessage' }, { ...body, sessionId: 'session' }, { ...body, network: 'mutinynet' }]) {
    assert.throws(() => auth.authorize(plan, changed, binding), /authorization/);
  }
  assert.throws(() => owner.authorize(plan, body, binding), /authorization/);
  assert.throws(() => owner.verify(grant, plan, body, binding), /authorization/);
  assert.throws(() => auth.verify(grant + 'x', plan, body, binding), /authorization/);
  assert.throws(() => auth.authorize(plan + 'x', body, binding), /authorization/);
  assert.throws(() => createSettlementAuthorization(undefined).plan(binding, register(), context), /authorization/);
  assert.throws(() => createSettlementAuthorization(secret + 'rotated', () => 100000).authorize(plan, body, binding), /authorization/);
});

test('grant expires after a minute and its original plan after ten minutes', () => {
  let time = 100000;
  const auth = createSettlementAuthorization(secret, () => time), plan = auth.plan(binding, register(), context), body = request(register()), grant = auth.authorize(plan, body, binding);
  time += 60000;
  assert.throws(() => auth.verify(grant, plan, body, binding), /authorization/);
  assert.doesNotThrow(() => auth.authorize(plan, body, binding));
  time += 540000;
  assert.throws(() => auth.authorize(plan, body, binding), /authorization/);
});

test('operation plan seals its derived session key and actual registration while retaining Game proof ownership', async () => {
  const auth = createSettlementAuthorization(secret, () => 100000), cold = createSettlementAuthorization(secret, () => 100000);
  const prepared = await auth.operationPlan(binding, register(), context);
  assert.notEqual(prepared.sessionPublicKey, gamePublicKey);
  const original = await cold.sessionIdentity(prepared.plan, binding);
  assert.equal(Buffer.from(await original.identity.compressedPublicKey()).toString('hex'), prepared.sessionPublicKey);
  assert.equal(Buffer.from(await original.identity.signerSession().getPublicKey()).toString('hex'), prepared.sessionPublicKey);
  const message = JSON.parse(new TextDecoder().decode(RawPSBTV0.decode(original.registration.toPSBT(0)).global.genericSignedMessage));
  assert.deepEqual(message.cosigners_public_keys, [prepared.sessionPublicKey]);
  const body = request(original.registration), grant = auth.authorize(prepared.plan, body, binding);
  const claim = cold.verify(grant, prepared.plan, body, binding);
  assert.equal(claim.transactionId, original.reservationId);
  assert.equal(claim.exposureSats, 5000);
  assert.deepEqual(claim.inputs, [inputs[0].txid + ':0']);
  assert.throws(() => auth.authorize(prepared.plan, request(register()), binding), /authorization/, 'Game-key placeholder is not the final registration');
  const signed = await game.sign(original.registration, [0, 1]);
  assert.doesNotThrow(() => auth.authorize(prepared.plan, request(signed), binding));
  // The session-only capability does not expose wallet signing or key export.
  assert.equal('sign' in original.identity, false); assert.equal('toHex' in original.identity, false);
  const repeat = await cold.operationPlan(binding, register(), context);
  assert.equal(repeat.sessionPublicKey, prepared.sessionPublicKey);
  const different = await cold.operationPlan(binding, register(16000n), context);
  assert.notEqual(different.sessionPublicKey, prepared.sessionPublicKey);
  const changed = await cold.sessionIdentity(different.plan, binding);
  assert.notEqual(changed.reservationId, original.reservationId);
  await assert.rejects(cold.sessionIdentity(prepared.plan, { ...binding, operationId: 'another' }), /authorization/);
  await assert.rejects(createSettlementAuthorization(secret, () => 100000, 'owner').sessionIdentity(prepared.plan, binding), /authorization/);
  await assert.rejects(cold.sessionIdentity(auth.plan(binding, register(), context), binding), /authorization/, 'legacy proof plans never imply session authority');
});
