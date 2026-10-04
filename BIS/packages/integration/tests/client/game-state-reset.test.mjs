import test from 'node:test';
import assert from 'node:assert/strict';
import { clearBrowserForceReset } from '../../src/client/state-layer-core/logout-cleanup.ts';
import { createContext, getControls } from '../../src/client/state-layer-core/context.ts';

function memory(entries = []) {
  const data = new Map(entries);
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

const secret = { phrase: 'isolated-reset-placeholder', profileId: 'reset-player' };

test('force-reset browser cleanup removes BIS state but preserves host state', () => {
  const storage = memory([
    ['bis-signet-send-operation-v1:player', 'pending'],
    ['bis-game-wallet-send-owner:game', '1'],
    ['bis.integration-demo.preview-scale', '1'],
    ['host-game-settings', 'keep'],
  ]);
  clearBrowserForceReset(storage);
  assert.equal(storage.getItem('host-game-settings'), 'keep');
  assert.equal(storage.getItem('bis-signet-send-operation-v1:player'), null);
  assert.equal(storage.getItem('bis-game-wallet-send-owner:game'), null);
  assert.equal(storage.getItem('bis.integration-demo.preview-scale'), null);
});

test('force-reset is serialized and clears an active context without logout acknowledgements', async () => {
  let account = null;
  let generation = 0;
  let resets = 0;
  const listeners = new Set();
  const storage = {
    load: async () => ({ account, generation }),
    save: async value => { account = value; },
    reset: async () => { account = null; generation++; },
    forceReset: async () => { resets++; account = null; generation++; for (const listener of listeners) listener(); },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const context = createContext(storage, async () => secret, async () => secret.profileId);
  await context.ready();
  await context.createAccount();
  await context.continueAccount();
  await Promise.all([getControls(context).forceReset('reset-1'), getControls(context).forceReset('reset-1')]);
  assert.equal(resets, 1);
  assert.equal(context.getState().hasProfile, false);
  assert.equal(context.getState().phase, 'idle');
  assert.equal(context.getState().logoutBackupAcknowledged, false);
  context.dispose();
});

test('force-reset invalidates another live context before it can restore the old account', async () => {
  let account = secret;
  let generation = 0;
  const listeners = new Set();
  const storage = {
    load: async () => ({ account, generation }),
    save: async value => { account = value; },
    reset: async () => { account = null; generation++; for (const listener of listeners) listener(); },
    forceReset: async () => { account = null; generation++; for (const listener of listeners) listener(); },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const first = createContext(storage, async () => secret, async () => secret.profileId);
  const second = createContext(storage, async () => secret, async () => secret.profileId);
  await Promise.all([first.ready(), second.ready()]);
  assert.equal(second.getState().hasProfile, true);
  await getControls(first).forceReset('reset-2');
  await second.ready();
  assert.equal(second.getState().hasProfile, false);
  first.dispose();
  second.dispose();
});
