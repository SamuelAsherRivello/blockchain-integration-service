import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { bisMarketplaceItems, marketplaceItemMetadata } from '../../src/client/state-layer-core/equipment.ts';

// Isolated unit adapters, never installed in an application or used as live evidence.
function observable(initial) {
  let state = initial;
  const listeners = new Set();
  return { getState: () => state, listeners,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(value) { state = { ...state, ...value }; for (const fn of listeners) fn(); },
    dispose() { listeners.clear(); },
  };
}
function fixture() {
  const events = [], effects = [], requests = [], contextEvents = new Set();
  let session = { gameId: 'unit-game', gameSessionId: 'run-1' };
  const context = observable({ view: 'empty', hasProfile: true, profileId: 'player', phase: 'active', network: 'signet' });
  const wallet = observable({ status: 'ready', profileId: 'game-wallet', network: 'signet', playerConnected: true, balance: { availableSats: 5000 } });
  let contracts = [], resetFailure = false, mintWait;
  Object.assign(context, {
    readyAsync: async () => {},
    onEvent: fn => { contextEvents.add(fn); return () => contextEvents.delete(fn); },
    openAccountDialog: () => context.set({ view: 'account' }),
    getContinueRecipient: () => 'unit-recipient',
    requestContinue: async request => { requests.push(request); return { ...request, profileId: 'player', status: 'succeeded' }; },
    getContinueStatus: async () => [], showToast: () => {},
    getPendingAssetMint: async () => ({ status: 'success', profileId: 'player', request: null }),
    listAssets: async () => ({ status: 'success', profileId: 'player', assets: [] }),
    mintAsset: async request => {
      requests.push(request); if (mintWait) await mintWait;
      return { status: 'minted', profileId: 'player', operationId: request.operationId,
        asset: { ...request, assetId: 'unit-asset', quantity: request.amount } };
    },
    controls: { forceReset: async () => context.set({ hasProfile: false, profileId: undefined, phase: 'idle', view: 'empty' }) },
  });
  Object.assign(wallet, { refresh: async () => {}, logout: async () => { wallet.set({ status: 'empty', profileId: undefined, addresses: undefined }); }, reset: async () => !resetFailure });
  const lto = observable({});
  Object.assign(lto, {
    checkContractsAsync: async () => ({ status: 'ready', contracts }), reconcile: async () => {},
    start: async request => { requests.push(request); return { status: 'pending' }; },
    claim: async () => ({ status: 'pending' }), reject: async () => ({ status: 'pending' }),
    endSession: async id => requests.push({ ended: id }), reset: async () => { contracts = []; },
  });
  const ui = { mount: () => {}, isLoadingUIVisible: () => context.getState().view === 'account',
    showLoadingUI: () => {}, hideLoadingUI: () => {}, unmount: () => {} };
  const host = {
    getActiveGameSession: () => session,
    captureContinuationTarget: () => session ? { continuationTargetId: 'loss-1' } : undefined,
    applyConfirmedContinuationAsync: async input => { effects.push(input); return { status: 'applied' }; },
    presentConfirmedPlayerRewardAsync: async input => { effects.push(input); return { status: 'applied' }; },
    onBisEvent: event => events.push(event),
  };
  return { context, wallet, lto, ui, host, events, effects, requests, contextEvents,
    replaceRun: () => { session = { gameId: 'unit-game', gameSessionId: 'run-2' }; },
    endRun: () => { session = undefined; }, failReset: value => { resetFailure = value; },
    delayMint: promise => { mintWait = promise; },
    publishContracts: values => { contracts = values; lto.set({}); },
  };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('BisService owns private resources and routes game workflows through the two contracts', async t => {
  const key = `__bisUnitFixture${process.pid}`;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const selections = new Map();
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: key => selections.get(key) ?? null, setItem: (key, value) => selections.set(key, value),
  }, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { locks: {} }, configurable: true });
  const mocks = new Map([
    ['/wallet-layer-arkade/context-composition.ts', `export const createBisContext=()=>globalThis.${key}.context;`],
    ['/state-layer-core/context.ts', 'export const getControls=context=>context.controls;export const invalidateContractPresentation=()=>{};'],
    ['/state-layer-core/game-wallet.ts', `export const createBisGameWallet=()=>globalThis.${key}.wallet;`],
    ['/state-layer-core/lto-service.ts', `export const createBisLto=()=>globalThis.${key}.lto;`],
    ['/ui-layer-react/client.tsx', `export const createBisUi=()=>globalThis.${key}.ui;`],
  ]);
  const server = await createServer({ configFile: false, appType: 'custom',
    cacheDir: `output/tests/client/bis-facade-${process.pid}`, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/output/**'] } },
    plugins: [{ name: 'unit-only-facade-adapters', enforce: 'pre', load(id) {
      for (const [suffix, code] of mocks) if (id.replaceAll('\\', '/').endsWith(suffix)) return code;
    } }],
  });
  t.after(async () => {
    delete globalThis[key];
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    await server.close();
  });
  const { BisService } = await server.ssrLoadModule('/BIS/packages/integration/src/client/integration-layer/bis-service.ts');
  function create() {
    const f = fixture(); globalThis[key] = f;
    const service = new BisService({ getBisGame: () => f.host });
    t.after(() => service.dispose({ preserveContracts: true }));
    return { ...f, service, replaceHost: host => { f.host = host; } };
  }
  await t.test('private fields, owned listeners and copied/frozen projections', async () => {
    const f = create(); await f.service.readyAsync();
    for (const name of ['context', 'gameWallet', 'lto', 'ui', 'createContinue', 'createAssetCollection', 'createEquipment']) assert.equal(name in f.service, false);
    assert.equal(f.service.hasItemSupport(), true);
    const snapshot = f.service.getSnapshot();
    assert.equal(Object.isFrozen(snapshot.account.playerWallet), true);
    assert.throws(() => { snapshot.account.hasProfile = false; }, TypeError);
    assert.equal('addresses' in snapshot.account.gameWallet, false);
    assert.equal(f.contextEvents.size, 1); assert.equal(f.lto.listeners.size, 1);
    f.service.dispose(); f.service.dispose();
    assert.equal(f.context.listeners.size, 0); assert.equal(f.contextEvents.size, 0);
    assert.equal(f.wallet.listeners.size, 0); assert.equal(f.lto.listeners.size, 0);
    assert.equal(f.service.getSnapshot().disposed, true);
  });
  await t.test('Account dismissal and stable logout event use IBisGame, even with a throwing/reentrant host', () => {
    const f = create(); f.service.openAccountDialog(); f.context.set({ view: 'empty' });
    assert.equal(f.events.filter(event => event.type === 'accountClosed').length, 1);
    const closeIndex = f.events.findIndex(event => event.type === 'accountClosed');
    assert.equal(f.events[closeIndex - 1].type, 'stateChanged');
    assert.equal(f.events[closeIndex - 1].snapshot.account.visible, false);
    for (const listener of f.contextEvents) listener({ type: 'restartRequested', reason: 'logout', logoutId: 'logout-1' });
    assert.equal(f.events.at(-1).logoutId, 'logout-1');
    let calls = 0;
    f.host.onBisEvent = () => { calls++; f.service.openAccountDialog(); throw Error('unit host failure'); };
    assert.doesNotThrow(() => f.context.set({ view: 'empty' })); assert.ok(calls <= 2);
  });
  await t.test('Player disconnect logs out the active Game Wallet', async () => {
    const f = create(); await f.service.readyAsync();
    let logoutCalls = 0;
    const logout = f.wallet.logout;
    f.wallet.logout = async () => { logoutCalls++; await logout(); };
    for (const listener of f.contextEvents) listener({ type: 'accountDisconnected', profileId: 'player' });
    await settle();
    assert.equal(logoutCalls, 1);
    assert.equal(f.wallet.getState().profileId, undefined);
    f.service.dispose();
  });
  await t.test('Account lifecycle events stay on the game channel and never reload the browser', async () => {
    const f = create(); await f.service.readyAsync();
    let reloads = 0;
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: { location: { reload: () => { reloads++; } } }, configurable: true });
    try {
      for (const listener of f.contextEvents) listener({ type: 'accountConnected', profileId: 'new-player' });
      for (const listener of f.contextEvents) listener({ type: 'accountDisconnected', profileId: 'new-player' });
      assert.deepEqual(f.events.filter(event => event.type === 'accountConnected' || event.type === 'accountDisconnected').slice(-2).map(event => [event.type, event.profileId]), [
        ['accountConnected', 'new-player'], ['accountDisconnected', 'new-player'],
      ]);
      assert.equal(reloads, 0);
      assert.equal(Object.isFrozen(f.events.at(-1)), true);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else delete globalThis.window;
      f.service.dispose();
    }
  });
  await t.test('snapshots allowlist state and distinguish unavailable from empty without old-wallet leakage', async () => {
    const f = create(); await f.service.readyAsync();
    assert.equal(f.service.getSnapshot().contracts.status, 'ready');
    f.context.set({ recoveryPhrase: 'unit-private-marker', error: 'unit-private-marker' });
    assert.equal(JSON.stringify(f.service.getSnapshot()).includes('unit-private-marker'), false);
    f.lto.checkContractsAsync = async () => { throw Error('unit-private-provider-error'); };
    assert.equal((await f.service.queryContractsAsync()).status, 'unavailable');
    assert.equal(JSON.stringify(f.service.getSnapshot()).includes('unit-private-provider-error'), false);
    f.lto.checkContractsAsync = async () => ({ status: 'ready', contracts: [{ id: 'old-wallet-offer', sessionId: 'old-offer' }] });
    await f.service.queryContractsAsync(); f.context.set({ profileId: 'replacement-player' });
    assert.equal(f.service.getSnapshot().contracts.status, 'unavailable');
    f.service.dispose(); await settle();
  });
  await t.test('begin does not pay; concurrent pay delivers one confirmed origin effect', async () => {
    const f = create(), workflow = f.service.beginContinuation();
    assert.equal(workflow.sats, 1000); assert.equal(f.requests.length, 0);
    await Promise.all([f.service.payContinuationAsync(workflow.workflowId), f.service.payContinuationAsync(workflow.workflowId)]); await settle();
    assert.equal(f.requests.length, 1); assert.equal(f.effects.length, 1);
    assert.equal(f.service.getSnapshot().continuations[0].effectReceipt.status, 'applied');
    f.service.endContinuation(workflow.workflowId);
    await assert.rejects(f.service.payContinuationAsync(workflow.workflowId), /Unknown or ended/);
  });
  await t.test('no current continuation target or replaced run cannot initiate payment', async () => {
    const f = create(); f.endRun(); assert.throws(() => f.service.beginContinuation(), /current game/);
    const g = create(), workflow = g.service.beginContinuation(); g.replaceRun();
    await assert.rejects(g.service.payContinuationAsync(workflow.workflowId), /session has ended/);
    assert.equal(g.requests.length, 0);
  });
  await t.test('pending submission exposes its bound operation without claiming a game receipt', async () => {
    const f = create(); let release;
    const gate = new Promise(resolve => { release = resolve; });
    f.context.requestContinue = async request => { f.requests.push(request); await gate; return { ...request, profileId: 'player', status: 'pending' }; };
    const workflow = f.service.beginContinuation();
    const work = f.service.payContinuationAsync(workflow.workflowId); await settle();
    const state = f.service.getSnapshot().continuations[0];
    assert.equal(state.status, 'pending'); assert.equal(state.operation.operationId, f.requests[0].operationId);
    assert.equal(state.operation.gameSession.gameSessionId, 'run-1'); assert.equal(state.effectReceipt, undefined);
    assert.ok(f.events.some(event => event.type === 'operationChanged' && !event.effectReceipt));
    release(); await work; assert.equal(f.effects.length, 0); f.service.endContinuation(workflow.workflowId);
  });
  await t.test('reward captures origin before mint, preserves quantity and isolates effect receipt', async () => {
    const f = create();
    const workflow = f.service.beginReward({ asset: { name: 'Unit Trophy', ticker: 'UNIT', decimals: 0, amount: '3' }, successMessage: 'Unit collected' });
    assert.equal(f.requests.length, 0); await f.service.refreshRewardAsync(workflow.workflowId);
    await f.service.collectRewardAsync(workflow.workflowId); await settle();
    assert.equal(f.requests.length, 1); assert.equal(f.effects.length, 1);
    assert.equal(f.effects[0].kind, 'asset'); assert.equal(f.effects[0].asset.quantity, '3');
    assert.equal(f.service.getSnapshot().rewards[0].effectReceipt.status, 'applied');
    await f.service.collectRewardAsync(workflow.workflowId); assert.equal(f.requests.length, 1);
  });
  await t.test('a late mint never targets the replacement run or remints for failed delivery', async () => {
    const f = create(); let release; f.delayMint(new Promise(resolve => { release = resolve; }));
    const workflow = f.service.beginReward({ asset: { name: 'Unit Trophy', ticker: 'UNIT', decimals: 0, amount: '1' }, successMessage: 'Unit collected' });
    await f.service.refreshRewardAsync(workflow.workflowId);
    const work = f.service.collectRewardAsync(workflow.workflowId); await settle(); f.replaceRun(); release();
    await work; await settle(); assert.equal(f.effects.length, 0); assert.equal(f.requests.length, 1);
    assert.equal(f.service.getSnapshot().rewards[0].effectReceipt.status, 'not-applicable');
  });
  await t.test('a rejected reward effect leaves the mint confirmed and cannot trigger recollection', async () => {
    const f = create(); f.host.presentConfirmedPlayerRewardAsync = async () => { throw Error('unit presentation failure'); };
    const workflow = f.service.beginReward({ asset: { name: 'Unit Trophy', ticker: 'UNIT', decimals: 0, amount: '1' }, successMessage: 'Unit collected' });
    await f.service.refreshRewardAsync(workflow.workflowId); await f.service.collectRewardAsync(workflow.workflowId); await settle();
    const state = f.service.getSnapshot().rewards[0];
    assert.equal(state.status, 'owned'); assert.equal(state.effectReceipt.status, 'not-applicable');
    await f.service.checkRewardAsync(workflow.workflowId); await f.service.collectRewardAsync(workflow.workflowId);
    assert.equal(f.requests.length, 1);
  });
  await t.test('host replacement suppresses a late confirmed continuation without resubmission', async () => {
    const f=create();let release;
    const gate=new Promise(resolve=>{release=resolve;});
    f.context.requestContinue=async request=>{f.requests.push(request);await gate;return {...request,profileId:'player',status:'succeeded'};};
    const workflow=f.service.beginContinuation(),work=f.service.payContinuationAsync(workflow.workflowId);
    await settle();f.replaceHost({...f.host});release();await work;await settle();
    assert.equal(f.effects.length,0);assert.equal(f.requests.length,1);
    assert.equal(f.service.getSnapshot().continuations[0].effectReceipt.status,'not-applicable');
    await f.service.checkContinuationAsync(workflow.workflowId);assert.equal(f.requests.length,1);
  });
  await t.test('reset suppresses late mint effects/events and disposes transient workflows', async () => {
    const f=create();let release;f.delayMint(new Promise(resolve=>{release=resolve;}));
    const workflow=f.service.beginReward({asset:{name:'Unit Trophy',ticker:'UNIT',decimals:0,amount:'1'},successMessage:'Unit collected'});
    await f.service.refreshRewardAsync(workflow.workflowId);
    const work=f.service.collectRewardAsync(workflow.workflowId);await settle();
    assert.equal((await f.service.resetForGameAsync()).status,'completed');
    const events=f.events.length;release();await work.catch(()=>{});await settle();
    assert.equal(f.effects.length,0);assert.equal(f.events.length,events);
    assert.equal(f.service.getSnapshot().rewards.length,0);assert.equal(f.requests.length,1);
  });
  await t.test('equipment uses Player-only readiness, recognizes all nine items and validates selection', async () => {
    const f = create(); f.wallet.set({ status: 'empty', profileId: undefined });
    const assets = bisMarketplaceItems.map((item, index) => ({ assetId: `unit-item-${index}`, quantity: '1', iconUrl: item.iconUrl,
      metadata: { bisSchemaVersion: '1', ...marketplaceItemMetadata(item) } }));
    f.context.listAssets = async () => ({ status: 'success', profileId: 'player', assets });
    assert.equal(f.service.hasItemSupport(), true); assert.equal(f.service.hasContractSupport(), false);
    assert.equal((await f.service.refreshEquipmentAsync()).ownedItems.length, 9);
    assert.equal((await f.service.selectEquipmentAsync('unit-item-0')).effective.Shoes.tier, 1);
    assert.equal((await f.service.selectEquipmentAsync('unit-item-1')).effective.Shoes.tier, 2);
    assert.equal((await f.service.clearEquipmentAsync('Shoes')).effective.Shoes, undefined);
    await assert.rejects(f.service.selectEquipmentAsync('unowned'), /freshly owned/);
  });
  await t.test('closed-window contract updates publish without a game poll', async () => {
    const f = create(); await f.service.readyAsync(); f.events.length = 0;
    f.publishContracts([{ id: 'offer-1', sessionId: 'offer-session', financial: 'funded', amountSats: 1000 }]);
    await settle(); assert.equal(f.service.getSnapshot().contracts.contracts[0].offerSessionId, 'offer-session');
    assert.ok(f.events.some(event => event.type === 'stateChanged' && event.snapshot.contracts.contracts.length === 1));
    assert.equal(f.context.getState().view, 'empty');
  });
  await t.test('contract offer identity is distinct from run/wallet identity and sats delivery is once', async () => {
    const f = create(), now = Date.now();
    await f.service.startContractAsync({ offerSessionId: 'offer-session', purpose: 'treasure', hostReference: 'chest',
      amountSats: 1250, startedAt: now, expiresAt: now + 90000, exclusivityKey: 'treasure' });
    assert.equal(f.requests[0].sessionId, 'offer-session'); assert.equal('offerSessionId' in f.requests[0], false);
    const confirmed = { id: 'contract-1', sessionId: 'offer-session', financial: 'claimed', amountSats: 1250, operationId: 'claim-1', purpose: 'treasure' };
    f.publishContracts([confirmed]); await settle(); f.publishContracts([confirmed]); await settle();
    assert.equal(f.effects.length, 1); assert.equal(f.effects[0].kind, 'sats'); assert.equal(f.effects[0].amountSats, 1250);
    assert.equal(f.effects[0].gameSession.gameSessionId, 'run-1');
    await f.service.endContractSessionAsync('offer-session'); assert.equal(f.requests.at(-1).ended, 'offer-session');
  });
  await t.test('late sats confirmation keeps financial truth without affecting a replacement run', async () => {
    const f=create(),now=Date.now();
    await f.service.startContractAsync({offerSessionId:'old-offer',purpose:'treasure',hostReference:'chest',amountSats:1250,startedAt:now,expiresAt:now+90000,exclusivityKey:'treasure'});
    f.replaceRun();f.publishContracts([{id:'old-contract',sessionId:'old-offer',financial:'claimed',amountSats:1250,operationId:'old-claim',purpose:'treasure'}]);await settle();
    assert.equal(f.effects.length,0);assert.equal(f.service.getSnapshot().contracts.contracts[0].financial,'claimed');
    assert.ok(f.events.some(event=>event.type==='operationChanged'&&event.effectReceipt?.status==='not-applicable'));
  });
  await t.test('duplicate or ended offer IDs cannot rebind financial delivery to a new run', async () => {
    const f=create(),now=Date.now(),request={offerSessionId:'bound-offer',purpose:'treasure',hostReference:'chest',amountSats:1250,startedAt:now,expiresAt:now+90000,exclusivityKey:'treasure'};
    await f.service.startContractAsync(request);f.replaceRun();
    assert.equal((await f.service.startContractAsync(request)).status,'unavailable');assert.equal(f.requests.length,1);
    f.publishContracts([{id:'bound-contract',sessionId:'bound-offer',financial:'claimed',amountSats:1250,operationId:'bound-claim',purpose:'treasure'}]);await settle();assert.equal(f.effects.length,0);
    await f.service.endContractSessionAsync('bound-offer');
    assert.equal((await f.service.startContractAsync(request)).status,'unavailable');
  });
  await t.test('absent-wallet reset succeeds and disposal passes the explicit preservation policy', async () => {
    const f=create();f.wallet.set({status:'empty',profileId:undefined});f.context.set({hasProfile:false,profileId:undefined,phase:'idle'});
    assert.equal((await f.service.resetForGameAsync()).status,'completed');
    let policy;f.lto.dispose=options=>{policy=options;};
    f.service.dispose({preserveContracts:true});assert.deepEqual(policy,{endSessions:false});
    const g=create();g.lto.dispose=options=>{policy=options;};g.service.dispose();assert.deepEqual(policy,{endSessions:true});
  });
  await t.test('reset is serialized, truthful, retryable and invalidates workflow delivery', async () => {
    const f = create(); f.service.beginContinuation(); f.failReset(true);
    const first = f.service.resetForGameAsync(), second = f.service.resetForGameAsync(); assert.equal(first, second);
    assert.equal((await first).status, 'failed'); assert.equal(f.service.getSnapshot().continuations.length, 0);
    f.failReset(false); assert.equal((await f.service.resetForGameAsync()).status, 'completed');
    assert.equal(f.service.getSnapshot().account.hasProfile, false);
    f.service.dispose(); assert.equal((await f.service.resetForGameAsync()).error.code, 'disposed');
  });
});
