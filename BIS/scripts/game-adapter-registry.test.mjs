import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApplications, ownedProfileKey, ownedLaunchOptions, OwnedBrowser } from './test-wallets/owned-browser.mjs';
import { assertGameProvenance, gameAdapter, gameUrl, verifyGameProvenance, reconcileGameRegistration } from './test-wallets/game-adapter.mjs';

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

const predecessor = {packageName:'@bis/integration',version:'0.0.21',artifactSha256:'7418bdb7f0c6b51774d950a08c3613df296217957347829426e361f1c18e90b6',evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md'};
const synthetic22 = {...gameAdapter,provenance:{...predecessor,version:'0.0.22',artifactSha256:'a'.repeat(64)}};
const registeredGame = provenance => ({app:'game',origin:'http://127.0.0.1:5175',path:gameAdapter.path,search:gameAdapter.search,provenance:{...provenance}});

test('exact trusted21 upgrades to current pinned22 only, preserving origin/path/query/profile key and original input',()=>{
 const original=registeredGame(predecessor),before=structuredClone(original);
 const updated=reconcileGameRegistration(original,original.origin,synthetic22);
 assert.deepEqual(updated,{...original,provenance:synthetic22.provenance});assert.deepEqual(original,before);
 assert.equal(ownedProfileKey('pair','mutinynet',updated.origin,updated.app),ownedProfileKey('pair','mutinynet',original.origin,original.app));
 assert.equal(reconcileGameRegistration(updated,updated.origin,synthetic22),updated,'current descriptor is a no-op');
 assert.equal(reconcileGameRegistration(original,original.origin,{...gameAdapter,provenance:predecessor}),original,'21 stays21 until real pin advances');
});

test('registration upgrade rejects unknown predecessors, changed hashes/routes/query, duplicates and rollback',async()=>{
 const original=registeredGame(predecessor);
 for(const change of [{provenance:{...predecessor,version:'0.0.20'}},{provenance:{...predecessor,artifactSha256:'b'.repeat(64)}},
   {provenance:{...predecessor,extra:'unrecognized'}},{path:'/other/'},{search:'?muteMusic=false'},{origin:'http://127.0.0.1:5176'},{app:'marketplace'}]) {
  assert.throws(()=>reconcileGameRegistration({...original,...change},original.origin,synthetic22),/game-registration-upgrade-refused/);
 }
 const newer=registeredGame(synthetic22.provenance);
 assert.throws(()=>reconcileGameRegistration(newer,newer.origin,{...gameAdapter,provenance:predecessor}),/game-registration-upgrade-refused/);
 assert.throws(()=>reconcileGameRegistration(original,original.origin,{...synthetic22,provenance:{...synthetic22.provenance,version:'0.0.23'}}),/game-registration-upgrade-refused/);
 const vault=vaultState();vault.state.applications=[original,structuredClone(original)];const before=structuredClone(vault.state);
 await assert.rejects(configureApplications(vault,original.origin),/application-registry-invalid/);assert.deepEqual(vault.state,before);
});

test('configuration is idempotent and preserves all nonregistration state and unrelated applications',async()=>{
 const vault=vaultState();
 Object.assign(vault.state,{accounts:[{label:'synthetic',generation:7,reportedPending:{signet:{kind:'onboard',source:'user-reported'}}}],pairs:[{label:'original-pair'}],operations:[{state:'unknown',intent:{id:'held-signet',network:'signet'}}],archivedAccounts:[{generation:6}]});
 await configureApplications(vault,'http://127.0.0.1:5174');
 const unrelated=structuredClone(vault.state.applications),originalState=structuredClone(vault.state);
 await configureApplications(vault,'http://127.0.0.1:5175');
 assert.deepEqual(vault.state.applications.filter(row=>row.origin==='http://127.0.0.1:5174'),unrelated);
 for(const key of ['accounts','pairs','operations','archivedAccounts'])assert.deepEqual(vault.state[key],originalState[key]);
 const registered=vault.state.applications,before=structuredClone(vault.state);
 await configureApplications(vault,'http://127.0.0.1:5175');assert.equal(vault.state.applications,registered);assert.deepEqual(vault.state,before);
});

test('incompatible existing game registration refuses before adding other rows or touching held operations',async()=>{
 const vault=vaultState();Object.assign(vault.state,{applications:[registeredGame({...predecessor,artifactSha256:'b'.repeat(64)})],operations:[{state:'unknown',intent:{id:'held-signet',network:'signet'}}]});
 const before=structuredClone(vault.state);
 await assert.rejects(configureApplications(vault,'http://127.0.0.1:5175'),/game-registration-upgrade-refused/);
 assert.deepEqual(vault.state,before);
});
