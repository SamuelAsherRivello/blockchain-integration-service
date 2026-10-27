import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, Intent, Transaction, TxTree, CosignerPublicKey, setArkPsbtField, verifyTapscriptSignatures, type IntentCoin } from '@arkade-os/sdk';
import { tapLeafHash } from '@scure/btc-signer/payment.js';
import { keyAggregate, sortKeys, nonceAggregate, Session } from '@scure/btc-signer/musig2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { createHostedHandler } from '../src/server/hosted.ts';
import type { SigningClaim, SigningStore } from '../src/server/signing-store.ts';
import { authenticatePlayerProof } from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import { encodeSigningValue, decodeSigningValue, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

// Fresh HTTP handlers and real cryptography. Injected operator facts/store model
// are NOT live provider receipts, real Redis or deployed Vercel acceptance.
const phrases = ['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'legal winner thank year wave sausage worth useful legal winner thank yellow'];
const game = MnemonicIdentity.fromMnemonic(phrases[0], { isMainnet: false }), operator = MnemonicIdentity.fromMnemonic(phrases[1], { isMainnet: false });
const gameKey = await game.xOnlyPublicKey(), operatorKey = await operator.xOnlyPublicKey(), gamePublicKey = toHex(await game.compressedPublicKey()), operatorPublicKey = toHex(await operator.compressedPublicKey());
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: delay } });
const own = script(1024n), boarding = script(4096n), input = { txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true } } as IntentCoin;
const intent = (key: string) => Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [key] }, [input], [{ amount: 15000n, script: own.pkScript }]);

for (const owner of [false, true]) test(`hosted ${owner ? 'owner' : 'public'} batch grants complete bound cold-session MuSig without changing Game proof ownership`, async () => {
  const secret = 'hosted-batch-grant-fixture-'.repeat(3);
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0], BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet', BIS_PUBLIC_SETTLEMENT_SIGNING: 'true', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const blobs = new Map<string, string>(), batchPins = new Map<string, string>(), rows = new Map<string, { digest: string; done: boolean; result?: unknown }>(), charges = new Set<string>(), claims: SigningClaim[] = [];
  let lock: string | undefined, cost = 0, writes = 0, infoReads = 0, advertised: bigint | undefined;
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
    claim: async claim => {
      const prior = rows.get(claim.id);
      if (prior) { if (prior.digest !== claim.digest || !prior.done) throw Error('unresolved'); return { status: 'replay', result: prior.result }; }
      if (lock) throw Error('busy');
      if (claim.settlementBatch) {
        const b = claim.settlementBatch;
        if (batchPins.has(b.reservationId) && batchPins.get(b.reservationId) !== b.digest) throw Error('batch-conflict');
      }
      const extra = charges.has(claim.exposureId!) ? 0 : claim.exposureSats;
      if (cost + extra > 5000) throw Error('budget');
      cost += extra; charges.add(claim.exposureId!);
      if (claim.settlementBatch) batchPins.set(claim.settlementBatch.reservationId, claim.settlementBatch.digest);
      claims.push(claim); rows.set(claim.id, { digest: claim.digest, done: false }); lock = claim.id;
      return { status: 'acquired', owner: claim.id };
    },
    complete: async (claim, holder, result) => { assert.equal(lock, holder); const row = rows.get(claim.id)!; row.done = true; row.result = result; lock = undefined; },
    session: async (_claim, holder, id, encrypted) => { assert.equal(lock, holder); if (encrypted !== undefined) { writes++; blobs.set(id, encrypted); } return blobs.get(id) ?? null; } };
  const handler = () => createHostedHandler({ env, store,
    settlementContext: async () => ({ inputs: [input], gamePublicKey, arkadeScript: own.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 }),
    settlementBatchInfo: async network => { infoReads++; return { network, publicKey: operatorPublicKey, forfeitPublicKey: operatorPublicKey, advertisedBatchExpiry: advertised, forfeitScript: '5120' + toHex(operatorKey) }; } });
  const send = (path: string, body: unknown, token?: string, grant?: string) => handler()(new Request('https://example.test/api/bis/' + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(grant ? { 'X-BIS-Signing-Grant': grant } : {}) }, body: JSON.stringify(body) }));
  const connected = await (await send('connect', { gameId: 'stealth-and-steel', network: 'signet' }, owner ? secret : undefined)).json();
  const scope = { gameId: 'stealth-and-steel', network: 'signet' as const, profileId: connected.profileId, operationId: 'batch-fixture' };
  const proof = await authenticatePlayerProof({ endpoint: 'https://example.test/api/bis/', binding: scope, identity: operator, signal: new AbortController().signal, fetcher: async (url, init) => handler()(new Request(String(url), init)) });
  const prefix = owner ? 'owner/settlement/' : 'settlement/', field = owner ? 'ownerSettlementPlan' : 'settlementPlan', credential = owner ? secret : connected.token;
  const raw = (method: string, args: any[] = [], sessionId?: string) => ({ id: randomUUID(), ...scope, method, args: encodeSigningValue(args), ...(sessionId ? { sessionId } : {}), ...(owner ? { connectionToken: connected.token } : {}) });
  const planResponse = await send(prefix + 'plan', { request: raw('sign', [intent(gamePublicKey), undefined]), outpoints: [{ txid: input.txid, vout: 0 }], playerToken: proof.token, connectionToken: connected.token, sessionKeyMode: 'operation-v1' }, credential);
  assert.equal(planResponse.status, 200, await planResponse.clone().text());
  const planned = await planResponse.json();
  let batchPlan: string | undefined;
  const body = (method: string, args: any[] = [], sessionId?: string) => ({ ...raw(method, args, sessionId), [field]: planned[field], ...(batchPlan ? { settlementBatchPlan: batchPlan } : {}) });
  const authorize = (request: unknown, session = true) => send(prefix + (session ? 'session/authorize' : 'authorize'), { request, playerToken: proof.token, connectionToken: connected.token }, credential);
  const run = async (request: any, session = true) => {
    const response = await authorize(request, session); assert.equal(response.status, 200, await response.clone().text());
    const { grant } = await response.json(), signed = await send('sign', request, credential, grant);
    assert.equal(signed.status, 200, await signed.clone().text()); return { result: decodeSigningValue((await signed.json()).result), grant };
  };
  const ownership = await run(body('sign', [intent(planned.sessionPublicKey), undefined]), false);
  for (const vin of [0, 1]) await verifyTapscriptSignatures(ownership.result, vin, [toHex(gameKey)], [], [1]);
  const sessionId = (await run(body('session.create'))).result;
  const remoteKey = (await run(body('session.getPublicKey', [], sessionId))).result;
  assert.equal(toHex(remoteKey), planned.sessionPublicKey); assert.notEqual(toHex(remoteKey), gamePublicKey);
  const local = operator.signerSession(), localKey = await local.getPublicKey(), keys = sortKeys([remoteKey, localKey]);
  const expiry = 86528n, root = tapLeafHash(CSVMultisigTapscript.encode({ pubkeys: [operatorKey], timelock: { type: 'seconds', value: expiry } }).script);
  const internal = keyAggregate(keys).aggPublicKey.toBytes(true).slice(1), tweak = schnorr.utils.taggedHash('TapTweak', internal, root), finalKey = keyAggregate(keys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
  const candidate = (nonce = 0) => {
    const commitment = new Transaction(); commitment.addInput({ txid: input.txid, index: 0 });
    commitment.addOutput({ amount: 20000n, script: Uint8Array.from([0x51, 0x20, ...finalKey]) }); commitment.addOutput({ amount: BigInt(nonce), script: Uint8Array.from([0x6a]) });
    const tx = new Transaction(); tx.addInput({ txid: commitment.id, index: 0 }); tx.addOutput({ amount: 15000n, script: own.pkScript }); tx.addOutput({ amount: 5000n, script: own.pkScript });
    keys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key })); return { commitment, tree: new TxTree(tx) };
  };
  const c = candidate(), initArgs = [c.tree, root, 20000n], unplanned = body('session.init', initArgs, sessionId);
  assert.equal((await authorize(unplanned)).status, 403); assert.equal(infoReads, 0);
  const prepareBatch = (value = c) => send(prefix + 'batch', { request: body('session.init', [value.tree, root, 20000n], sessionId), commitment: encodeSigningValue(value.commitment), batchExpiry: String(expiry), playerToken: proof.token, connectionToken: connected.token }, credential);
  advertised = expiry + 512n;
  assert.equal((await prepareBatch()).status, 403);
  advertised = undefined;
  const prepared = await prepareBatch(); assert.equal(prepared.status, 200, await prepared.clone().text()); batchPlan = (await prepared.json()).settlementBatchPlan;
  const revocable = body('session.init', initArgs, sessionId), issued = await authorize(revocable); assert.equal(issued.status, 200);
  const issuedGrant = (await issued.json()).grant, priorClaims = claims.length, priorWrites = writes;
  if (!owner) {
    env.BIS_PUBLIC_SETTLEMENT_SIGNING = 'false';
    assert.equal((await send('sign', revocable, credential, issuedGrant)).status, 403);
    env.BIS_PUBLIC_SETTLEMENT_SIGNING = 'true';
  } else assert.equal((await send('sign', revocable, connected.token, issuedGrant)).status, 403);
  assert.equal(claims.length, priorClaims); assert.equal(writes, priorWrites);
  await run(body('session.init', initArgs, sessionId)); await local.init(c.tree, root, 20000n);
  const remoteNonces = (await run(body('session.getNonces', [], sessionId))).result, localNonces = await local.getNonces();
  const writesBefore = writes, countBefore = claims.length;
  const other = candidate(1), replacement = await prepareBatch(other); assert.equal(replacement.status, 200);
  const changed = { ...body('session.init', [other.tree, root, 20000n], randomUUID()), settlementBatchPlan: (await replacement.json()).settlementBatchPlan };
  const accepted = await authorize(changed); assert.equal(accepted.status, 200); const changedGrant = (await accepted.json()).grant;
  assert.equal((await send('sign', changed, credential, changedGrant)).status, 503);
  assert.equal(writes, writesBefore); assert.equal(claims.length, countBefore);
  const nonces = new Map([[toHex(remoteKey.slice(1)), { pubNonce: remoteNonces.get(c.tree.txid).pubNonce }], [toHex(localKey.slice(1)), { pubNonce: localNonces.get(c.tree.txid)!.pubNonce }]]);
  const malformed = body('session.aggregatedNonces', [c.tree.txid, new Map([[toHex(localKey.slice(1)), { pubNonce: new Uint8Array(66).fill(255) }]])], sessionId);
  assert.equal((await authorize(malformed)).status, 403); assert.equal(claims.length, countBefore);
  await run(body('session.aggregatedNonces', [c.tree.txid, nonces], sessionId)); await local.aggregatedNonces(c.tree.txid, nonces);
  const signBody = body('session.sign', [], sessionId), signed = await run(signBody), localSigs = await local.sign();
  const replay = await send('sign', signBody, credential, signed.grant); assert.equal(replay.status, 200);
  assert.deepEqual(decodeSigningValue((await replay.json()).result), signed.result);
  const partials = new Map([[toHex(remoteKey), signed.result], [toHex(localKey), localSigs]]);
  const message = c.tree.root.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey])], 0, [20000n]);
  const aggregator = new Session(nonceAggregate(keys.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), keys, message, [tweak], [true]);
  assert.equal(schnorr.verify(aggregator.partialSigAgg(keys.map(key => partials.get(toHex(key))!.get(c.tree.txid).encode())), message, finalKey), true);
  // Finalization signatures still belong to the Game key, never the ephemeral
  // operation session key. Metadata may arrive after the unsigned batch event.
  const finalCommitment = c.commitment.clone(); finalCommitment.updateInput(0, { witnessUtxo: { amount: BigInt(input.value), script: boarding.pkScript }, tapLeafScript: [boarding.forfeit()] });
  const finalBody = { ...body('sign', [finalCommitment, [0]]), settlementFinalization: true, settlementCommitment: encodeSigningValue(finalCommitment) };
  const authorizeFinal = (request: unknown) => send(prefix + 'finalization/authorize', { request, playerToken: proof.token, connectionToken: connected.token }, credential);
  const beforeFinal = claims.length;
  assert.equal((await authorize(finalBody, false)).status, 403, 'proof grants cannot sign finalization');
  assert.equal((await authorizeFinal({ ...finalBody, args: encodeSigningValue([finalCommitment, [1]]) })).status, 403);
  const wrongAmount = finalCommitment.clone(); wrongAmount.updateInput(0, { witnessUtxo: { amount: 20001n, script: boarding.pkScript } });
  assert.equal((await authorizeFinal({ ...finalBody, args: encodeSigningValue([wrongAmount, [0]]) })).status, 403);
  assert.equal(claims.length, beforeFinal);
  const finalAuthorization = await authorizeFinal(finalBody); assert.equal(finalAuthorization.status, 200, await finalAuthorization.clone().text());
  const finalGrant = (await finalAuthorization.json()).grant;
  const finalResponse = await send('sign', finalBody, credential, finalGrant); assert.equal(finalResponse.status, 200, await finalResponse.clone().text());
  const signedCommitment = decodeSigningValue((await finalResponse.json()).result);
  await verifyTapscriptSignatures(signedCommitment, 0, [toHex(gameKey)], [], [0]);
  const finalReplay = await send('sign', finalBody, credential, finalGrant); assert.equal(finalReplay.status, 200);
  assert.deepEqual(decodeSigningValue((await finalReplay.json()).result), signedCommitment);
  assert.equal((await send('sign', { ...finalBody, id: randomUUID() }, credential, finalGrant)).status, 403);
  assert.equal(claims.length, beforeFinal + 1);
  assert.equal(cost, 5000); assert.ok(claims.every(claim => claim.exposureSats === 5000));
  assert.equal(new Set(claims.map(claim => claim.transactionId)).size, 1);
  assert.equal(new Set(claims.filter(claim => claim.settlementBatch).map(claim => claim.settlementBatch!.digest)).size, 1);
});
