import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, verifyTapscriptSignatures, Extension, asset } from '@arkade-os/sdk';
import { createHostedHandler } from '../src/server/hosted.ts';
import type { SigningStore, SigningClaim } from '../src/server/signing-store.ts';
import { encodeSigningValue, decodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { authenticatePlayerProof } from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import { createAppPlayerProof } from '../../integration/src/client/wallet-layer-arkade/app-player-proof.ts';
import { createAppWalletSession } from '../../integration/src/client/wallet-layer-arkade/app-wallet-session.ts';
import { configureBisServer, probeGameSigner } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';

const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const game = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const operator = await player.xOnlyPublicKey();
const change = new DefaultVtxo.Script({ pubKey: await game.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const recipient = new DefaultVtxo.Script({ pubKey: await player.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const input = { txid: '11'.repeat(32), vout: 0, value: 10000, tapTree: change.encode(), tapLeafScript: change.forfeit(), assets: [] };
const unroll = CSVMultisigTapscript.encode({ pubkeys: [operator], timelock: { type: 'seconds', value: 86016n } });
const build = (amount = 600n) => buildOffchainTx([input], [{ amount, script: recipient.pkScript }, { amount: 10000n - amount, script: change.pkScript }], unroll);

async function fixture(enabled = true, assets = false, operationCap = '1000', marketplaceReceipt?: Parameters<typeof createHostedHandler>[0]['marketplaceReceipt']) {
  const secret = 'hosted-payment-test-secret-'.repeat(3), claims: SigningClaim[] = [];
  const results = new Map<string, { digest: string; result?: unknown; done?: boolean }>();
  const authorizedAssets = new Map<string, string>();
  const reservations = new Map<string, string>();
  let quotaRemaining = Infinity;
  let liveInputs = [input] as (Omit<typeof input, 'assets'> & { assets: { assetId: string; amount: bigint }[] })[];
  const store: SigningStore = {
    assetAllowed: async (scope, id, key) => authorizedAssets.get(scope + ':' + id) === key,
    consumePublicRequest: async () => { if (quotaRemaining-- <= 0) throw Error('Public signing request limit exceeded.'); },
    ping: async () => {}, session: async () => { throw Error('No payment sessions'); },
    claim: async claim => {
      const prior = results.get(claim.id);
      if (prior) { if (prior.digest !== claim.digest || !prior.done) throw Error('changed'); return { status: 'replay', result: prior.result }; }
      if (claim.inputs.some(input => reservations.has(claim.scope + ':' + input) && reservations.get(claim.scope + ':' + input) !== claim.transactionId)) throw Error('conflict');
      for (const input of claim.inputs) reservations.set(claim.scope + ':' + input, claim.transactionId);
      claims.push(claim); results.set(claim.id, { digest: claim.digest }); return { status: 'acquired', owner: claim.id };
    },
    complete: async (claim, _owner, result) => {
      results.set(claim.id, { digest: claim.digest, result, done: true });
      for (const issued of claim.issuedAssets ?? []) authorizedAssets.set(claim.scope + ':' + issued.assetId, issued.playerPublicKey);
    },
  };
  let time = Date.now(), reads = 0;
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrase, BIS_SIGNING_DAILY_CAP_SATS: '10000', BIS_SIGNING_OPERATION_CAP_SATS: operationCap, BIS_PUBLIC_PAYMENT_SIGNING: String(enabled), BIS_PUBLIC_ASSET_SIGNING: String(assets) };
  const handler = () => createHostedHandler({ env, store, now: () => time, marketplaceReceipt, paymentContext: async options => {
    reads++; assert.ok([Buffer.from(await player.compressedPublicKey()).toString('hex'), options.gamePublicKey].includes(options.playerPublicKey));
    return { inputs: liveInputs, changeScript: change.pkScript, recipientScript: recipient.pkScript, serverUnrollScript: unroll, maximumExposureSats: options.maximumExposureSats };
  } });
  const post = (path: string, body: unknown, token?: string, grant?: string) => handler()(new Request('https://example.test/api/bis/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(grant ? { 'X-BIS-Signing-Grant': grant } : {}) }, body: JSON.stringify(body) }));
  const connection = await post('connect', { network: 'signet', gameId: 'stealth-and-steel' }, enabled ? undefined : secret);
  assert.equal(connection.status, 200);
  const connected = await connection.json();
  const binding = { gameId: 'stealth-and-steel', network: 'signet' as const, profileId: connected.profileId, operationId: 'payment-1' };
  const auth = await authenticatePlayerProof({ endpoint: 'https://example.test/api/bis/', binding, identity: player, signal: new AbortController().signal, now: () => time, fetcher: async (url, init) => handler()(new Request(String(url), init)) });
  const raw = (tx = build().arkTx, id = 'root-sign') => ({ id, operationId: binding.operationId, network: binding.network, profileId: binding.profileId, method: 'sign', args: encodeSigningValue([tx, undefined]) });
  const plan = async (request = raw(), playerToken = auth.token, marketplacePayment?: string) => post('payment/plan', { request, playerToken, marketplacePayment, outpoints: liveInputs.map(({ txid, vout }) => ({ txid, vout })) }, connected.token);
  const grant = async (request: unknown) => post('payment/authorize', { request, playerToken: auth.token }, connected.token);
  return { post, plan, grant, raw, claims, connected, secret, handler, reads: () => reads, expireGrant: () => { time += 60000; }, setInputs: (inputs: typeof liveInputs) => { liveInputs = inputs; }, limitRequests: (count: number) => { quotaRemaining = count; }, disableAssets: () => { env.BIS_PUBLIC_ASSET_SIGNING = 'false'; } };
}

test('hosted 5000-sat configuration signs exact root and checkpoint while 5001 refuses before a claim', async () => {
  const f = await fixture(true, false, '5000');
  const proposed = build(5000n), response = await f.plan(f.raw(proposed.arkTx));
  assert.equal(response.status, 200, await response.clone().text());
  const { paymentPlan } = await response.json();
  for (const [index, tx] of [proposed.arkTx, ...proposed.checkpoints].entries()) {
    const request = { ...f.raw(tx, 'boundary-' + index), paymentPlan };
    const authorized = await f.grant(request);
    assert.equal(authorized.status, 200, await authorized.clone().text());
    const { grant } = await authorized.json();
    const signed = await f.post('sign', request, f.connected.token, grant);
    assert.equal(signed.status, 200, await signed.clone().text());
    await verifyTapscriptSignatures(decodeSigningValue((await signed.json()).result), 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
  }
  assert.equal(f.claims.length, 2);
  assert.ok(f.claims.every(claim => claim.operationCapSats === 5000 && claim.dailyCapSats === 10000 && claim.exposureSats === 5000 && claim.exposureId === proposed.arkTx.id));
  assert.notEqual((await f.plan(f.raw(build(5001n).arkTx, 'over-limit'))).status, 200);
  assert.equal(f.claims.length, 2);
  const invalid = await fixture(true, false, '5001');
  assert.notEqual((await invalid.plan()).status, 200);
  assert.equal(invalid.reads(), 0);
  assert.equal(invalid.claims.length, 0);
});

test('hosted payment policy signs real root and checkpoint across cold handlers without an owner signing grant', async () => {
  const f = await fixture(), proposed = build();
  const response = await f.plan(); assert.equal(response.status, 200, await response.clone().text());
  const { paymentPlan } = await response.json();
  for (const [index, tx] of [proposed.arkTx, ...proposed.checkpoints].entries()) {
    const request = { ...f.raw(tx, 'sign-' + index), paymentPlan };
    const authorized = await f.grant(request); assert.equal(authorized.status, 200);
    const { grant } = await authorized.json();
    const signed = await f.post('sign', request, f.connected.token, grant); assert.equal(signed.status, 200);
    const body = await signed.json();
    const transaction = decodeSigningValue(body.result);
    await verifyTapscriptSignatures(transaction, 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
    const replay = await f.post('sign', request, f.connected.token, grant);
    assert.deepEqual(await replay.json(), body);
    assert.equal(JSON.stringify([paymentPlan, grant, body]).includes(phrase), false);
    assert.equal(JSON.stringify([paymentPlan, grant, body]).includes(f.secret), false);
  }
  assert.equal(f.claims.length, 2);
  assert.equal(f.reads(), 1);
  assert.ok(f.claims.every(claim => claim.exposureSats === 600 && claim.exposureId === proposed.arkTx.id && claim.transactionId === proposed.arkTx.id));
  assert.ok(f.claims.every(claim => claim.inputs.includes(input.txid + ':0')));
});

test('hosted NFT issuance commits Player authorization and a later delivery uses that exact record', async () => {
  const f = await fixture(true, true);
  const metadata = Object.entries({ name: 'Achievement: Level 1', ticker: 'LVL1', decimals: '0', bisKind: 'asset', bisSchemaVersion: '1', bisAssetFormatVersion: '0.0.2', bisOperationId: 'reward-1' }).map(([key, value]) => asset.Metadata.create(new TextEncoder().encode(key), new TextEncoder().encode(value)));
  const issued = asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, 1n)], metadata);
  const mint = buildOffchainTx([input], [{ amount: 10000n, script: change.pkScript }, Extension.create([asset.Packet.create([issued])]).txOut()], unroll);
  const mintResponse = await f.plan(f.raw(mint.arkTx, 'mint-root')); assert.equal(mintResponse.status, 200);
  const { paymentPlan } = await mintResponse.json();
  const mintRequest = { ...f.raw(mint.arkTx, 'mint-root'), paymentPlan };
  const mintGrant = await (await f.grant(mintRequest)).json();
  assert.equal((await f.post('sign', mintRequest, f.connected.token, mintGrant.grant)).status, 200);
  assert.equal(f.claims[0].exposureSats, 0);
  const id = asset.AssetId.create(mint.arkTx.id, 0).toString();
  assert.equal(f.claims[0].issuedAssets?.[0].assetId, id);
  const source = { ...input, txid: mint.arkTx.id, assets: [{ assetId: id, amount: 1n }] };
  f.setInputs([source]);
  const transfer = asset.AssetGroup.create(asset.AssetId.fromString(id), null, [asset.AssetInput.create(0, 1n)], [asset.AssetOutput.create(0, 1n)], []);
  const delivery = buildOffchainTx([source], [{ amount: 330n, script: recipient.pkScript }, { amount: 9670n, script: change.pkScript }, Extension.create([asset.Packet.create([transfer])]).txOut()], unroll);
  const deliveryResponse = await f.plan(f.raw(delivery.arkTx, 'delivery-root')); assert.equal(deliveryResponse.status, 200);
  const deliveryRequest = { ...f.raw(delivery.arkTx, 'delivery-root'), paymentPlan: (await deliveryResponse.json()).paymentPlan };
  const deliveryGrant = await (await f.grant(deliveryRequest)).json();
  const signed = await f.post('sign', deliveryRequest, f.connected.token, deliveryGrant.grant); assert.equal(signed.status, 200);
  await verifyTapscriptSignatures(decodeSigningValue((await signed.json()).result), 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
  assert.equal(f.claims[1].exposureSats, 330);
  f.disableAssets();
  assert.equal((await f.post('sign', deliveryRequest, f.connected.token, deliveryGrant.grant)).status, 403);
  assert.equal(f.claims.length, 2);
  const unknown = await fixture(true, true); unknown.setInputs([source]);
  assert.equal((await unknown.plan(unknown.raw(delivery.arkTx))).status, 403);
  assert.equal(unknown.claims.length, 0);
});

test('hosted burn requires the authenticated Player ownership record and signs the SDK-shaped burn transaction', async () => {
  const f = await fixture(true, true);
  const metadata = Object.entries({ name: 'Achievement: Level 1', ticker: 'LVL1', decimals: '0', bisKind: 'asset', bisSchemaVersion: '1', bisAssetFormatVersion: '0.0.2', bisOperationId: 'reward-burn' }).map(([key, value]) => asset.Metadata.create(new TextEncoder().encode(key), new TextEncoder().encode(value)));
  const issued = asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, 1n)], metadata);
  const mint = buildOffchainTx([input], [{ amount: 10000n, script: change.pkScript }, Extension.create([asset.Packet.create([issued])]).txOut()], unroll);
  const mintPlan = await f.plan(f.raw(mint.arkTx, 'burn-mint'));
  assert.equal(mintPlan.status, 200, await mintPlan.clone().text());
  const mintRequest = { ...f.raw(mint.arkTx, 'burn-mint'), paymentPlan: (await mintPlan.json()).paymentPlan };
  const mintGrant = await (await f.grant(mintRequest)).json();
  assert.equal((await f.post('sign', mintRequest, f.connected.token, mintGrant.grant)).status, 200);
  const id = asset.AssetId.create(mint.arkTx.id, 0).toString(), source = { ...input, txid: mint.arkTx.id, assets: [{ assetId: id, amount: 1n }] };
  f.setInputs([source]);
  const burnGroup = asset.AssetGroup.create(asset.AssetId.fromString(id), null, [asset.AssetInput.create(0, 1n)], [], []);
  const burn = buildOffchainTx([source], [{ amount: 10000n, script: change.pkScript }, Extension.create([asset.Packet.create([burnGroup])]).txOut()], unroll);
  const burnPlan = await f.plan(f.raw(burn.arkTx, 'burn-root'));
  assert.equal(burnPlan.status, 200, await burnPlan.clone().text());
  const burnRequest = { ...f.raw(burn.arkTx, 'burn-root'), paymentPlan: (await burnPlan.json()).paymentPlan };
  const burnGrant = await (await f.grant(burnRequest)).json();
  const signed = await f.post('sign', burnRequest, f.connected.token, burnGrant.grant);
  assert.equal(signed.status, 200, await signed.clone().text());
  await verifyTapscriptSignatures(decodeSigningValue((await signed.json()).result), 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
  assert.equal(f.claims[1].exposureSats, 0);

  const unknown = await fixture(true, true); unknown.setInputs([source]);
  assert.equal((await unknown.plan(unknown.raw(burn.arkTx, 'unowned-burn'))).status, 403);
  assert.equal(unknown.claims.length, 0);
});

test('paid catalog delivery seals verified receipt into linked claims without granting future free delivery', async () => {
  const paymentId = 'ab'.repeat(32), id = asset.AssetId.create('cd'.repeat(32), 0).toString();
  let reads = 0;
  const f = await fixture(true, true, '5000', async options => {
    reads++;
    assert.equal(options.transactionId, paymentId);
    assert.equal(options.assetId, id);
    assert.equal(options.playerPublicKey, Buffer.from(await player.compressedPublicKey()).toString('hex'));
    assert.equal(options.gamePublicKey, Buffer.from(await game.compressedPublicKey()).toString('hex'));
    return { ...options, vout: 0, catalogId: 'shoes-1', priceSats: 1000, receiptKey: `marketplace-payment:${paymentId}:0` };
  });
  const source = { ...input, assets: [{ assetId: id, amount: 1n }] };
  f.setInputs([source]);
  const transfer = asset.AssetGroup.create(asset.AssetId.fromString(id), null, [asset.AssetInput.create(0, 1n)], [asset.AssetOutput.create(0, 1n)], []);
  const buildDelivery = (carrier = 330n) => buildOffchainTx([source], [{ amount: carrier, script: recipient.pkScript }, { amount: 10000n - carrier, script: change.pkScript }, Extension.create([asset.Packet.create([transfer])]).txOut()], unroll);
  const proposed = buildDelivery();
  assert.equal((await f.plan(f.raw(proposed.arkTx))).status, 403);
  assert.equal((await f.plan(f.raw(proposed.arkTx), undefined, 'not-a-txid')).status, 403);
  assert.equal(reads, 0);
  const response = await f.plan(f.raw(proposed.arkTx), undefined, paymentId);
  assert.equal(response.status, 200, await response.clone().text());
  const { paymentPlan } = await response.json();
  for (const [index, tx] of [proposed.arkTx, ...proposed.checkpoints].entries()) {
    const request = { ...f.raw(tx, 'catalog-' + index), paymentPlan };
    const authorized = await f.grant(request); assert.equal(authorized.status, 200);
    const signed = await f.post('sign', request, f.connected.token, (await authorized.json()).grant);
    assert.equal(signed.status, 200, await signed.clone().text());
    await verifyTapscriptSignatures(decodeSigningValue((await signed.json()).result), 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
  }
  assert.ok(f.claims.every(claim => claim.inputs.includes(`marketplace-payment:${paymentId}:0`) && !claim.issuedAssets));
  assert.equal((await f.plan(f.raw(proposed.arkTx))).status, 403);
  const replacement = buildDelivery(331n);
  const secondPlan = await (await f.plan(f.raw(replacement.arkTx, 'replacement'), undefined, paymentId)).json();
  const request = { ...f.raw(replacement.arkTx, 'replacement'), paymentPlan: secondPlan.paymentPlan };
  const authorized = await f.grant(request); assert.equal(authorized.status, 200);
  assert.notEqual((await f.post('sign', request, f.connected.token, (await authorized.json()).grant)).status, 200);
  assert.equal(f.claims.length, 2);
});

test('public request quota refusal stops preparation reads and signing claims, including zero-cost work', async () => {
  const f = await fixture(); f.limitRequests(0);
  assert.equal((await f.plan()).status, 429); assert.equal(f.reads(), 0); assert.equal(f.claims.length, 0);
  const allowed = await fixture();
  const { paymentPlan } = await (await allowed.plan()).json();
  const request = { ...allowed.raw(), paymentPlan }, { grant } = await (await allowed.grant(request)).json();
  allowed.limitRequests(0);
  assert.equal((await allowed.post('sign', request, allowed.connected.token, grant)).status, 429);
  assert.equal(allowed.claims.length, 0);
});

test('private owner generic mint signs root and checkpoint with net accounting and cannot become a public grant', async () => {
  const f = await fixture();
  const group = asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, 12345n)], []);
  const prepared = buildOffchainTx([input], [{ amount: 10000n, script: change.pkScript }, Extension.create([asset.Packet.create([group])]).txOut()], unroll);
  const proposed = f.raw(prepared.arkTx, 'owner-root');
  const payload = { request: proposed, connectionToken: f.connected.token, outpoints: [{ txid: input.txid, vout: input.vout }] };
  assert.equal((await f.post('owner/plan', payload)).status, 403);
  const response = await f.post('owner/plan', payload, f.secret); assert.equal(response.status, 200);
  const { ownerPlan } = await response.json();
  for (const [index, tx] of [prepared.arkTx, ...prepared.checkpoints].entries()) {
    const request = { ...f.raw(tx, 'owner-' + index), ownerPlan, connectionToken: f.connected.token };
    const grantResponse = await f.post('owner/authorize', { request }, f.secret); assert.equal(grantResponse.status, 200);
    const { grant } = await grantResponse.json();
    const signed = await f.post('sign', request, f.secret, grant); assert.equal(signed.status, 200);
    await verifyTapscriptSignatures(decodeSigningValue((await signed.json()).result), 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
    assert.equal((await f.post('sign', request, f.connected.token, grant)).status, 403);
    assert.equal((await f.post('sign', { ...request, ownerPlan: undefined, paymentPlan: ownerPlan }, f.connected.token, grant)).status, 403);
  }
  assert.equal(f.claims.length, 2);
  assert.ok(f.claims.every(claim => claim.exposureSats === 0 && claim.exposureId === prepared.arkTx.id));
  assert.equal((await f.grant({ ...proposed, paymentPlan: ownerPlan })).status, 403);
  assert.equal(JSON.stringify(ownerPlan).includes(f.secret), false);
});

test('owner plan refuses over-cap net spending and forged witness values despite private authorization', async () => {
  const f = await fixture(), over = build(1100n).arkTx;
  const plan = (tx: typeof over) => f.post('owner/plan', { request: f.raw(tx), connectionToken: f.connected.token, outpoints: [{ txid: input.txid, vout: input.vout }] }, f.secret);
  assert.equal((await plan(over)).status, 403);
  const changed = build().arkTx.clone(), prior = changed.getInput(0).witnessUtxo!;
  changed.updateInput(0, { witnessUtxo: { script: prior.script, amount: 9999n } });
  assert.equal((await plan(changed)).status, 403);
  assert.equal(f.claims.length, 0);
});

test('retained owner client uses one net-exposure plan and refuses signing after owner access is removed', async t => {
  const f = await fixture(); let removeAfterGrant = false;
  const fetcher: typeof fetch = async (url, init) => {
    const response = await f.handler()(new Request(String(url), init));
    if (removeAfterGrant && String(url).endsWith('/owner/authorize')) configureBisServer({});
    return response;
  };
  configureBisServer({ ownerToken: f.secret }); t.after(() => configureBisServer({}));
  const probe = await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  const owner = createAppWalletSession({ createWallet: async config => ({ dispose: async () => {},
    buildAndSubmitOffchainTx: async (inputs: typeof input[], outputs: { amount: bigint; script: Uint8Array }[]) => {
      const prepared = buildOffchainTx(inputs, outputs, unroll);
      await config.identity.sign(prepared.arkTx);
      for (const checkpoint of prepared.checkpoints) await config.identity.sign(checkpoint);
      return prepared.arkTx.id;
    },
  }) }); t.after(() => owner.dispose());
  const run = () => owner.sign('game', probe.account, new AbortController().signal, wallet => wallet.buildAndSubmitOffchainTx([input], [{ amount: 600n, script: recipient.pkScript }, { amount: 9400n, script: change.pkScript }]));
  assert.equal(await run(), build().arkTx.id);
  assert.ok(f.claims.every(claim => claim.exposureSats === 600));
  assert.equal(f.claims.length, 2);
  removeAfterGrant = true;
  await assert.rejects(run(), /owner access was removed/);
  assert.equal(f.claims.length, 2);
});

test('disabled policy, missing player proof and over-budget plans cannot acquire a signing claim', async () => {
  const off = await fixture(false); assert.equal((await off.plan()).status, 403); assert.equal(off.reads(), 0);
  const f = await fixture();
  assert.equal((await f.plan(f.raw(), 'invalid-proof')).status, 403); assert.equal(f.reads(), 0);
  assert.equal((await f.plan(f.raw(build(1100n).arkTx))).status, 403);
  assert.equal(f.claims.length, 0);
});

test('payment grants reject changed requests, other methods/connections, tampering and expiry before signing', async () => {
  const f = await fixture(), { paymentPlan } = await (await f.plan()).json();
  const request = { ...f.raw(), paymentPlan };
  const { grant } = await (await f.grant(request)).json();
  assert.equal((await f.post('sign', { ...request, id: 'changed' }, f.connected.token, grant)).status, 403);
  assert.equal((await f.grant({ ...request, method: 'signMessage' })).status, 403);
  assert.equal((await f.grant({ ...request, operationId: 'different' })).status, 403);
  assert.equal((await f.grant({ ...request, paymentPlan: paymentPlan + 'x' })).status, 403);
  const other = await (await f.post('connect', { gameId: 'stealth-and-steel', network: 'signet' }, f.secret)).json();
  assert.equal((await f.post('sign', request, other.token, grant)).status, 403);
  f.expireGrant();
  assert.equal((await f.post('sign', request, f.connected.token, grant)).status, 403);
  assert.equal(f.claims.length, 0);
});

test('retained client wallet composes private Player proof and one plan for root/checkpoint without an owner grant', async t => {
  const f = await fixture(), calls: { path: string; body: any; authorization: string | null }[] = [];
  let logOutAfterAuthorize = false;
  const fetcher: typeof fetch = async (url, init) => {
    const request = new Request(String(url), init);
    calls.push({ path: new URL(request.url).pathname, body: await request.clone().json(), authorization: request.headers.get('authorization') });
    const response = await f.handler()(request);
    if (logOutAfterAuthorize && request.url.endsWith('/payment/authorize')) scope.phase = 'idle';
    return response;
  };
  // Use the same anonymous probe as Pages. No owner credential enters this flow.
  configureBisServer({});
  const probe = await probeGameSigner('signet', { endpoint: 'https://example.test/api/bis/', fetcher });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') return;
  assert.equal(calls.find(call => call.path.endsWith('/connect'))?.authorization, null);
  configureBisServer({}); t.after(() => configureBisServer({})); calls.length = 0;
  const account = { phrase: 'legal winner thank year wave sausage worth useful legal winner thank yellow', profileId: 'local-player', network: 'signet' as const };
  const scope = { phase: 'active', profileId: account.profileId, network: 'signet' as const };
  const proof = createAppPlayerProof({ load: async () => ({ generation: 1, account }), scope: () => scope, subscribe: () => () => {} });
  const owner = createAppWalletSession({ playerProof: proof, createWallet: async config => ({
    dispose: async () => {},
    buildAndSubmitOffchainTx: async (inputs: typeof input[], outputs: { amount: bigint; script: Uint8Array }[]) => {
      const prepared = buildOffchainTx(inputs, outputs, unroll);
      await config.identity.sign(prepared.arkTx);
      for (const checkpoint of prepared.checkpoints) await config.identity.sign(checkpoint);
      return prepared.arkTx.id;
    },
  }) });
  t.after(() => owner.dispose());
  const signal = new AbortController().signal;
  const result = await owner.sign('game', probe.account, signal, wallet => wallet.buildAndSubmitOffchainTx([input], [{ amount: 600n, script: recipient.pkScript }, { amount: 9400n, script: change.pkScript }]));
  assert.equal(result, build().arkTx.id);
  assert.equal(calls.filter(call => call.path.endsWith('/payment/plan')).length, 1);
  assert.equal(calls.filter(call => call.path.endsWith('/payment/authorize')).length, 2);
  assert.equal(calls.filter(call => call.path.endsWith('/sign')).length, 2);
  assert.equal(calls.some(call => call.path === '/api/bis/authorize'), false);
  assert.equal(calls.some(call => call.authorization === 'Bearer ' + f.secret), false);
  assert.equal(JSON.stringify(calls).includes(account.phrase), false);
  assert.equal(JSON.stringify(calls).includes(phrase), false);
  assert.equal(new Set(f.claims.map(claim => claim.operationId)).size, 1);
  logOutAfterAuthorize = true;
  await assert.rejects(owner.sign('game', probe.account, signal, wallet => wallet.buildAndSubmitOffchainTx([input], [{ amount: 600n, script: recipient.pkScript }, { amount: 9400n, script: change.pkScript }])), /Player scope/);
  assert.equal(f.claims.length, 2, 'logout after authorization must prevent the next signing request');
});
