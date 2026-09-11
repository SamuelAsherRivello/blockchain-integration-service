import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, getControls } from '../src/core/context.ts';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({assets={list:async()=>[],mint:async()=>{throw Error('unused');}},gameWalletProfileId=()=>undefined}={}) {
  const accounts=new Map([
    ['profile-a',{profileId:'profile-a',phrase:'phrase a'}],
    ['profile-b',{profileId:'profile-b',phrase:'phrase b'}],
  ]);
  let active='profile-a',generation=0;const listeners=new Set();
  const notify=()=>listeners.forEach(listener=>listener());
  const storage={
    async load(){return {generation,account:active?accounts.get(active):null};},
    async listProfiles(){return {generation,profiles:[...accounts.keys()],...(active?{activeProfileId:active}:{})};},
    async selectProfile(profileId,expected,signal){signal?.throwIfAborted();if(expected!==generation||!accounts.has(profileId))throw Error('stale');active=profileId;generation++;notify();},
    async save(account,expected,signal){signal.throwIfAborted();if(expected!==generation)throw Error('stale');if(!accounts.has(account.profileId))accounts.set(account.profileId,account);active=account.profileId;notify();},
    async reset(expected,options){if(expected!==generation||active!==options?.profileId)throw Error('stale');accounts.delete(active);active=undefined;generation++;notify();},
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  };
  const context=createContext(storage,async()=>({profileId:'profile-c',phrase:'phrase c'}),async phrase=>phrase.endsWith('b')?'profile-b':phrase.endsWith('c')?'profile-c':'profile-a',async()=>({profileId:'profile-b',phrase:'phrase b'}),undefined,undefined,undefined,undefined,undefined,assets,undefined,undefined,undefined,{gameWalletProfileId});
  return {context,accounts,get active(){return active;},get generation(){return generation;}};
}

test('player creation and restoration reject the identity selected as Game Wallet',async()=>{
  for (const gameWalletProfileId of ['profile-c','profile-b']) {
    const f=fixture({gameWalletProfileId:()=>gameWalletProfileId});await f.context.ready();f.context.openProfileChooser();
    if(gameWalletProfileId==='profile-c') {await f.context.createAccount();await f.context.continueAccount();}
    else {f.context.openRestoreAccount();await getControls(f.context).restore('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');}
    assert.equal(f.context.getState().profileId,'profile-a');
    assert.equal(f.accounts.has(gameWalletProfileId),gameWalletProfileId==='profile-b');
    assert.match(f.context.getState().error??'',/Game Wallet/);
    f.context.dispose();
  }
});

test('saved Player Wallet selection rejects the identity selected as Game Wallet',async()=>{
  const f=fixture({gameWalletProfileId:()=> 'profile-b'});await f.context.ready();
  await assert.rejects(f.context.selectProfile('profile-b'),/Game Wallet/);
  assert.equal(f.context.getState().profileId,'profile-a');assert.equal(f.active,'profile-a');
  assert.match(f.context.getState().error??'',/Game Wallet/);f.context.dispose();
});

test('programmatic profile selection aborts stale reads and preserves both profile records',async()=>{
  let resolve;const delayed=new Promise(r=>resolve=r);
  const f=fixture({assets:{list:()=>delayed,mint:async()=>{throw Error();}}});
  await f.context.ready();assert.deepEqual(f.context.getState().savedProfiles,['profile-a','profile-b']);
  const read=f.context.listAssets();await tick();
  await f.context.selectProfile('profile-b');
  resolve([{assetId:'a'.repeat(64)+'0000',quantity:'1'}]);
  assert.equal((await read).code,'account-changed');
  assert.equal(f.context.getState().profileId,'profile-b');assert.equal(f.accounts.size,2);f.context.dispose();
});

test('programmatic profile management retains duplicate-safe create and restore',async()=>{
  const f=fixture();await f.context.ready();f.context.openProfileChooser();
  await f.context.createAccount();await f.context.continueAccount();
  assert.equal(f.context.getState().profileId,'profile-c');assert.deepEqual([...f.accounts.keys()],['profile-a','profile-b','profile-c']);
  f.context.openProfileChooser();f.context.openRestoreAccount();await getControls(f.context).restore('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  assert.equal(f.context.getState().profileId,'profile-b');assert.equal(f.accounts.size,3);f.context.dispose();
});

test('logout removes only the active profile and leaves no automatic selection',async()=>{
  const f=fixture();await f.context.ready();f.context.openAccountDialog();f.context.openLogoutConfirmation();f.context.setLogoutBackupAcknowledged(true);await f.context.confirmLogout();
  assert.equal(f.active,undefined);assert.equal(f.accounts.has('profile-a'),false);assert.equal(f.accounts.has('profile-b'),true);
  assert.equal(f.context.getState().profileId,undefined);assert.deepEqual(f.context.getState().savedProfiles,['profile-b']);f.context.dispose();
});
