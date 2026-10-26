import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, verifyTapscriptSignatures, Extension, createAssetPacket, type ArkInfo, type VirtualCoin } from '@arkade-os/sdk';
import { readPaymentContext } from '../src/server/payment-context.ts';
import { gameContractScripts, parseGameContractIntent, validateGameContractTransaction } from '../src/server/contract-policy.ts';
import { createPaymentAuthorization } from '../src/server/payment-authorization.ts';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { decodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { authenticatePlayerProof } from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import { createHostedHandler } from '../src/server/hosted.ts';
import type { SigningStore, SigningClaim } from '../src/server/signing-store.ts';
import { createAppWalletSession } from '../../integration/src/client/wallet-layer-arkade/app-wallet-session.ts';
import { createAppPlayerProof } from '../../integration/src/client/wallet-layer-arkade/app-player-proof.ts';
import { configureBisServer, probeGameSigner } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';

// Real SDK scripts and signatures, injected fresh network facts. This is not a
// funded contract, live operator acceptance, or evidence of gameplay completion.
const phrases = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
];
const [game, player, operator] = phrases.map(phrase => MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }));
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');
const gamePublicKey = hex(await game.compressedPublicKey()), playerPublicKey = hex(await player.compressedPublicKey());
const keys = { gameKey: await game.xOnlyPublicKey(), playerKey: await player.xOnlyPublicKey(), operatorKey: await operator.xOnlyPublicKey(), exitDelay: 1024n };
const own = new DefaultVtxo.Script({ pubKey: keys.gameKey, serverPubKey: keys.operatorKey, csvTimelock: { type: 'seconds', value: keys.exitDelay } });
const unroll = CSVMultisigTapscript.encode({ pubkeys: [keys.operatorKey], timelock: { type: 'seconds', value: 86016n } });
const info = { network: 'signet', signerPubkey: hex(await operator.compressedPublicKey()), forfeitPubkey: hex(await operator.compressedPublicKey()), unilateralExitDelay: keys.exitDelay, checkpointTapscript: hex(unroll.script) } as ArkInfo;
const secretHash = createHash('sha256').update('public unfunded fixture preimage').digest('hex');

async function fixture(kind: 'fund' | 'refund', assets = false) {
  const contract = parseGameContractIntent({ kind, secretHash }), scripts = gameContractScripts(contract, own, keys);
  const outpoint = { txid: '11'.repeat(32), vout: 0 };
  const coin = { ...outpoint, value: kind === 'fund' ? 10000 : 1000, script: hex(scripts.source.pkScript), status: { confirmed: true }, createdAt: new Date(), isSpent: false, isSwept: false, isPreconfirmed: false, spentBy: '', isUnrolled: false, expiresAt: new Date('2100-01-01'), virtualStatus: { state: 'settled' }, assets: assets ? [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }] : [] } as unknown as VirtualCoin;
  const options = { network: 'signet' as const, gamePublicKey, playerPublicKey, outpoints: [outpoint], maximumExposureSats: 5000, signal: new AbortController().signal, contract, allowAssets: assets };
  const reader = { info: async () => info, coins: async () => ({ vtxos: [coin] }) };
  const context = await readPaymentContext(options, reader);
  const outputs = kind === 'fund' ? [{ amount: 1000n, script: context.recipientScript }, { amount: 9000n, script: own.pkScript }] : [{ amount: 1000n, script: own.pkScript }];
  if (assets) outputs.push(Extension.create([createAssetPacket(new Map([[0, coin.assets!]]), [{ address: '', amount: 1000 }], { address: '', amount: 9000, assets: coin.assets! })]).txOut());
  const build = () => buildOffchainTx([...context.inputs], outputs, context.serverUnrollScript);
  return { contract, context, options, reader, coin, outputs, build };
}

test('LTO funding reconstructs the exact Player/Game hashlock and signs real linked transactions', async () => {
  const f = await fixture('fund'), proposed = f.build();
  const plan = validateGameContractTransaction(proposed.arkTx, f.context, f.contract);
  assert.equal(plan.exposureSats, 1000);
  assert.equal(plan.contractPolicy, true);
  for (const tx of [plan.arkTx, ...plan.checkpoints]) {
    await verifyTapscriptSignatures(await game.sign(tx), 0, [hex(keys.gameKey)]);
  }
  const forged = proposed.arkTx.clone(); forged.updateOutput(0, { script: own.pkScript });
  assert.throws(() => validateGameContractTransaction(forged, f.context, f.contract), /policy/);
  const wrongWitness = proposed.arkTx.clone(); wrongWitness.updateInput(0, { witnessUtxo: { ...wrongWitness.getInput(0).witnessUtxo!, amount: 9999n } });
  assert.throws(() => validateGameContractTransaction(wrongWitness, f.context, f.contract), /policy/);
});

test('LTO refund proves the original contract source and returns funds only to Game, with zero net exposure', async () => {
  const f = await fixture('refund'), proposed = f.build();
  const plan = validateGameContractTransaction(proposed.arkTx, f.context, f.contract);
  assert.equal(plan.exposureSats, 0);
  for (const tx of [plan.arkTx, ...plan.checkpoints]) await verifyTapscriptSignatures(await game.sign(tx), 0, [hex(keys.gameKey)]);
  const auth = createPaymentAuthorization('contract-plan-test-secret-'.repeat(3));
  const binding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet' as const, profileId: 'aa'.repeat(32), operationId: 'refund-1', connectionId: crypto.randomUUID() };
  const token = auth.plan(binding, playerPublicKey, plan);
  for (const [index, tx] of [plan.arkTx, ...plan.checkpoints].entries()) {
    const request = { id: 'refund-sign-' + index, method: 'sign', ...binding, args: encodeSigningValue([tx, undefined]) };
    const grant = auth.authorize(token, request, binding, playerPublicKey), claim = auth.verify(grant, token, request, binding);
    assert.equal(claim.contractPolicy, true); assert.equal(claim.exposureSats, 0); assert.equal(claim.exposureId, plan.arkTx.id);
  }
  assert.throws(() => auth.plan(binding, playerPublicKey, { ...plan, contractPolicy: undefined }), /authorization/);
  const foreign = proposed.arkTx.clone(); foreign.updateOutput(0, { script: new DefaultVtxo.Script({ pubKey: keys.playerKey, serverPubKey: keys.operatorKey, csvTimelock: { type: 'seconds', value: keys.exitDelay } }).pkScript });
  assert.throws(() => validateGameContractTransaction(foreign, f.context, f.contract), /policy/);
  await assert.rejects(readPaymentContext({ ...f.options, contract: { ...f.contract, secretHash: 'ff'.repeat(32) } }, f.reader), /context/);
});

test('contract funding preserves unrelated Game assets exactly, including bigint quantities', async () => {
  const f = await fixture('fund', true);
  assert.equal(validateGameContractTransaction(f.build().arkTx, f.context, f.contract).exposureSats, 1000);
  const lost = buildOffchainTx([...f.context.inputs], f.outputs.slice(0, 2), f.context.serverUnrollScript);
  assert.throws(() => validateGameContractTransaction(lost.arkTx, f.context, f.contract), /policy/);
});

test('contract funding includes fees in the 5000-sat limit and binds fresh Player/operator scripts', async () => {
  const f = await fixture('fund');
  const payment = (amount: bigint, change: bigint) => buildOffchainTx([...f.context.inputs], [{ amount, script: f.context.recipientScript }, { amount: change, script: own.pkScript }], f.context.serverUnrollScript);
  assert.equal(validateGameContractTransaction(payment(5000n, 5000n).arkTx, f.context, f.contract).exposureSats, 5000);
  assert.equal(validateGameContractTransaction(payment(4999n, 5000n).arkTx, f.context, f.contract).exposureSats, 5000);
  assert.throws(() => validateGameContractTransaction(payment(5000n, 4999n).arkTx, f.context, f.contract), /policy/);
  assert.throws(() => validateGameContractTransaction(payment(5001n, 4999n).arkTx, f.context, f.contract), /policy/);
  const other = await readPaymentContext({ ...f.options, playerPublicKey: hex(await MnemonicIdentity.fromMnemonic('zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong', { isMainnet: false }).compressedPublicKey()) }, f.reader);
  assert.throws(() => validateGameContractTransaction(f.build().arkTx, other, f.contract), /policy/);
  await assert.rejects(readPaymentContext(f.options, { ...f.reader, info: async () => ({ ...info, network: 'mutinynet' }) }), /context/);
});

test('contract intent rejects recovery preimages, unknown operations, extra fields and malformed hashes', () => {
  for (const value of [null, [], { kind: 'claim', secretHash }, { kind: 'fund', secretHash, secretHex: 'do-not-send' }, { kind: 'fund', secretHash: 'xx'.repeat(32) }, { kind: 'fund', secretHash: 42 }]) {
    assert.throws(() => parseGameContractIntent(value), /policy/);
  }
});

test('hosted LTO policy binds Player proof, exact scope and linked signatures and honours policy revocation', async () => {
  for (const kind of ['fund', 'refund'] as const) {
    const f = await fixture(kind), proposed = f.build(), claims: SigningClaim[] = [];
    const env = { BIS_OWNER_TOKEN: 'contract-hosted-secret-'.repeat(3), BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0],
      BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_CONTRACT_SIGNING: 'true', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
    const store: SigningStore = {
      ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
      session: async () => { throw Error('Contract offchain signing does not use MuSig state.'); },
      claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {},
    };
    let contextReads = 0;
    const handler = () => createHostedHandler({ env, store, paymentContext: options => { contextReads++; return readPaymentContext(options, f.reader); } });
    const send = (path: string, body: unknown, token?: string, grant?: string) => handler()(new Request('https://example.test/api/bis/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(grant ? { 'X-BIS-Signing-Grant': grant } : {}) }, body: JSON.stringify(body),
    }));
    const connected = await (await send('connect', { gameId: 'stealth-and-steel', network: 'signet' })).json();
    const binding = { gameId: 'stealth-and-steel', network: 'signet' as const, profileId: connected.profileId, operationId: 'contract-' + kind };
    const proof = await authenticatePlayerProof({ endpoint: 'https://example.test/api/bis/', binding, identity: player, signal: new AbortController().signal, fetcher: async (url, init) => handler()(new Request(String(url), init)) });
    const raw = (tx = proposed.arkTx, id = 'root') => ({ id, ...binding, method: 'sign', args: encodeSigningValue([tx, undefined]) });
    const payload = { request: raw(), outpoints: f.options.outpoints, contract: f.contract, playerToken: proof.token };
    assert.equal((await send('payment/plan', { ...payload, playerToken: 'wrong' }, connected.token)).status, 403);
    env.BIS_PUBLIC_CONTRACT_SIGNING = 'false';
    assert.equal((await send('payment/plan', payload, connected.token)).status, 403);
    assert.equal(contextReads, 0);
    env.BIS_PUBLIC_CONTRACT_SIGNING = 'true';
    assert.equal((await send('payment/plan', { ...payload, contract: { ...f.contract, secretHex: 'must-not-transmit' } }, connected.token)).status, 403);
    const planResponse = await send('payment/plan', payload, connected.token);
    assert.equal(planResponse.status, 200, await planResponse.clone().text());
    const { paymentPlan } = await planResponse.json();
    for (const [index, tx] of [proposed.arkTx, ...proposed.checkpoints].entries()) {
      const request = { ...raw(tx, 'sign-' + index), paymentPlan };
      const grantResponse = await send('payment/authorize', { request, playerToken: proof.token }, connected.token);
      assert.equal(grantResponse.status, 200, await grantResponse.clone().text());
      const { grant } = await grantResponse.json();
      env.BIS_PUBLIC_CONTRACT_SIGNING = 'false';
      assert.equal((await send('sign', request, connected.token, grant)).status, 403);
      assert.equal(claims.length, index);
      env.BIS_PUBLIC_CONTRACT_SIGNING = 'true';
      const response = await send('sign', request, connected.token, grant);
      assert.equal(response.status, 200, await response.clone().text());
      await verifyTapscriptSignatures(decodeSigningValue((await response.json()).result), 0, [hex(keys.gameKey)]);
    }
    assert.equal(contextReads, 1);
    assert.equal(claims.length, 2);
    assert.ok(claims.every(claim => claim.exposureSats === (kind === 'fund' ? 1000 : 0) && claim.exposureId === proposed.arkTx.id));
    assert.equal(JSON.stringify(paymentPlan).includes('public unfunded fixture preimage'), false);
  }
});

test('direct client contract lease obtains public or owner plans without exporting recovery preimages', async t => {
  t.after(() => configureBisServer({}));
  for (const privateOwner of [false, true]) {
    const f = await fixture(privateOwner ? 'refund' : 'fund'), prepared = f.build(), claims: SigningClaim[] = [], calls: { path: string; body: any }[] = [];
    const ownerToken = 'direct-contract-owner-test-'.repeat(3);
    const env = { BIS_OWNER_TOKEN: ownerToken, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0], BIS_PUBLIC_PAYMENT_SIGNING: String(!privateOwner),
      BIS_PUBLIC_CONTRACT_SIGNING: String(!privateOwner), BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
    const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
      session: async () => { throw Error('No MuSig state expected.'); }, claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {} };
    const handler = () => createHostedHandler({ env, store, paymentContext: options => readPaymentContext(options, f.reader) });
    const fetcher: typeof fetch = async (url, init) => {
      const request = new Request(String(url), init);
      calls.push({ path: new URL(request.url).pathname, body: await request.clone().json() });
      return handler()(request);
    };
    configureBisServer(privateOwner ? { ownerToken } : {});
    const probe = await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher });
    assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') throw Error('No fixture signer.');
    const account = { phrase: phrases[1], profileId: 'local-player', network: 'signet' as const };
    const scope = { phase: 'active', profileId: account.profileId, network: account.network };
    const proof = createAppPlayerProof({ load: async () => ({ generation: 1, account }), scope: () => scope, subscribe: () => () => {} });
    const session = createAppWalletSession({ playerProof: proof, createWallet: async () => ({ dispose: async () => {} }) });
    let retained: Parameters<Parameters<typeof session.signContract>[2]>[0] | undefined;
    try {
      const result = await session.signContract(probe.account, new AbortController().signal, async (identity, prepare) => {
        retained = identity;
        prepare(f.options.outpoints, { ...f.contract, playerPublicKey: '02' + hex(keys.playerKey) });
        for (const tx of [prepared.arkTx, ...prepared.checkpoints]) await verifyTapscriptSignatures(await identity.sign(tx), 0, [hex(keys.gameKey)]);
        return prepared.arkTx.id;
      });
      assert.equal(result, prepared.arkTx.id);
      assert.equal(session.hasActiveSigning('game'), false);
      await assert.rejects(retained!.sign(prepared.arkTx), /active operation lease/);
      const planPath = privateOwner ? '/owner/plan' : '/payment/plan';
      const plans = calls.filter(call => call.path.endsWith(planPath));
      assert.equal(plans.length, 1);
      assert.deepEqual(plans[0].body.contract, f.contract);
      assert.equal(plans[0].body.contractPlayerPublicKey, privateOwner ? '02' + hex(keys.playerKey) : undefined);
      assert.equal(claims.length, 2);
      assert.equal(new Set(claims.map(claim => claim.operationId)).size, 1);
      assert.ok(claims.every(claim => claim.exposureSats === (privateOwner ? 0 : 1000)));
      assert.equal(JSON.stringify(calls).includes('secretHex'), false);
      assert.equal(JSON.stringify(calls).includes('public unfunded fixture preimage'), false);
      assert.equal(JSON.stringify(calls).includes(phrases[0]), false);
      assert.equal(JSON.stringify(calls).includes(phrases[1]), false);
    } finally { await session.dispose(); }
  }
});
