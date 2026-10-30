import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Intent, verifyTapscriptSignatures, type IntentCoin } from '@arkade-os/sdk';
import { createHostedHandler } from '../src/server/hosted.ts';
import type { SigningClaim, SigningStore } from '../src/server/signing-store.ts';
import { authenticatePlayerProof } from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import { encodeSigningValue, decodeSigningValue, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {checkpointLifecycleResponse} from '../scripts/funded-workflow-lifecycle.ts';

// Real SDK cryptography with public fixtures. The injected store captures
// claims only; Redis accounting and live operator settlement are separate tests.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const game = MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const gameKey = await game.xOnlyPublicKey(), gamePublicKey = toHex(await game.compressedPublicKey());
const operatorKey = await player.xOnlyPublicKey();
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: gameKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: delay } });
const offchain = script(1024n), boarding = script(4096n);
const inputs: IntentCoin[] = [{ txid: '11'.repeat(32), vout: 0, value: 20000, tapTree: boarding.encode(), intentTapLeafScript: boarding.forfeit(), status: { confirmed: true } } as IntentCoin];
const context = { inputs, gamePublicKey, arkadeScript: offchain.pkScript, bitcoinScript: boarding.pkScript, dustAmount: 330n, maximumExposureSats: 5000 };
const register = (amount = 15000n) => Intent.create({ type: 'register', onchain_output_indexes: [], valid_at: 0, expire_at: 0, cosigners_public_keys: [gamePublicKey] }, inputs, [{ amount, script: offchain.pkScript }]);

for (const owner of [false, true]) test(`hosted ${owner ? 'owner' : 'public'} settlement proofs retain exact plan and reject changes before signing`, async () => {
  const claims: SigningClaim[] = [], secret = 'hosted-settlement-test-secret-'.repeat(3);
  const env = { BIS_OWNER_TOKEN: secret, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: mnemonic, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet',
    BIS_PUBLIC_SETTLEMENT_SIGNING: 'false', BIS_SIGNING_OPERATION_CAP_SATS: '5000', BIS_SIGNING_DAILY_CAP_SATS: '10000' };
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
    session: async () => { throw Error('Proof signing is not MuSig authority.'); }, claim: async claim => { claims.push(claim); return { status: 'acquired', owner: claim.id }; }, complete: async () => {} };
  let reads = 0;
  // A new handler for each request proves no warm-instance plan dependency.
  const handler = () => createHostedHandler({ env, store, settlementContext: async options => {
    reads++;
    assert.equal(options.gamePublicKey, gamePublicKey);
    assert.equal(options.network, 'signet'); assert.equal(options.maximumExposureSats, 5000);
    assert.deepEqual(options.outpoints, [{ txid: inputs[0].txid, vout: 0 }]);
    return context;
  } });
  const send = (path: string, body: unknown, token?: string, grant?: string) => handler()(new Request('https://example.test/api/bis/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(grant ? { 'X-BIS-Signing-Grant': grant } : {}) }, body: JSON.stringify(body),
  }));
  const connected = await (await send('connect', { gameId: 'stealth-and-steel', network: 'signet' }, owner ? secret : undefined)).json();
  const scope = { gameId: 'stealth-and-steel', network: 'signet' as const, profileId: connected.profileId, operationId: 'settlement-test' };
  const proof = await authenticatePlayerProof({ endpoint: 'https://example.test/api/bis/', binding: scope, identity: player, signal: new AbortController().signal,
    fetcher: async (url, init) => handler()(new Request(String(url), init)) });
  const token = owner ? secret : connected.token, route = owner ? 'owner/settlement/' : 'settlement/', field = owner ? 'ownerSettlementPlan' : 'settlementPlan';
  const raw = (tx = register(), id = 'root') => ({ id, ...scope, method: 'sign', args: encodeSigningValue([tx, undefined]), ...(owner ? { connectionToken: connected.token } : {}) });
  const payload = { request: raw(), outpoints: [{ txid: inputs[0].txid, vout: 0 }], playerToken: proof.token, connectionToken: connected.token };
  if (!owner) {
    assert.equal((await send(route + 'plan', payload, token)).status, 403);
    assert.equal(reads, 0); env.BIS_PUBLIC_SETTLEMENT_SIGNING = 'true';
    assert.equal((await send(route + 'plan', { ...payload, playerToken: 'wrong' }, token)).status, 403);
  } else {
    assert.equal((await send(route + 'plan', payload, connected.token)).status, 403);
    assert.equal(reads, 0);
  }
  const response = await send(route + 'plan', payload, token);
  assert.equal(response.status, 200, await response.clone().text());
  const plan = (await response.json())[field];
  assert.equal(typeof plan, 'string');
  const altered = { ...raw(register(16000n)), [field]: plan };
  assert.equal((await send(route + 'authorize', { request: altered, playerToken: proof.token, connectionToken: connected.token }, token)).status, 403);
  assert.equal(claims.length, 0);
  const proofs = [register(), ...(['delete', 'get-pending-tx'] as const).map(type => Intent.create({ type, expire_at: 0 }, inputs))];
  for (const [index, tx] of proofs.entries()) {
    const request = { ...raw(tx, 'proof-' + index), [field]: plan };
    const grantResponse = await send(route + 'authorize', { request, playerToken: proof.token, connectionToken: connected.token }, token);
    assert.equal(grantResponse.status, 200, await grantResponse.clone().text());
    const { grant } = await grantResponse.json();
    assert.equal((await send('sign', { ...request, id: 'altered-id' }, token, grant)).status, 403);
    if (!owner) {
      env.BIS_PUBLIC_SETTLEMENT_SIGNING = 'false';
      assert.equal((await send('sign', request, token, grant)).status, 403);
      env.BIS_PUBLIC_SETTLEMENT_SIGNING = 'true';
    } else {
      assert.equal((await send('sign', request, connected.token, grant)).status, 403);
    }
    assert.equal(claims.length, index);
    const signed = await send('sign', request, token, grant);
    assert.equal(signed.status, 200, await signed.clone().text());
    // The actual hosted handler returns {result} without a response id. The
    // protected checkpoint associates it with the original request metadata.
    const text=await signed.clone().text(),envelope=JSON.parse(text),saved:any={},retained:any[]=[],counts={server:0,sign:0,provider:0,sessionSign:0};
    assert.deepEqual(Object.keys(envelope),['result']);
    await checkpointLifecycleResponse({a:{authorizationMode:owner?'owner':'player-proof'} as any,counts,retainResponse:async record=>{retained.push(record);return {file:'fixture.dpapi.json',sha256:'a'.repeat(64)};},save:async use=>use(saved,{})},'sign',request,{status:signed.status,text});
    assert.equal(retained[0].text,text);assert.equal(saved.serverResponses[0].text,undefined);assert.equal(saved.serverResponses[0].requestId,request.id);assert.equal(counts.sign,1);
    const actual = decodeSigningValue((await signed.json()).result);
    for (const vin of [0, 1]) await verifyTapscriptSignatures(actual, vin, [toHex(gameKey)], [], [1]);
  }
  assert.equal(reads, 1);
  assert.equal(claims.length, 3);
  assert.equal(new Set(claims.map(claim => claim.transactionId)).size, 1);
  assert.ok(claims.every(claim => claim.exposureSats === 5000 && claim.exposureId === claim.transactionId && claim.inputs.join(',') === inputs[0].txid + ':0'));
  assert.equal(JSON.stringify(claims).includes(mnemonic), false);
  assert.equal(JSON.stringify(claims).includes(secret), false);
});
