import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MnemonicIdentity } from '@arkade-os/sdk';
import { createPlayerAuthorization } from '../src/server/player-authorization.ts';
import { createSigningAuthorization, signingDigest } from '../src/server/signing-authorization.ts';
import { createHostedHandler } from '../src/server/hosted.ts';
import { authenticatePlayerProof } from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import { playerProofMessage, type PlayerProofBinding } from '../../integration/src/client/wallet-layer-arkade/player-proof-protocol.ts';
import { toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

// Published BIP39 fixture only. No network funds or private operator values.
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const secret = 'player-proof-test-secret-'.repeat(3);
const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
const binding: PlayerProofBinding = { audience: 'https://example.test', gameId: 'stealth-and-steel', network: 'signet', profileId: 'a'.repeat(64), operationId: 'operation-1' };
const playerPublicKey = toHex(await identity.compressedPublicKey());
const sign = async (scope: Parameters<typeof playerProofMessage>[0]) => toHex(await identity.signMessage(createHash('sha256').update(playerProofMessage(scope)).digest(), 'schnorr'));

test('player authority proves the local key and survives cold instances without becoming owner authority', async () => {
  const now = () => 100000;
  const first = createPlayerAuthorization(secret, now), cold = createPlayerAuthorization(secret, now);
  const challenge = first.challenge({ ...binding, playerPublicKey });
  const proof = await sign(challenge.scope);
  const authority = cold.authenticate(challenge.challenge, proof, binding);
  const verified = cold.verify(authority.token, binding);
  assert.equal(verified.playerPublicKey, playerPublicKey);
  assert.equal(verified.playerProfileId, createHash('sha256').update(Buffer.from(playerPublicKey, 'hex')).digest('hex'));
  assert.equal(Object.isFrozen(verified), true);
  const owner = createSigningAuthorization(secret, now);
  assert.throws(() => owner.assertOwner('Bearer ' + authority.token), /authorization/);
  assert.throws(() => owner.connection(authority.token, binding), /authorization/);
  assert.throws(() => owner.verify(authority.token, { ...binding, digest: signingDigest({}) }), /invalid/);
  assert.throws(() => cold.verify(challenge.challenge, binding), /authorization/);
  assert.throws(() => cold.verify(owner.connect(binding), binding), /authorization/);
  assert.equal(JSON.stringify([challenge, authority, verified]).includes(phrase), false);
  assert.equal(JSON.stringify([challenge, authority, verified]).includes(secret), false);
});

test('proofs reject altered scope, signatures, expired challenges and rotated server keys', async () => {
  let time = 100000;
  const auth = createPlayerAuthorization(secret, () => time);
  const challenge = auth.challenge({ ...binding, playerPublicKey });
  const proof = await sign(challenge.scope);
  const authority = auth.authenticate(challenge.challenge, proof, binding);
  for (const [key, value] of Object.entries({ audience: 'https://other.test', gameId: 'other-game', network: 'mutinynet', profileId: 'b'.repeat(64), operationId: 'operation-2' })) {
    const changed = { ...binding, [key]: value };
    assert.throws(() => auth.authenticate(challenge.challenge, proof, changed), /authorization/);
    assert.throws(() => auth.verify(authority.token, changed), /authorization/);
  }
  assert.throws(() => auth.authenticate(challenge.challenge, '00'.repeat(64), binding), /authorization/);
  assert.throws(() => auth.authenticate(challenge.challenge + 'x', proof, binding), /authorization/);
  assert.throws(() => auth.verify(authority.token + 'x', binding), /authorization/);
  assert.throws(() => createPlayerAuthorization(secret + 'rotated', () => time).verify(authority.token, binding), /authorization/);
  assert.throws(() => createPlayerAuthorization(undefined).challenge({ ...binding, playerPublicKey }), /authorization/);
  time += 60000;
  assert.throws(() => auth.authenticate(challenge.challenge, proof, binding), /authorization/);
  assert.equal(auth.verify(authority.token, binding).playerPublicKey, playerPublicKey);
  time += 540000;
  assert.throws(() => auth.verify(authority.token, binding), /authorization/);
});

function transport(now = () => 100000, mutate?: (body: any) => any) {
  const server = createPlayerAuthorization(secret, now), requests: { path: string; body: any }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), body = JSON.parse(String(init?.body));
    requests.push({ path: url.pathname, body });
    if (url.pathname.endsWith('/challenge')) {
      const challenge = server.challenge({ ...binding, ...body, audience: url.origin });
      return Response.json(mutate ? mutate(challenge) : challenge);
    }
    return Response.json(server.authenticate(body.challenge, body.signature, { audience: url.origin, gameId: body.gameId, network: body.network, profileId: body.profileId, operationId: body.operationId }));
  };
  return { server, fetcher, requests };
}

test('browser signs only its reconstructed typed challenge and sends public proof, never its mnemonic', async () => {
  const fixture = transport();
  const result = await authenticatePlayerProof({ endpoint: binding.audience + '/api/bis/', identity, binding, signal: new AbortController().signal, fetcher: fixture.fetcher, now: () => 100000 });
  assert.equal(fixture.server.verify(result.token, binding).playerPublicKey, playerPublicKey);
  assert.equal(fixture.requests.length, 2);
  assert.deepEqual(fixture.requests.map(row => row.path), ['/api/bis/player/challenge', '/api/bis/player/authenticate']);
  assert.equal(JSON.stringify(fixture.requests).includes(phrase), false);
  assert.equal(JSON.stringify(fixture.requests).includes(secret), false);
});

test('browser refuses changed audience, key, operation or deadline before asking its identity to sign', async () => {
  for (const changed of [{ audience: 'https://other.test' }, { playerPublicKey: '02' + 'b'.repeat(64) }, { operationId: 'other-operation' }, { expires: 100000 }, { expires: 160001 }]) {
    const fixture = transport(() => 100000, body => ({ ...body, scope: { ...body.scope, ...changed } }));
    let signed = false;
    const guarded = Object.create(identity);
    guarded.compressedPublicKey = () => identity.compressedPublicKey();
    guarded.signMessage = () => { signed = true; throw Error('must not sign'); };
    await assert.rejects(authenticatePlayerProof({ endpoint: binding.audience + '/api/bis/', identity: guarded, binding, signal: new AbortController().signal, fetcher: fixture.fetcher, now: () => 100000 }), /scope|deadline/);
    assert.equal(signed, false);
    assert.equal(fixture.requests.length, 1);
  }
});

test('browser cancellation after local proof prevents its submission; insecure endpoints never receive a proof', async () => {
  const fixture = transport(), controller = new AbortController();
  const guarded = Object.create(identity);
  guarded.compressedPublicKey = () => identity.compressedPublicKey();
  guarded.signMessage = async (...args: Parameters<typeof identity.signMessage>) => { const result = await identity.signMessage(...args); controller.abort(); return result; };
  await assert.rejects(authenticatePlayerProof({ endpoint: binding.audience + '/api/bis/', identity: guarded, binding, signal: controller.signal, fetcher: fixture.fetcher, now: () => 100000 }), { name: 'AbortError' });
  assert.equal(fixture.requests.length, 1);
  for (const endpoint of ['http://example.test/api/bis/', 'https://user:password@example.test/api/bis/', 'https://example.test/api/bis/?override=1']) {
    await assert.rejects(authenticatePlayerProof({ endpoint, identity, binding, signal: new AbortController().signal, fetcher: fixture.fetcher }), /HTTPS/);
  }
  assert.equal(fixture.requests.length, 1);
});

test('actual hosted routes authenticate player proofs but still refuse public connections and signing grants', async () => {
  const env = { BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrase, BIS_OWNER_TOKEN: secret };
  const handler = createHostedHandler({ env, now: () => 100000 });
  const fetcher: typeof fetch = async (input, init) => handler(new Request(String(input), init));
  const publicIdentity = await (await handler(new Request(binding.audience + '/api/bis/identity?network=signet'))).json();
  const scope = { ...binding, profileId: publicIdentity.profileId };
  const result = await authenticatePlayerProof({ endpoint: binding.audience + '/api/bis/', identity, binding: scope, signal: new AbortController().signal, fetcher, now: () => 100000 });
  assert.equal(createPlayerAuthorization(secret, () => 100000).verify(result.token, scope).playerPublicKey, playerPublicKey);
  const post = (path: string, body: unknown) => handler(new Request(binding.audience + '/api/bis/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + result.token, 'X-BIS-Signing-Grant': result.token }, body: JSON.stringify(body) }));
  assert.equal((await post('connect', scope)).status, 403);
  assert.equal((await post('authorize', { request: { ...scope, id: 'sign-1' }, operationId: scope.operationId })).status, 403);
  assert.equal((await post('sign', { ...scope, id: 'sign-1', method: 'signMessage', args: [] })).status, 403);
  assert.equal((await post('player/authenticate', { ...scope, challenge: result.token, signature: '00'.repeat(64) })).status, 403);
  const hostile = await handler(new Request(binding.audience + '/api/bis/player/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: JSON.stringify({ ...scope, playerPublicKey }) }));
  assert.equal(hostile.status, 403);
  assert.equal(publicIdentity.signingReady, false);
});

test('browser rejects expired or unbounded authority responses', async () => {
  for (const expires of [100000, 700001, NaN]) {
    const fixture = transport();
    const fetcher: typeof fetch = async (input, init) => {
      const response = await fixture.fetcher(input, init);
      return String(input).endsWith('/authenticate') ? Response.json({ ...(await response.json()), expires }) : response;
    };
    await assert.rejects(authenticatePlayerProof({ endpoint: binding.audience + '/api/bis/', identity, binding, signal: new AbortController().signal, fetcher, now: () => 100000 }), /authority response/);
  }
});
