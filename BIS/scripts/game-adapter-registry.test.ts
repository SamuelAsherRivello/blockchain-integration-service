import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApplications, ownedProfileKey, ownedLaunchOptions, OwnedBrowser, playerRestoreEvidenceReady, safeTreasureUiSummary, visibleOwnedScreen } from './test-wallets/owned-browser.ts';

test('recovery acceptance uses separate protected profiles without changing established wallet paths',()=>{
  const original=ownedProfileKey('pair','signet','http://127.0.0.1:5174','admin');
  assert.equal(original,ownedProfileKey('pair','signet','http://127.0.0.1:5174','admin',undefined));
  assert.notEqual(original,ownedProfileKey('pair','signet','http://127.0.0.1:5174','admin','portable-a'));
  assert.throws(()=>ownedProfileKey('pair','signet','http://127.0.0.1:5174','admin','../unsafe'));
});
import { assertGameProvenance, gameAdapter, gameUrl, verifyGameProvenance, reconcileGameRegistration } from './test-wallets/game-adapter.ts';
import { argumentsFor, origin } from './test-wallets/arguments.ts';

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

test('published Pages origin is accepted only for the exact protected game adapter', async () => {
  const pages = 'https://samuelasherrivello.github.io';
  assert.equal(origin(pages, { app: 'game' }), pages);
  assert.throws(() => origin(pages), /invalid-origin/);
  assert.throws(() => origin(pages, { app: 'marketplace' }), /invalid-origin/);
  assert.throws(() => origin('https://samuelasherrivello.github.io.evil.example', { app: 'game' }), /invalid-origin/);
  assert.throws(() => origin('https://samuelasherrivello.github.io/other/', { app: 'game' }), /invalid-origin/);
  assert.equal(argumentsFor(['open', '--pair', 'treasure-c094-live', '--origin', pages, '--app', 'game']).values.origin, pages);
  assert.throws(() => argumentsFor(['open', '--pair', 'treasure-c094-live', '--origin', pages, '--app', 'marketplace']), /invalid-origin/);
  assert.throws(() => argumentsFor(['fund', '--account', 'recipient', '--network', 'signet', '--source', 'faucet',
    '--amount', '1000', '--operation', 'fund-pages', '--api', pages]), /invalid-origin/);
  assert.equal(argumentsFor(['init', '--origin', pages, '--app', 'game']).values.app, 'game');
  assert.throws(() => argumentsFor(['init', '--origin', pages]), /invalid-origin/);
  assert.throws(() => argumentsFor(['init', '--origin', 'http://127.0.0.1:5176', '--app', 'admin']), /invalid-application/);
  const vault = vaultState();
  await configureApplications(vault, 'http://127.0.0.1:5176');
  const before = structuredClone(vault.state.applications);
  await configureApplications(vault, pages, 'game');
  assert.deepEqual(vault.state.applications.filter(row => row.origin === 'http://127.0.0.1:5176'), before);
  assert.deepEqual(vault.state.applications.filter(row => row.origin === pages), [{
    app: 'game', origin: pages, path: gameAdapter.path, search: gameAdapter.search, provenance: gameAdapter.provenance,
  }]);
});

test('published recovery waits for explicit UI evidence without importing Vite source modules', () => {
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: true, playerIds: [] }, 'profile-a', true), true);
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: false, playerIds: ['profile-a'] }, 'profile-a'), true);
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: true, playerIds: [] }, 'profile-a'), false);
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: false, playerIds: ['profile-b'] }, 'profile-a'), false);
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: true, playerIds: [] }, 'profile-a', true), true);
  assert.equal(playerRestoreEvidenceReady({ confirmationOpen: true }, 'profile-a', true), false);
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

test('game treasure status projection exposes only safe fixed state', () => {
  assert.deepEqual(safeTreasureUiSummary({ status: 'awaiting-consent', contractId: 'public-contract-id', fundingConsentOpen: true }),
    { status: 'awaiting-consent', hasContract: true, fundingConsentOpen: true, chestOpen: false });
  assert.deepEqual(safeTreasureUiSummary({ status: 'secret', contractId: 'private', fundingConsentOpen: 1 }),
    { status: 'unknown', hasContract: true, fundingConsentOpen: false, chestOpen: false });
});

test('owned-browser permits the authenticated game screen after its account card closes', () => {
  assert.equal(visibleOwnedScreen('game', false), 'Game');
  assert.equal(visibleOwnedScreen('marketplace', false), undefined);
  assert.equal(visibleOwnedScreen('game', true, 'Game Wallet'), 'Game Wallet');
  assert.equal(visibleOwnedScreen('game', true, 'unexpected'), undefined);
});

test('game owned sessions dismiss Welcome before entering Account through Settings', async () => {
  const clicked = [];
  let welcomeOpen = true, accountVisible = false, cardVisible = false;
  const welcome = {
    count: async () => 1,
    isVisible: async () => welcomeOpen,
    getByRole: (_role, { name }) => ({
      waitFor: async ({ state }) => { assert.equal(name, 'Start Game'); assert.equal(state, 'visible'); clicked.push('wait-start'); },
      evaluate: async () => 'start-button',
      click: async () => { welcomeOpen = false; clicked.push('start'); },
    }),
    waitFor: async ({ state }) => { assert.equal(state, 'hidden'); assert.equal(welcomeOpen, false); },
  };
  const controls = new Map([
    ['⚡ Account', {
      count: async () => 1, isVisible: async () => accountVisible,
      waitFor: async ({ state }) => { assert.equal(state, 'visible'); clicked.push('wait-account'); },
      click: async () => { cardVisible = true; clicked.push('account'); },
    }],
    ['Open settings', { click: async () => { assert.equal(welcomeOpen, false); accountVisible = true; clicked.push('settings'); } }],
  ]);
  const owner = Object.create(OwnedBrowser.prototype);
  owner.registration = { application: { app: 'game' } };
  owner.page = {
    locator: () => ({ last: () => ({ isVisible: async () => cardVisible, waitFor: async ({ state }) => { assert.equal(state, 'visible'); assert.equal(cardVisible, true); } }) }),
    getByRole: (role, { name }) => role === 'dialog' && name === 'Welcome' ? welcome : controls.get(name),
  };
  await owner.accountDialog();
  assert.deepEqual(clicked, ['wait-start', 'start', 'settings', 'wait-account', 'account']);
});

test('game owned sessions keep an existing BIS dialog ahead of the covered Welcome screen', async () => {
  const owner = Object.create(OwnedBrowser.prototype);
  owner.registration = { application: { app: 'game' } };
  owner.page = {
    locator: () => ({ last: () => ({ isVisible: async () => true, waitFor: async ({ state }) => assert.equal(state, 'visible') }) }),
    getByRole: () => { throw new Error('covered Welcome controls must not be activated'); },
  };
  await owner.accountDialog();
});

test('game acceptance starts only one new session and refuses a second funded offer', async () => {
  let started = false, clicks = 0;
  const owner = Object.create(OwnedBrowser.prototype);
  owner.registration = { application: { app: 'game' } };
  owner.closed = false; owner.loggedOut = false;
  owner.inspect = async () => ({ network: 'signet', game: { source: 'server' }, treasure: { status: started ? 'awaiting-consent' : 'unknown', hasContract: false,
    fundingConsentOpen: started, chestOpen: false } });
  owner.page = {
    locator: () => ({ last: () => ({ isVisible: async () => false }) }),
    waitForTimeout: async () => {},
    getByRole: (_role, { name }) => name === 'Close settings'
      ? { first: () => ({ count: async () => 1, isVisible: async () => true, click: async () => {} }) }
      : { count: async () => 1, isVisible: async () => !started, click: async () => { started = true; clicks++; },
        waitFor: async ({ state }) => { assert.equal(state, 'hidden'); assert.equal(started, true); } },
    waitForFunction: async () => {},
  };
  const result = await owner.startGameForAcceptance();
  assert.equal(result.treasure.status, 'awaiting-consent');
  assert.equal(clicks, 1);
  await owner.startGameForAcceptance();
  assert.equal(clicks, 1, 'existing consent is returned without restarting');
  owner.inspect = async () => ({ network: 'signet', game: { source: 'server' },
    treasure: { status: 'active', hasContract: true, fundingConsentOpen: false, chestOpen: false } });
  await assert.rejects(owner.startGameForAcceptance(), /game-existing-treasure-unresolved/);
});

const predecessor = {packageName:'@bis/integration',version:'0.0.21',artifactSha256:'7418bdb7f0c6b51774d950a08c3613df296217957347829426e361f1c18e90b6',evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md'};
const previousRelease = {packageName:'@bis/integration',version:'0.0.28',artifactSha256:'6b318fb45a778ac8e136716e30ef63f89e036d65d8abb3ef2ab87f7352f23a46',evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md'};
const previousRelease29 = {packageName:'@bis/integration',version:'0.0.29',artifactSha256:'3617a257a9d1e48084d9e845d9d911747735d3dff9dcd6f4bb9fb0d51d89aff6',evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md'};
const pinned030 = {...gameAdapter,provenance:{packageName:'@bis/integration',version:'0.0.30',artifactSha256:'5f031b0915fb7b865679fdd080c74b3e906a58c0a0f6f1c8a0373a2165da6ede',evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md'}};
const registeredGame = provenance => ({app:'game',origin:'http://127.0.0.1:5175',path:gameAdapter.path,search:gameAdapter.search,provenance:{...provenance}});

test('exact trusted predecessor upgrades to current pinned30 only, preserving registration scope and original input',()=>{
 const original=registeredGame(predecessor),before=structuredClone(original);
 const updated=reconcileGameRegistration(original,original.origin,pinned030);
 assert.deepEqual(updated,{...original,provenance:pinned030.provenance});assert.deepEqual(original,before);
 assert.equal(ownedProfileKey('pair','mutinynet',updated.origin,updated.app),ownedProfileKey('pair','mutinynet',original.origin,original.app));
 assert.equal(reconcileGameRegistration(updated,updated.origin,pinned030),updated,'current descriptor is a no-op');
 assert.equal(reconcileGameRegistration(original,original.origin,{...gameAdapter,provenance:predecessor}),original,'current source is a no-op');
 const registered028=registeredGame(previousRelease);
 assert.deepEqual(reconcileGameRegistration(registered028,registered028.origin,pinned030),{...registered028,provenance:pinned030.provenance});
 const registered029=registeredGame(previousRelease29);
 assert.deepEqual(reconcileGameRegistration(registered029,registered029.origin,pinned030),{...registered029,provenance:pinned030.provenance});
});

test('registration upgrade rejects unknown predecessors, changed hashes/routes/query, duplicates and rollback',async()=>{
 const original=registeredGame(predecessor);
 for(const change of [{provenance:{...predecessor,version:'0.0.20'}},{provenance:{...predecessor,artifactSha256:'b'.repeat(64)}},
   {provenance:{...predecessor,extra:'unrecognized'}},{path:'/other/'},{search:'?muteMusic=false'},{origin:'http://127.0.0.1:5176'},{app:'marketplace'}]) {
  assert.throws(()=>reconcileGameRegistration({...original,...change},original.origin,pinned030),/game-registration-upgrade-refused/);
 }
 const newer=registeredGame(pinned030.provenance);
 assert.throws(()=>reconcileGameRegistration(newer,newer.origin,{...gameAdapter,provenance:predecessor}),/game-registration-upgrade-refused/);
 assert.throws(()=>reconcileGameRegistration(original,original.origin,{...pinned030,provenance:{...pinned030.provenance,version:'0.0.31'}}),/game-registration-upgrade-refused/);
 assert.throws(()=>reconcileGameRegistration(original,original.origin,{...pinned030,provenance:{...pinned030.provenance,artifactSha256:'a'.repeat(64)}}),/game-registration-upgrade-refused/);
 const vault=vaultState();vault.state.applications=[original,structuredClone(original)];const before=structuredClone(vault.state);
 await assert.rejects(configureApplications(vault,original.origin),/application-registry-invalid/);assert.deepEqual(vault.state,before);
});

test('open may use only an explicitly named isolated recovery profile',()=>{
 const base=['open','--pair','treasure-c094-live','--origin','https://samuelasherrivello.github.io','--app','game'];
 assert.equal(argumentsFor([...base,'--recovery-profile','address-check-01']).values.recoveryProfile,'address-check-01');
 for(const args of [
   [...base,'--recovery-profile','../outside'],
   [...base,'--recovery-profile','BadName'],
   ['status','--recovery-profile','address-check-01'],
 ])assert.throws(()=>argumentsFor(args),/invalid-recovery-profile/);
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

