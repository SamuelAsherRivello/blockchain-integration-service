import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, getControls, createBisAdminContext } from '../src/core/context.ts';

// Deliberately invalid wallet material; never use an actual recovery phrase.
const account = { phrase: 'placeholder-one placeholder-two', profileId: 'profile-a' };
async function fixture() {
  let saved = { account, generation: 0 };
  let notify;
  const storage = {
    load: async () => saved,
    save: async () => { throw Error('Unexpected save'); },
    reset: async () => { saved = {account:null,generation:1}; },
    subscribe: listener => { notify=listener; return () => {}; },
  };
  const c = createContext(storage, undefined, async phrase => phrase === account.phrase ? account.profileId : 'profile-b');
  await c.ready(); c.openAccountDialog();
  return {c, storage, replace() { saved={account:{phrase:'placeholder-other',profileId:'profile-b'},generation:1};notify(); }};
}

test('saved phrase requires explicit reveal, stays private and clears on Back/reopen', async () => {
  const {c}=await fixture(); const internal=getControls(c); const published=[];
  c.subscribe(()=>published.push(c.getState()));c.onEvent(event=>published.push(event));
  await internal.revealRecovery();assert.equal(internal.recovery(),undefined);
  c.openAccountRecovery();assert.equal(c.getState().recoveryStatus,'hidden');assert.equal(internal.recovery(),undefined);
  await internal.revealRecovery();assert.equal(internal.recovery(),account.phrase);
  assert.equal(JSON.stringify(published).includes(account.phrase),false);
  c.closeAccount();assert.equal(internal.recovery(),undefined);assert.equal(c.getState().phase,'active');
  c.openAccountRecovery();assert.equal(c.getState().recoveryStatus,'hidden');c.dispose();
});

test('logout recovery returns to confirmation and requires fresh acknowledgement', async () => {
  const {c}=await fixture();c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);c.openAccountRecovery();
  await getControls(c).revealRecovery();c.setLogoutBackupAcknowledged(true);await c.confirmLogout();
  assert.equal(c.getState().hasProfile,true);c.closeAccount();
  assert.equal(c.getState().phase,'logout-confirmation');assert.equal(c.getState().logoutBackupAcknowledged,false);
  assert.equal(getControls(c).recovery(),undefined);c.dispose();
});

test('late reveal is discarded after Back/reopen, reset, replacement or disposal', async () => {
  for (const action of ['back','reset','replace','dispose']) {
    const f=await fixture();const {c,storage}=f;const original=storage.load;let release;
    storage.load=()=>new Promise(resolve=>{release=()=>original().then(resolve);});
    c.openAccountRecovery();const work=getControls(c).revealRecovery();storage.load=original;
    if(action==='back'){c.closeAccount();c.openAccountRecovery();}
    if(action==='reset')await createBisAdminContext(c).resetClient();
    if(action==='replace'){f.replace();await c.ready();}
    if(action==='dispose')c.dispose();
    release();await work;assert.equal(getControls(c).recovery(),undefined);assert.notEqual(c.getState().recoveryStatus,'ready');c.dispose();
  }
});

test('storage error is sanitized and retry can reveal', async () => {
  const {c,storage}=await fixture();const original=storage.load;
  c.openAccountRecovery();storage.load=async()=>{throw Error(account.phrase);};
  await getControls(c).revealRecovery();assert.equal(c.getState().recoveryStatus,'unavailable');
  assert.equal(JSON.stringify(c.getState()).includes(account.phrase),false);
  storage.load=original;await getControls(c).revealRecovery();assert.equal(getControls(c).recovery(),account.phrase);c.dispose();
});

test('unannounced account replacement cannot reveal a different identity', async () => {
  const {c,storage}=await fixture();c.openAccountRecovery();
  storage.load=async()=>({account:{phrase:'placeholder-other',profileId:'profile-b'},generation:1});
  await getControls(c).revealRecovery();await c.ready();
  assert.equal(getControls(c).recovery(),undefined);assert.equal(c.getState().profileId,'profile-b');c.dispose();
});
