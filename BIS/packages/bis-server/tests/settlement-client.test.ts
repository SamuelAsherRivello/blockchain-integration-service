import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, ArkAddress, Intent, Extension, createAssetPacket, verifyTapscriptSignatures, Transaction, TxTree, Wallet, CSVMultisigTapscript, CosignerPublicKey, setArkPsbtField, SettlementEventType, buildForfeitTx, type SettlementEvent, type SettleParams, type IntentCoin } from '@arkade-os/sdk';
import { tapLeafHash } from '@scure/btc-signer/payment.js';
import { keyAggregate, sortKeys, nonceAggregate, Session } from '@scure/btc-signer/musig2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { prepareServerSettlement } from '../../integration/src/client/wallet-layer-arkade/server-settlement.ts';
import { createAppWalletSession } from '../../integration/src/client/wallet-layer-arkade/app-wallet-session.ts';
import { createAppPlayerProof } from '../../integration/src/client/wallet-layer-arkade/app-player-proof.ts';
import { configureBisServer, probeGameSigner } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { createHostedHandler } from '../src/server/hosted.ts';
import type { SigningClaim, SigningStore } from '../src/server/signing-store.ts';

// SDK proof/signature parity, not a submitted batch or financial acceptance.
const phrases = ['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'legal winner thank year wave sausage worth useful legal winner thank yellow'];
const game = MnemonicIdentity.fromMnemonic(phrases[0], { isMainnet: false }), player = MnemonicIdentity.fromMnemonic(phrases[1], { isMainnet: false });
const gameKey = await game.xOnlyPublicKey(), operatorKey = await player.xOnlyPublicKey(), gamePublicKey = toHex(await game.compressedPublicKey());
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: delay } });
const offchain = script(1024n), own = script(1024n), boarding = script(4096n), gameAddress = new ArkAddress(operatorKey, offchain.pkScript.slice(2), 'tark').encode();
const coin = (): IntentCoin => ({ txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true } } as IntentCoin);
const virtualCoin = (): IntentCoin => ({ txid: '12'.repeat(32), vout: 0, value: 20000, tapTree: offchain.encode(), intentTapLeafScript: offchain.forfeit(), forfeitTapLeafScript: offchain.forfeit(), script: Buffer.from(offchain.pkScript).toString('hex'), isSwept: false, isUnrolled: false, status: { confirmed: true } } as IntentCoin);
const params = (): SettleParams => ({ inputs: [coin()], outputs: [{ address: gameAddress, amount: 15000n }] });

test('server Game wallet preserves SDK implicit settlement selection before signing', async t => {
  const endpoint = 'https://implicit-settlement.test/api/bis/';
  const profileId = Buffer.from(await crypto.subtle.digest('SHA-256', Buffer.from(gamePublicKey, 'hex'))).toString('hex');
  const fetcher: typeof fetch = async () => Response.json({ protocol: 1, network: 'signet', gameId: 'stealth-and-steel', publicKey: gamePublicKey,
    profileId, token: 'implicit-selection-fixture-token', capabilities: ['sign', 'signMessage', 'signerSession'] });
  const probe = await probeGameSigner('signet', { endpoint, fetcher });
  assert.equal(probe.status, 'connected');
  if (probe.status !== 'connected') throw Error('Fixture connection failed.');
  const vtxos = [10000, 30000, 20000].map((value, index) => ({ ...virtualCoin(), txid: `${(index + 2).toString(16).padStart(2, '0')}`.repeat(32), value } as IntentCoin));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const boardingInputs = [
    { ...coin(), txid: '44'.repeat(32), value: 40000, status: { confirmed: true, block_time: nowSeconds - 5000 } },
    { ...coin(), txid: '55'.repeat(32), value: 25000, status: { confirmed: true, block_time: nowSeconds - 50 } },
  ] as IntentCoin[];
  const exitScript = CSVMultisigTapscript.encode({ pubkeys: [gameKey], timelock: { type: 'seconds', value: 4096n } }).script;
  let captured: SettleParams | undefined;
  const wallet: any = {
    dispose: async () => {}, getAddress: async () => gameAddress,
    buildAndSubmitOffchainTx: async () => { throw Error('Not an offchain send.'); },
    settle: async (selected: SettleParams) => { captured = selected; return 'implicit-plan-captured'; },
    arkProvider: { getInfo: async () => ({ fees: { intentFee: { onchainInput: '200.0', offchainInput: '100.0', offchainOutput: '300.0' } }, vtxoMaxAmount: 70000n }) },
    boardingTapscript: { exitScript: Buffer.from(exitScript).toString('hex') },
    onchainProvider: {}, getBoardingUtxos: async () => boardingInputs, getSpendableVtxos: async () => vtxos, dustAmount: 330n,
  };
  const actualSdkSelection: { inputs: IntentCoin[]; outputs: { amount: bigint; script: Uint8Array }[]; onchainOutputIndexes: number[] } = { inputs: [], outputs: [], onchainOutputIndexes: [] };
  const stopBeforeSubmit = Error('captured SDK settlement before provider submission');
  let providerMutations = 0;
  const forbiddenMutation = () => { providerMutations++; throw Error('Unexpected provider mutation.'); };
  const sdkWallet: any = {
    getAddress: wallet.getAddress, arkProvider: { ...wallet.arkProvider, submitIntent: forbiddenMutation, registerIntent: forbiddenMutation },
    onchainProvider: { broadcastTransaction: forbiddenMutation }, boardingTapscript: wallet.boardingTapscript,
    getBoardingUtxos: wallet.getBoardingUtxos, getSpendableVtxos: wallet.getSpendableVtxos, dustAmount: wallet.dustAmount,
    identity: { signerSession: () => ({ getPublicKey: async () => Buffer.from(gamePublicKey, 'hex') }) },
    _withTxLock: (work: () => Promise<unknown>) => work(),
    recipientAddressContext: () => ({ hrp: 'tark', signerSet: { active: toHex(operatorKey), deprecated: [] } }),
    makeRegisterIntentSignature: async (inputs: IntentCoin[], outputs: { amount: bigint; script: Uint8Array }[], onchainOutputIndexes: number[]) => {
      actualSdkSelection.inputs = inputs;
      actualSdkSelection.outputs = outputs;
      actualSdkSelection.onchainOutputIndexes = onchainOutputIndexes;
      throw stopBeforeSubmit;
    },
    makeDeleteIntentSignature: async () => ({}), _settleImpl: (Wallet.prototype as any)._settleImpl,
  };
  await assert.rejects(Wallet.prototype.settle.call(sdkWallet), error => error === stopBeforeSubmit);
  assert.equal(providerMutations, 0, 'native SDK selection stops before any provider mutation');
  assert.equal(actualSdkSelection.onchainOutputIndexes.length, 0);
  const app = createAppWalletSession({ createWallet: async () => wallet });
  t.after(async () => { await app.dispose(); configureBisServer({}); });
  await app.sign('game', probe.account, new AbortController().signal, async bound => {
    assert.equal(await bound.settle(), 'implicit-plan-captured');
  });
  assert.ok(captured);
  const outpoints = (inputs: IntentCoin[]) => inputs.map(input => `${input.txid}:${input.vout}`);
  assert.deepEqual(outpoints(captured.inputs), outpoints(actualSdkSelection.inputs));
  assert.deepEqual(captured.outputs.map(output => ({ script: ArkAddress.decode(output.address).pkScript, amount: output.amount })), actualSdkSelection.outputs);
  assert.deepEqual(captured.inputs.map(input => input.value), [25000, 30000, 10000]);
  assert.deepEqual(captured.outputs, [{ address: gameAddress, amount: 64300n }]);
});

test('hosted client authorizes and Game-signs the SDK virtual-input forfeit using captured connectors', async t => {
  t.after(() => configureBisServer({}));
  const secret = 'virtual-forfeit-client-fixture-'.repeat(3), input = virtualCoin(), paths: string[] = [], claims: SigningClaim[] = [], blobs = new Map<string, string>(); let fetchError = '';
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0], BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet', BIS_PUBLIC_SETTLEMENT_SIGNING: 'true', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
    session: async (_claim, _owner, id, encrypted) => { if (encrypted !== undefined) blobs.set(id, encrypted); return blobs.get(id) ?? null; },
    claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {} };
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname; paths.push(path);
    const response = await createHostedHandler({ env, store,
      settlementContext: async () => ({ inputs: [input], gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 }),
      settlementBatchInfo: async network => ({ network, publicKey: toHex(await player.compressedPublicKey()), forfeitPublicKey: toHex(await player.compressedPublicKey()), forfeitScript: Buffer.from(boarding.pkScript).toString('hex') }) })(new Request(String(url), init));
    if (!response.ok) { fetchError = `HTTP ${response.status} at ${path}: ${await response.clone().text()}`; throw Error(fetchError); }
    return response;
  };
  configureBisServer({});
  const probe = await probeGameSigner('signet', { endpoint: 'https://client-forfeit.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected', probe.status === 'connected' ? '' : `${probe.message}; requests=${paths.join(',')}; ${fetchError}`); if (probe.status !== 'connected') throw Error('Fixture connection failed.');
  const account = { phrase: phrases[1], profileId: 'fixture-player-forfeit', network: 'signet' as const };
  const proof = createAppPlayerProof({ load: async () => ({ generation: 1, account }), scope: () => ({ phase: 'active', profileId: account.profileId, network: account.network }), subscribe: () => () => {} });
  let retainedIdentity: any;
  const app = createAppWalletSession({ playerProof: proof, createWallet: async config => ({
    dispose: async () => {}, getAddress: async () => gameAddress, buildAndSubmitOffchainTx: async () => { throw Error('Not an offchain send.'); },
    settle: async (_selected: SettleParams, callback?: (event: SettlementEvent) => Promise<void>) => {
      retainedIdentity = config.identity;
      const remote = config.identity.signerSession(), remoteKey = await remote.getPublicKey(), local = player.signerSession(), localKey = await local.getPublicKey(), keys = sortKeys([remoteKey, localKey]);
      const expiry = 86528n, root = tapLeafHash(CSVMultisigTapscript.encode({ pubkeys: [operatorKey], timelock: { type: 'seconds', value: expiry } }).script);
      const internal = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internal, root), finalKey = keyAggregate(keys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
      const commitment = new Transaction(); commitment.addInput({ txid: '34'.repeat(32), index: 0 });
      commitment.addOutput({ amount: 20000n, script: Uint8Array.from([0x51, 0x20, ...finalKey]) }); commitment.addOutput({ amount: 1000n, script: boarding.pkScript });
      const treeTx = new Transaction(); treeTx.addInput({ txid: commitment.id, index: 0 }); treeTx.addOutput({ amount: 15000n, script: offchain.pkScript }); treeTx.addOutput({ amount: 5000n, script: offchain.pkScript });
      keys.forEach((key, index) => setArkPsbtField(treeTx, 0, CosignerPublicKey, { index, key })); const tree = new TxTree(treeTx);
      const connectorTx = new Transaction(); connectorTx.addInput({ txid: commitment.id, index: 1 }); connectorTx.addOutput({ amount: 1000n, script: boarding.pkScript });
      const notifications = [callback?.({ type: SettlementEventType.BatchStarted, id: 'virtual-forfeit', batchExpiry: expiry, intentIdHashes: [] }),
        callback?.({ type: SettlementEventType.TreeSigningStarted, id: 'virtual-forfeit', cosignersPublicKeys: keys.map(key => toHex(key.slice(1))), unsignedCommitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') })];
      await remote.init(tree, root, 20000n); await local.init(tree, root, 20000n);
      const remoteNonces = await remote.getNonces(), localNonces = await local.getNonces();
      const nonces = new Map([[toHex(remoteKey.slice(1)), { pubNonce: remoteNonces.get(tree.txid).pubNonce }], [toHex(localKey.slice(1)), { pubNonce: localNonces.get(tree.txid)!.pubNonce }]]);
      await remote.aggregatedNonces(tree.txid, nonces); await local.aggregatedNonces(tree.txid, nonces);
      const partials = new Map([[toHex(remoteKey), await remote.sign()], [toHex(localKey), await local.sign()]]);
      const message = tree.root.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey])], 0, [20000n]);
      const aggregate = new Session(nonceAggregate(keys.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), keys, message, [tweak], [true]);
      assert.equal(schnorr.verify(aggregate.partialSigAgg(keys.map(key => partials.get(toHex(key))!.get(tree.txid).encode())), message, finalKey), true);
      await Promise.all(notifications);
      await callback?.({ type: 'tree_tx', id: 'virtual-forfeit', batchIndex: 1, chunk: { txid: connectorTx.id, tx: Buffer.from(connectorTx.toPSBT()).toString('base64'), children: {} } } as any);
      await callback?.({ type: SettlementEventType.BatchFinalization, id: 'virtual-forfeit', commitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') });
      const actual = buildForfeitTx([{ txid: input.txid, index: input.vout, witnessUtxo: { amount: BigInt(input.value), script: offchain.pkScript }, sighashType: 0, tapLeafScript: [input.forfeitTapLeafScript!] },
        { txid: connectorTx.id, index: 0, witnessUtxo: { amount: 1000n, script: boarding.pkScript } }], boarding.pkScript);
      assert.equal(actual.getOutput(0).amount, 21000n);
      const operatorPartial = await player.sign(actual, [0]), signed = await retainedIdentity.sign(operatorPartial, [0]);
      await verifyTapscriptSignatures(signed, 0, [toHex(gameKey)], [], [0]);
      return 'synthetic-virtual-forfeit-cryptography-not-a-network-receipt';
    }
  }) as any });
  try {
    await app.sign('game', probe.account, new AbortController().signal, async wallet => {
      assert.equal(await wallet.settle({ inputs: [input], outputs: [{ address: gameAddress, amount: 15000n }] }), 'synthetic-virtual-forfeit-cryptography-not-a-network-receipt');
    });
    assert.equal(paths.filter(path => path.endsWith('/settlement/plan')).length, 1);
    assert.equal(paths.filter(path => path.endsWith('/settlement/batch')).length, 1);
    assert.equal(paths.filter(path => path.endsWith('/settlement/finalization/authorize')).length, 1);
    assert.equal(paths.includes('/api/bis/authorize'), false);
    assert.ok(claims.length > 1); assert.ok(claims.every(claim => claim.exposureSats === 5000));
    assert.equal(new Set(claims.map(claim => claim.operationId)).size, 1);
    assert.ok(claims.some(claim => claim.settlementBatch), 'the virtual forfeit claim stays bound to the validated batch');
  } finally { await app.dispose(); }
});

test('client captures an independent SDK registration snapshot and preserves bigint assets at the real source index', () => {
  const input = coin(), assets = [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }];
  Object.assign(input, { assets });
  const original = { inputs: [input], outputs: [{ address: gameAddress, amount: 20000n }] };
  const captured = prepareServerSettlement(original, 'signet', gamePublicKey, gameAddress);
  const packet = Extension.create([createAssetPacket(new Map([[1, assets]]), [{ address: gameAddress, amount: 20000, assets }])]).txOut();
  const expected = Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [gamePublicKey] }, [input], [{ amount: 20000n, script: offchain.pkScript }, packet]);
  assert.deepEqual(captured.registerProof.toPSBT(), expected.toPSBT());
  input.txid = '22'.repeat(32); original.outputs[0].amount = 1n; assets[0].amount = 1n;
  assert.deepEqual(captured.registerProof.toPSBT(), expected.toPSBT());
  assert.deepEqual(captured.outpoints, [{ txid: '11'.repeat(32), vout: 0 }]);
});

for (const owner of [false, true]) test(`retained ${owner ? 'owner' : 'public'} client captures SDK events before batch signing across fresh handlers`, async t => {
  t.after(() => configureBisServer({}));
  const secret = 'client-batch-fixture-'.repeat(4), paths: string[] = [], claims: SigningClaim[] = [], blobs = new Map<string, string>();
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0], BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet', BIS_PUBLIC_SETTLEMENT_SIGNING: 'true', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
    session: async (_claim, _owner, id, encrypted) => { if (encrypted !== undefined) blobs.set(id, encrypted); return blobs.get(id) ?? null; },
    claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {} };
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    const response = await createHostedHandler({ env, store,
      settlementContext: async () => ({ inputs: [coin()], gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 }),
      settlementBatchInfo: async network => ({ network, publicKey: toHex(await player.compressedPublicKey()), forfeitPublicKey: toHex(await player.compressedPublicKey()), forfeitScript: Buffer.from(own.pkScript).toString('hex') }) })(new Request(String(url), init));
    if (!response.ok) throw Error(`Fixture HTTP ${response.status} at ${path}: ${await response.clone().text()}`);
    return response;
  };
  configureBisServer(owner ? { ownerToken: secret } : {});
  const connected = await probeGameSigner('signet', { endpoint: 'https://client-batch.test/api/bis/', fetcher });
  if (connected.status !== 'connected') throw Error('Fixture connection failed.');
  const account = { phrase: phrases[1], profileId: 'fixture-player', network: 'signet' as const };
  const playerProof = createAppPlayerProof({ load: async () => ({ generation: 1, account }), scope: () => ({ phase: 'active', profileId: account.profileId, network: 'signet' }), subscribe: () => () => {} });
  const observed: string[] = []; let retained: any, retainedIdentity: any;
  const app = createAppWalletSession({ playerProof, createWallet: async config => ({
    dispose: async () => {}, getAddress: async () => gameAddress, buildAndSubmitOffchainTx: async () => { throw Error('Not an offchain send.'); },
    settle: async (_params: SettleParams, callback?: (event: SettlementEvent) => Promise<void>) => {
      retainedIdentity = config.identity; retained = config.identity.signerSession();
      const remoteKey = await retained.getPublicKey(), local = player.signerSession(), localKey = await local.getPublicKey(), keys = sortKeys([remoteKey, localKey]);
      const expiry = 86528n, root = tapLeafHash(CSVMultisigTapscript.encode({ pubkeys: [operatorKey], timelock: { type: 'seconds', value: expiry } }).script);
      const internal = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internal, root), finalKey = keyAggregate(keys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
      const commitment = new Transaction(); commitment.addInput({ txid: coin().txid, index: 0 }); commitment.addOutput({ amount: 20000n, script: Uint8Array.from([0x51, 0x20, ...finalKey]) });
      const tx = new Transaction(); tx.addInput({ txid: commitment.id, index: 0 }); tx.addOutput({ amount: 15000n, script: offchain.pkScript }); tx.addOutput({ amount: 5000n, script: offchain.pkScript });
      keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key })); const tree = new TxTree(tx);
      // Match SDK behavior: invoke the callback, but do not await it.
      const notifications = [callback?.({ type: SettlementEventType.BatchStarted, id: 'original', batchExpiry: expiry, intentIdHashes: [] }),
        callback?.({ type: SettlementEventType.TreeSigningStarted, id: 'original', cosignersPublicKeys: keys.map(key => toHex(key.slice(1))), unsignedCommitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') })];
      await retained.init(tree, root, 20000n); await local.init(tree, root, 20000n);
      const remoteNonces = await retained.getNonces(), localNonces = await local.getNonces();
      const nonces = new Map([[toHex(remoteKey.slice(1)), { pubNonce: remoteNonces.get(tree.txid).pubNonce }], [toHex(localKey.slice(1)), { pubNonce: localNonces.get(tree.txid)!.pubNonce }]]);
      await retained.aggregatedNonces(tree.txid, nonces); await local.aggregatedNonces(tree.txid, nonces);
      const partials = new Map([[toHex(remoteKey), await retained.sign()], [toHex(localKey), await local.sign()]]);
      const message = tree.root.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey])], 0, [20000n]);
      const aggregator = new Session(nonceAggregate(keys.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), keys, message, [tweak], [true]);
      assert.equal(schnorr.verify(aggregator.partialSigAgg(keys.map(key => partials.get(toHex(key))!.get(tree.txid).encode())), message, finalKey), true);
      await Promise.all(notifications);
      const finalizationCommitment = commitment.clone();
      finalizationCommitment.updateInput(0, { witnessUtxo: { amount: BigInt(coin().value), script: boarding.pkScript }, tapLeafScript: [boarding.forfeit()] });
      const operatorPartial = await player.sign(finalizationCommitment, [0]);
      const finalEvent: SettlementEvent = { type: SettlementEventType.BatchFinalization, id: 'original', commitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') };
      const finalNotification = callback?.(finalEvent);
      const signedFinalization = await retainedIdentity.sign(operatorPartial, [0]);
      await verifyTapscriptSignatures(signedFinalization, 0, [toHex(gameKey)], [], [0]);
      await finalNotification;
      const before = paths.length;
      await callback?.({ type: SettlementEventType.TreeSigningStarted, id: 'replacement', cosignersPublicKeys: [toHex(remoteKey)], unsignedCommitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') });
      await assert.rejects(retained.getNonces(), /batch context changed/); assert.equal(paths.length, before);
      return 'synthetic-batch-cryptography-not-a-network-receipt';
    }
  }) as any });
  try {
    await app.sign('game', connected.account, new AbortController().signal, async wallet => {
      assert.equal(await wallet.settle(params(), async event => { observed.push(event.id); await Promise.resolve(); }), 'synthetic-batch-cryptography-not-a-network-receipt');
    });
    assert.deepEqual(observed, ['original', 'original', 'original', 'replacement']);
    const prefix = '/api/bis/' + (owner ? 'owner/' : '') + 'settlement/';
    assert.equal(paths.filter(path => path === prefix + 'plan').length, 1); assert.equal(paths.filter(path => path === prefix + 'batch').length, 1);
    assert.equal(paths.filter(path => path === prefix + 'session/authorize').length, 5);
    assert.equal(paths.filter(path => path === prefix + 'finalization/authorize').length, 1);
    assert.equal(paths.includes('/api/bis/authorize'), false);
    assert.equal(new Set(claims.map(claim => claim.operationId)).size, 1);
    assert.equal(new Set(claims.map(claim => claim.transactionId)).size, 1);
    assert.ok(claims.every(claim => claim.exposureSats === 5000));
    await assert.rejects(retained.getNonces(), /operation ended/);
  } finally { await app.dispose(); }
});

for (const owner of [false, true]) test(`retained ${owner ? 'owner' : 'public'} client pins parallel settlement proofs to one plan and lease`, async t => {
  t.after(() => configureBisServer({}));
  const secret = 'settlement-client-secret-'.repeat(3), claims: SigningClaim[] = [], paths: string[] = [];
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0], BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet', BIS_PUBLIC_SETTLEMENT_SIGNING: 'true', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false, session: async () => { throw Error('No unvalidated MuSig session.'); },
    claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {} };
  const fetcher: typeof fetch = async (url, init) => {
    paths.push(new URL(String(url)).pathname);
    return createHostedHandler({ env, store, settlementContext: async () => ({ inputs: [coin()], gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 }) })(new Request(String(url), init));
  };
  configureBisServer(owner ? { ownerToken: secret } : {});
  const probe = await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') throw Error('Fixture connection failed.');
  const playerAccount = { phrase: phrases[1], profileId: 'fixture-player', network: 'signet' as const };
  const proof = createAppPlayerProof({ load: async () => ({ generation: 1, account: playerAccount }), scope: () => ({ phase: 'active', profileId: playerAccount.profileId, network: 'signet' }), subscribe: () => () => {} });
  let retained: any, retainedSession: any, originalSettle: any;
  const app = createAppWalletSession({ playerProof: proof, createWallet: async config => {
    const wallet = { dispose: async () => {}, getAddress: async () => gameAddress, buildAndSubmitOffchainTx: async () => { throw Error('Not an offchain send.'); },
      settle: async (selected: SettleParams) => {
        retained = config.identity; retainedSession = retained.signerSession();
        const before = paths.filter(path => path.endsWith('/settlement/plan')).length;
        const sessionKey = toHex(await retainedSession.getPublicKey());
        assert.notEqual(sessionKey, gamePublicKey);
        assert.equal(paths.filter(path => path.endsWith('/settlement/plan')).length, before + 1, 'key lookup must create the original scoped plan before SDK signing');
        assert.equal(paths.some(path => path.endsWith('/authorize')), false, 'key lookup cannot create a generic owner grant');
        const register = prepareServerSettlement(selected, 'signet', sessionKey, gameAddress).registerProof;
        const deletion = Intent.create({ type: 'delete', expire_at: 0 }, selected.inputs);
        // The SDK signs these in parallel. Both must await the same plan Promise.
        const signed = await Promise.all([retained.sign(register), retained.sign(deletion)]);
        signed.push(await retained.sign(Intent.create({ type: 'get-pending-tx', expire_at: 0 }, selected.inputs)));
        for (const tx of signed) for (const vin of [0, 1]) await verifyTapscriptSignatures(tx, vin, [toHex(gameKey)], [], [1]);
        const count = paths.length;
        await assert.rejects(retainedSession.getNonces(), /validated batch authority/);
        assert.equal(paths.length, count, 'unvalidated batch signing cannot fall back to generic owner grants');
        return 'proofs-only-not-a-network-receipt';
      } };
    originalSettle = wallet.settle;
    return wallet;
  } });
  try {
    await app.sign('game', probe.account, new AbortController().signal, async wallet => {
      assert.notEqual(wallet.settle, originalSettle);
      assert.equal(await wallet.settle(params()), 'proofs-only-not-a-network-receipt');
    });
    assert.equal(app.hasActiveSigning('game'), false);
    await assert.rejects(retained.sign(prepareServerSettlement(params(), 'signet', gamePublicKey, gameAddress).registerProof), /active operation lease/);
    const before = paths.length;
    await app.sign('game', probe.account, new AbortController().signal, async () => {
      await assert.rejects(retainedSession.getPublicKey(), /operation ended/);
      await assert.rejects(retainedSession.getNonces(), /operation ended/);
    });
    assert.equal(paths.length, before);
    assert.equal(paths.filter(path => path.endsWith('/settlement/plan')).length, 1);
    assert.equal(claims.length, 3);
    assert.equal(new Set(claims.map(claim => claim.transactionId)).size, 1);
    assert.equal(new Set(claims.map(claim => claim.operationId)).size, 1);
    assert.ok(claims.every(claim => claim.exposureSats === 5000));
  } finally { await app.dispose(); }
});
