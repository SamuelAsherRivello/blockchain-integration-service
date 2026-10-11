import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApplications, ownedProfileKey, ownedLaunchOptions, OwnedBrowser } from './test-wallets/owned-browser.mjs';
import { assertGameProvenance, gameAdapter, gameUrl, verifyGameProvenance } from './test-wallets/game-adapter.mjs';

function vaultState() {
  const state = {};
  return { state, transaction: async work => work(state) };
}

test('verified Edge WebGPU launch settings apply only to Windows game sessions', () => {
  assert.deepEqual(ownedLaunchOptions('game', 'win32'), {
    channel: 'msedge', args: ['--enable-unsafe-webgpu', '--mute-audio'],
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  });
  for (const app of ['admin', 'marketplace', 'onboarding']) assert.deepEqual(ownedLaunchOptions(app, 'win32'), {});
  assert.deepEqual(ownedLaunchOptions('game', 'linux'), {});
});

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
  const evidence = `Package: @bis/integration ${gameAdapter.provenance.version}\nSHA-256: ${gameAdapter.provenance.artifactSha256}`;
  assert.equal(verifyGameProvenance(evidence), true);
  assert.deepEqual(assertGameProvenance(evidence), gameAdapter.provenance);
  assert.equal(verifyGameProvenance(evidence.replace(gameAdapter.provenance.artifactSha256, 'wrong')), false);
  assert.equal(verifyGameProvenance(evidence.replace(gameAdapter.provenance.version, '0.0.20')), false);
  assert.throws(() => assertGameProvenance('Package: @bis/integration 0.0.20'), /game-provenance-unavailable/);
});

test('game URL validation rejects changed path or query', () => {
  assert.throws(() => gameUrl({ ...gameAdapter, origin: 'http://127.0.0.1:5173', path: '/other/' }), /game-adapter-invalid/);
  assert.throws(() => gameUrl({ ...gameAdapter, origin: 'http://127.0.0.1:5173', search: '?muteMusic=false' }), /game-adapter-invalid/);
});

test('game owned sessions enter Account through the game Settings gear', async () => {
  const clicked = [];
  const controls = new Map([
    ['⚡ Account', { count: async () => 1, isVisible: async () => false, click: async () => clicked.push('account') }],
    ['Open settings', { click: async () => clicked.push('settings') }],
  ]);
  const owner = Object.create(OwnedBrowser.prototype);
  owner.registration = { application: { app: 'game' } };
  owner.page = {
    locator: () => ({ last: () => ({ isVisible: async () => false, waitFor: async () => {} }) }),
    getByRole: (_role, { name }) => controls.get(name),
  };
  await owner.accountDialog();
  assert.deepEqual(clicked, ['settings', 'account']);
});
