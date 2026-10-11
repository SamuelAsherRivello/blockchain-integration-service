import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApplications, ownedProfileKey } from './test-wallets/owned-browser.mjs';
import { assertGameProvenance, gameAdapter, gameUrl, verifyGameProvenance } from './test-wallets/game-adapter.mjs';

function vaultState() {
  const state = {};
  return { state, transaction: async work => work(state) };
}

test('game adapter is a fixed muted public registry entry', async () => {
  const vault = vaultState();
  await configureApplications(vault, 'http://127.0.0.1:5173');
  await configureApplications(vault, 'http://127.0.0.1:5173');
  const game = vault.state.applications.find(row => row.app === 'game');
  assert.deepEqual(game, {
    app: 'game', origin: 'http://127.0.0.1:5173', path: gameAdapter.path, search: gameAdapter.search,
    provenance: gameAdapter.provenance,
  });
  assert.equal(vault.state.applications.filter(row => row.app === 'game').length, 1);
  assert.equal(gameUrl(game), 'http://127.0.0.1:5173/blockchain-stealth-and-steel-game/?muteMusic=true&muteSFX=true');
  assert.notEqual(ownedProfileKey('pair', 'signet', game.origin, 'game'), ownedProfileKey('pair', 'signet', game.origin, 'marketplace'));
});

test('game provenance accepts the recorded public snapshot and rejects substitutions', () => {
  const evidence = `Package: @bis/integration 0.0.20\nSHA-256: ${gameAdapter.provenance.artifactSha256}`;
  assert.equal(verifyGameProvenance(evidence), true);
  assert.deepEqual(assertGameProvenance(evidence), gameAdapter.provenance);
  assert.equal(verifyGameProvenance(evidence.replace(gameAdapter.provenance.artifactSha256, 'wrong')), false);
  assert.throws(() => assertGameProvenance('Package: @bis/integration 0.0.20'), /game-provenance-unavailable/);
});

test('game URL validation rejects changed path or query', () => {
  assert.throws(() => gameUrl({ ...gameAdapter, origin: 'http://127.0.0.1:5173', path: '/other/' }), /game-adapter-invalid/);
  assert.throws(() => gameUrl({ ...gameAdapter, origin: 'http://127.0.0.1:5173', search: '?muteMusic=false' }), /game-adapter-invalid/);
});
