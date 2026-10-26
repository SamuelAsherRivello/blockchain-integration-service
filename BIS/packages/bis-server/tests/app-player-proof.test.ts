import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppPlayerProof } from '../../integration/src/client/wallet-layer-arkade/app-player-proof.ts';
import type { ServerWalletReference } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { createHostedHandler } from '../src/server/hosted.ts';

const server: ServerWalletReference = { profileId: 'a'.repeat(64), network: 'signet', server: { endpoint: 'https://example.test/api/bis/', gameId: 'stealth-and-steel', publicKey: '02' + 'b'.repeat(64) } };
const account = { phrase: 'legal winner thank year wave sausage worth useful legal winner thank yellow', profileId: 'player', network: 'signet' as const };
const request = () => ({ account: server, operationId: 'operation-1', signal: new AbortController().signal });

test('private proof refuses inactive, wrong-network or missing Player account before making requests', async () => {
  for (const scope of [{ phase: 'idle', profileId: 'player', network: 'signet' as const }, { phase: 'active', profileId: 'player', network: 'mutinynet' as const }]) {
    let loaded = false;
    const proof = createAppPlayerProof({ scope: () => scope, load: async () => { loaded = true; return { generation: 1, account }; }, subscribe: () => () => {} });
    await assert.rejects(proof(request()), /scope/); assert.equal(loaded, false);
  }
  const proof = createAppPlayerProof({ scope: () => ({ phase: 'active', profileId: 'player', network: 'signet' }), load: async () => ({ generation: 1, account: null }), subscribe: () => () => {} });
  await assert.rejects(proof(request()), /account/);
});

test('logout during private account loading aborts proof and unsubscribes before any HTTP request', async () => {
  let phase = 'active', notify = () => {}, unsubscribed = false, fetched = false;
  const proof = createAppPlayerProof({ scope: () => ({ phase, profileId: 'player', network: 'signet' }),
    load: async () => { phase = 'idle'; notify(); return { generation: 1, account }; },
    subscribe: listener => { notify = listener; return () => { unsubscribed = true; }; } });
  await assert.rejects(proof({ ...request(), fetcher: async () => { fetched = true; throw Error('must not fetch'); } }), /scope changed/);
  assert.equal(fetched, false); assert.equal(unsubscribed, true);
});

test('a storage generation change during authentication discards the resulting Player authority', async () => {
  const handler = createHostedHandler({ env: { BIS_OWNER_TOKEN: 'private-proof-test-secret-'.repeat(3), BIS_GAME_WALLET_SIGNET_01_MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' } });
  const publicIdentity = await (await handler(new Request('https://example.test/api/bis/identity?network=signet'))).json();
  let loads = 0, requests = 0, unsubscribed = false;
  const proof = createAppPlayerProof({ scope: () => ({ phase: 'active', profileId: account.profileId, network: 'signet' }),
    load: async () => ({ generation: ++loads, account }), subscribe: () => () => { unsubscribed = true; } });
  await assert.rejects(proof({ ...request(), account: { ...server, profileId: publicIdentity.profileId }, fetcher: async (url, init) => { requests++; return handler(new Request(String(url), init)); } }), /account changed/);
  assert.equal(requests, 2); assert.equal(loads, 2); assert.equal(unsubscribed, true);
});

test('in-place host scope mutation cannot move an existing proof to a replacement Player', async () => {
  const scope = { phase: 'active', profileId: 'player', network: 'signet' as const };
  let notify = () => {}, fetched = false;
  const proof = createAppPlayerProof({ scope: () => scope,
    load: async () => { scope.profileId = 'replacement'; notify(); return { generation: 1, account }; },
    subscribe: listener => { notify = listener; return () => {}; } });
  await assert.rejects(proof({ ...request(), fetcher: async () => { fetched = true; throw Error('must not fetch'); } }), /scope changed/);
  assert.equal(fetched, false);
});
