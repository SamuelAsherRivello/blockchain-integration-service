import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, createBisAdminContext, getControls } from '../src/core/context.ts';

const identity = { phrase: 'test-double-only', profileId: 'profile-a' };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let account = identity, generation = 0, clears = 0;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const storage = {
    load: async () => ({ account, generation }),
    save: async (next, expected, signal) => {
      signal.throwIfAborted();
      if (generation !== expected || account) throw Error('stale');
      account = next;
    },
    reset: async (expected) => {
      if (expected !== undefined && generation !== expected) throw Error('stale');
      clears++; generation++; account = null; notify();
    },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const make = () => createContext(storage, async () => identity, async () => account?.profileId ?? identity.profileId);
  return { storage, make, notify, clears: () => clears, replace(next) { generation++; account = next; notify(); } };
}
async function confirm(context) {
  await context.ready(); context.openAccountDialog(); context.openLogoutConfirmation();
  context.setLogoutBackupAcknowledged(true);
}

test('logout passes the reviewed operation snapshot to complete cleanup', async () => {
  const f = fixture(), c = f.make(), reset = f.storage.reset;
  f.storage.reset = async (generation, options) => {
    assert.deepEqual(options, { purpose: 'logout', profileId:identity.profileId, operations: {count:0,fingerprint:'[]'} });
    await reset(generation);
  };
  await confirm(c); await c.confirmLogout();
  assert.equal(c.getState().phase, 'idle');
  c.dispose();
});

test('logout requires acknowledgement, cancels, resets checkbox and preserves host destination', async () => {
  const f = fixture(), c = f.make(); await c.ready(); getControls(c).present(); c.openAccountDialog();
  c.openLogoutConfirmation(); await c.confirmLogout(); assert.equal(f.clears(), 0);
  c.setLogoutBackupAcknowledged(true); c.cancelLogout(); assert.equal(c.getState().phase, 'active');
  c.openLogoutConfirmation(); assert.equal(c.getState().logoutBackupAcknowledged, false);
  c.setLogoutBackupAcknowledged(true); c.setLogoutBackupAcknowledged(false); await c.confirmLogout(); assert.equal(f.clears(), 0);
  c.setLogoutBackupAcknowledged(true); await c.confirmLogout();
  assert.equal(c.getState().hasProfile, false); assert.equal(c.getState().view, 'account');
  c.closeAccount(); assert.equal(c.getState().view, 'account-button');
  const reload = f.make(); await reload.ready(); assert.equal(reload.getState().hasProfile, false);
  c.dispose(); reload.dispose();
});

test('failed clearing stays in dialogue with retry and no premature event', async () => {
  const f = fixture(), c = f.make(), original = f.storage.reset; let fail = true;
  f.storage.reset = async (...args) => { if (fail) throw Error('private details'); await original(...args); };
  const events = []; c.onEvent(e => events.push(e)); await confirm(c); await c.confirmLogout();
  assert.equal(c.getState().phase, 'logout-error'); assert.equal(c.getState().view, 'account');
  assert.equal(c.getState().error.includes('private details'), false); assert.equal(events.length, 0);
  c.setLogoutBackupAcknowledged(false); await c.retry(); assert.equal(f.clears(), 0);
  c.setLogoutBackupAcknowledged(true); fail = false; await c.retry();
  assert.deepEqual(events, [{ type: 'accountDisconnected', profileId: identity.profileId }]); c.dispose();
});

test('ambiguous completion retries by reconciling absence without clearing twice', async () => {
  const f = fixture(), c = f.make(), original = f.storage.reset;
  f.storage.reset = async (...args) => { await original(...args); throw Error('after commit'); };
  await confirm(c); await c.confirmLogout(); assert.equal(c.getState().phase, 'logout-error');
  await c.retry(); assert.equal(c.getState().phase, 'idle'); assert.equal(f.clears(), 1); c.dispose();
});

test('duplicate submission and cancellation cannot interrupt pending logout', async () => {
  const f = fixture(), c = f.make(), original = f.storage.reset; let release;
  const gate = new Promise(resolve => release = resolve);
  f.storage.reset = async (...args) => { await gate; await original(...args); };
  await confirm(c); const work = c.confirmLogout(); await flush();
  c.cancelLogout(); c.closeAccount(); await c.confirmLogout(); assert.equal(c.getState().phase, 'logging-out');
  release(); await work; assert.equal(f.clears(), 1); c.dispose();
});

test('replacement account invalidates old confirmation and its acknowledgement', async () => {
  const f = fixture(), c = f.make(); await confirm(c);
  f.replace({ phrase: 'test-double-b', profileId: 'profile-b' }); await c.ready();
  await c.confirmLogout(); assert.equal(f.clears(), 0); assert.equal(c.getState().profileId, 'profile-b');
  c.openLogoutConfirmation(); assert.equal(c.getState().logoutBackupAcknowledged, false); c.dispose();
});

test('replacement during failed logout is not cleared by Retry', async () => {
  const f = fixture(), c = f.make(); f.storage.reset = async () => { throw Error('failed'); };
  await confirm(c); await c.confirmLogout(); f.replace({ phrase: 'b', profileId: 'profile-b' });
  await c.retry(); assert.equal(f.clears(), 0); assert.equal(c.getState().profileId, 'profile-b');
  assert.equal(c.getState().logoutBackupAcknowledged, false); c.dispose();
});

test('two contexts emit one disconnection each; empty hydration emits none', async () => {
  const f = fixture(), a = f.make(), b = f.make(), ae = [], be = [];
  a.onEvent(e => ae.push(e)); b.onEvent(e => be.push(e)); await b.ready(); await confirm(a); await a.confirmLogout(); await b.ready();
  f.notify(); await b.ready(); assert.equal(ae.length, 1); assert.equal(be.length, 1);
  const empty = f.make(), ee = []; empty.onEvent(e => ee.push(e)); await empty.ready(); assert.equal(ee.length, 0);
  a.dispose(); b.dispose(); empty.dispose();
});

test('dispose and admin reset invalidate delayed logout publications', async () => {
  for (const reset of [false, true]) {
    const f = fixture(), c = f.make(), original = f.storage.reset; let release, first = true;
    f.storage.reset = async (...args) => {
      if (first) { first = false; await new Promise(resolve => release = resolve); }
      await original(...args);
    };
    const events = []; c.onEvent(e => events.push(e)); await confirm(c);
    const work = c.confirmLogout(); await flush();
    if (reset) await createBisAdminContext(c).resetClient(); else c.dispose();
    const count = events.length; release(); await work; assert.equal(events.length, count);
    if (reset) { assert.equal(c.getState().view, 'empty'); c.dispose(); }
  }
});

test('read-back failure does not report success and Retry verifies the committed absence', async () => {
  const f=fixture(), c=f.make(), load=f.storage.load, reset=f.storage.reset; let failRead=false;
  f.storage.load=async()=>{if(failRead)throw Error('read failed');return load();};
  f.storage.reset=async(...args)=>{await reset(...args);failRead=true;};
  const events=[];c.onEvent(e=>events.push(e));await confirm(c);await c.confirmLogout();
  assert.equal(c.getState().phase,'logout-error');assert.equal(events.length,0);
  failRead=false;await c.retry();assert.equal(events.length,1);assert.equal(f.clears(),1);c.dispose();
});

test('generation guard rejects replacement after preflight and stale account saves', async () => {
  const f=fixture(), c=f.make(), reset=f.storage.reset;
  f.storage.reset=async(expected)=>{f.replace({phrase:'b',profileId:'profile-b'});await reset(expected);};
  await confirm(c);await c.confirmLogout();assert.equal(c.getState().phase,'logout-error');assert.equal(f.clears(),0);
  await c.retry();assert.equal(c.getState().profileId,'profile-b');assert.equal(f.clears(),0);
  await assert.rejects(f.storage.save(identity,0,new AbortController().signal));c.dispose();
});

test('five pending operations require the additional acknowledgement and reopening resets it', async () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const data=new Map([['bis-signet-mints-v1:profile-a',JSON.stringify({operations:Array.from({length:5},(_,i)=>({request:{operationId:String(i)},status:'pending'}))})]]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null}});
  const f=fixture(),c=f.make();
  try {
    await confirm(c);
    assert.equal(c.getState().logoutPendingCount,5);
    assert.equal(c.getState().logoutPendingAcknowledged,false);
    await c.confirmLogout();assert.equal(f.clears(),0);
    c.setLogoutPendingAcknowledged(true);c.cancelLogout();
    c.openLogoutConfirmation();assert.equal(c.getState().logoutPendingAcknowledged,false);
    c.setLogoutBackupAcknowledged(true);c.setLogoutPendingAcknowledged(true);
    await c.confirmLogout();assert.equal(f.clears(),1);
  } finally {c.dispose();if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('changed pending operations invalidate consent even when their count stays the same', async () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let id='first';
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{length:1,key:()=> 'bis-signet-mints-v1:profile-a',getItem:key=>key==='bis-signet-mints-v1:profile-a'?JSON.stringify({operations:[{request:{operationId:id},status:'pending'}]}):null}});
  const f=fixture(),c=f.make();
  try {
    await confirm(c);c.setLogoutPendingAcknowledged(true);id='replacement';
    await c.confirmLogout();assert.equal(f.clears(),0);
    assert.equal(c.getState().logoutPendingAcknowledged,false);
    assert.equal(c.getState().logoutPendingCount,1);
    c.setLogoutPendingAcknowledged(true);await c.confirmLogout();assert.equal(f.clears(),1);
  } finally {c.dispose();if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
