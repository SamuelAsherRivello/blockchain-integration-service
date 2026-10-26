import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, Transaction } from '@arkade-os/sdk';
import { validateOffchainPayment, assertCanonicalSigningTransaction, type TrustedPaymentContext } from '../src/server/offchain-policy.ts';
import { createPaymentAuthorization } from '../src/server/payment-authorization.ts';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { validateOwnerOffchain } from '../src/server/owner-offchain-policy.ts';

const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const operator = (await player.xOnlyPublicKey()).slice();
const script = async (identity: typeof game) => new DefaultVtxo.Script({ pubKey: await identity.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const change = await script(game), recipient = await script(player);
const context: TrustedPaymentContext = {
  inputs: [{ txid: '11'.repeat(32), vout: 0, value: 10000, tapTree: change.encode(), tapLeafScript: change.forfeit(), assets: [] }],
  changeScript: change.pkScript, recipientScript: recipient.pkScript,
  serverUnrollScript: CSVMultisigTapscript.encode({ pubkeys: [operator], timelock: { type: 'seconds', value: 512n } }), maximumExposureSats: 1000,
};
const build = (payment = 600n, changeAmount = 9400n) => buildOffchainTx([...context.inputs], [{ amount: payment, script: recipient.pkScript }, { amount: changeAmount, script: change.pkScript }], context.serverUnrollScript);

test('approved 5000-sat ceiling includes fees, excludes change and survives sealed linked signing', async () => {
  const trusted = { ...context, maximumExposureSats: 5000 };
  const binding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet' as const, profileId: 'aa'.repeat(32), operationId: 'cap-5000', connectionId: crypto.randomUUID() };
  for (const authority of ['player', 'owner'] as const) {
    const validate = authority === 'player' ? validateOffchainPayment : validateOwnerOffchain;
    const validated = validate(build(5000n, 5000n).arkTx, trusted);
    assert.equal(validated.exposureSats, 5000);
    assert.equal(validate(build(4999n, 5000n).arkTx, trusted).exposureSats, 5000);
    assert.throws(() => validate(build(5000n, 4999n).arkTx, trusted), /policy/);
    assert.throws(() => validate(build(5001n, 4999n).arkTx, trusted), /policy/);
    assert.throws(() => validate(build().arkTx, { ...trusted, maximumExposureSats: 5001 }), /policy/);
    const auth = createPaymentAuthorization('approved-cap-test-secret-'.repeat(3), Date.now, authority);
    const key = authority === 'player' ? Buffer.from(await player.compressedPublicKey()).toString('hex') : undefined;
    const plan = auth.plan(binding, key, validated);
    for (const [index, tx] of [validated.arkTx, ...validated.checkpoints].entries()) {
      const request = { id: 'cap-sign-' + index, method: 'sign', ...binding, args: encodeSigningValue([tx, undefined]) };
      const grant = auth.authorize(plan, request, binding, key);
      const claim = auth.verify(grant, plan, request, binding);
      assert.equal(claim.exposureSats, 5000);
      assert.equal(claim.exposureId, validated.arkTx.id);
      assert.equal(claim.transactionId, validated.arkTx.id);
    }
  }
});

test('sealed payment plans carry a verified receipt reservation through root and checkpoint signing claims', async()=>{
  const auth=createPaymentAuthorization('receipt-claim-test-secret-'.repeat(3)),validated=validateOffchainPayment(build().arkTx,context);
  const binding={audience:'https://example.test',gameId:'stealth-and-steel',network:'signet' as const,profileId:'aa'.repeat(32),operationId:'receipt-1',connectionId:crypto.randomUUID()};
  const publicKey=Buffer.from(await player.compressedPublicKey()).toString('hex'),receiptKey='marketplace-payment:'+'bb'.repeat(32)+':0';
  const plan=auth.plan(binding,publicKey,{...validated,receiptKeys:[receiptKey]});
  for(const [index,tx] of [validated.arkTx,...validated.checkpoints].entries()){
    const request={id:'request-'+index,method:'sign',network:binding.network,profileId:binding.profileId,operationId:binding.operationId,args:encodeSigningValue([tx,undefined])};
    const grant=auth.authorize(plan,request,binding,publicKey),claim=auth.verify(grant,plan,request,binding);
    assert.ok(claim.inputs.includes(receiptKey));
    assert.equal(claim.transactionId,validated.arkTx.id);
    assert.equal(claim.inputs.filter(key=>key===receiptKey).length,1);
  }
  assert.throws(()=>auth.plan(binding,publicKey,{...validated,receiptKeys:['untrusted']}),/authorization/);
  assert.throws(()=>auth.plan(binding,publicKey,{...validated,receiptKeys:[receiptKey,receiptKey]}),/authorization/);
  assert.throws(()=>createPaymentAuthorization('receipt-claim-test-secret-'.repeat(3),Date.now,'owner').plan(binding,undefined,{...validated,receiptKeys:[receiptKey]}),/authorization/);
});

test('payment policy reconstructs real SDK root and checkpoints and counts only verified net exposure', async () => {
  const actual = build(), plan = validateOffchainPayment(actual.arkTx, context);
  validateOffchainPayment(Transaction.fromPSBT(actual.arkTx.toPSBT()), context);
  assert.equal(plan.exposureSats, 600);
  assert.equal(plan.recipientSats, 600);
  assert.deepEqual(plan.sourceOutpoints, ['11'.repeat(32) + ':0']);
  assert.equal(plan.arkTx.id, actual.arkTx.id);
  assert.equal(plan.checkpoints.length, 1);
  assertCanonicalSigningTransaction(actual.checkpoints[0], plan.checkpoints[0]);
  const signed = await game.sign(actual.arkTx);
  assertCanonicalSigningTransaction(signed, plan.arkTx);
  const checkpoint = await game.sign(actual.checkpoints[0]);
  assertCanonicalSigningTransaction(checkpoint, plan.checkpoints[0]);
});

test('payment plus fee consumes the cap while the same checkpoint never becomes an unrelated payment', () => {
  assert.equal(validateOffchainPayment(build(600n, 9300n).arkTx, context).exposureSats, 700);
  assert.equal(validateOffchainPayment(build(1000n, 9000n).arkTx, context).exposureSats, 1000);
  assert.throws(() => validateOffchainPayment(build(1000n, 8999n).arkTx, context), /policy/);
  assert.throws(() => validateOffchainPayment(build(1100n, 8900n).arkTx, context), /policy/);
  assert.throws(() => validateOffchainPayment(build(600n, 9500n).arkTx, context), /policy/);
  assert.throws(() => validateOffchainPayment(build().checkpoints[0], context), /policy/);
});

test('forged witness value, sighash, tapleaf, source outpoint or checkpoint output cannot pass reconstruction', () => {
  const mutations = [
    (tx: Transaction) => tx.updateInput(0, { witnessUtxo: { script: tx.getInput(0).witnessUtxo!.script, amount: 9999n } }),
    (tx: Transaction) => tx.updateInput(0, { sighashType: 2 }),
    (tx: Transaction) => tx.updateInput(0, { index: 1 }),
    (tx: Transaction) => tx.updateInput(0, { tapLeafScript: [recipient.forfeit()] }),
  ];
  for (const mutate of mutations) {
    const actual = build();
    assert.throws(() => { mutate(actual.arkTx); validateOffchainPayment(actual.arkTx, context); }, /policy|Taproot commitment/);
  }
  const actual = build(), checkpoint = actual.checkpoints[0].clone();
  checkpoint.updateOutput(0, { amount: 9000n });
  assert.throws(() => assertCanonicalSigningTransaction(checkpoint, actual.checkpoints[0]), /policy/);
});

test('unverified recipient/change, assets, duplicate inputs, extra outputs and forged P2A fail closed', () => {
  const actual = build();
  assert.throws(() => validateOffchainPayment(actual.arkTx, { ...context, recipientScript: new Uint8Array([0x51]) }), /policy/);
  assert.throws(() => validateOffchainPayment(actual.arkTx, { ...context, changeScript: recipient.pkScript }), /policy/);
  assert.throws(() => validateOffchainPayment(actual.arkTx, { ...context, inputs: context.inputs.map(input => ({ ...input, assets: [{ assetId: 'asset', amount: 1n }] })) }), /policy/);
  assert.throws(() => validateOffchainPayment(actual.arkTx, { ...context, inputs: [...context.inputs, ...context.inputs] }), /policy/);
  const extra = actual.arkTx.clone(); extra.addOutput({ script: new Uint8Array([0x6a]), amount: 0n });
  assert.throws(() => validateOffchainPayment(extra, context), /policy/);
  const anchor = actual.arkTx.clone(); anchor.updateOutput(anchor.outputsLength - 1, { amount: 1n });
  assert.throws(() => validateOffchainPayment(anchor, context), /policy/);
});
