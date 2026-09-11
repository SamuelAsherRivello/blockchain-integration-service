import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletRoleConflictError, withWalletRoleSelection } from '../src/core/wallet-role.ts';

test('role selection accepts distinct IDs and rejects equal IDs',async()=>{
  assert.equal(await withWalletRoleSelection('player',()=> 'game','conflict',async()=> 'accepted'),'accepted');
  await assert.rejects(withWalletRoleSelection('player',()=> 'player','conflict',async()=> 'unexpected'),WalletRoleConflictError);
});

test('role selection serializes competing compare-and-commit work',async()=>{
  let selected;let release;let started;
  const began=new Promise(resolve=>started=resolve);
  const first=withWalletRoleSelection('game',()=>selected,'conflict',async()=>{
    selected='game';started();await new Promise(resolve=>release=resolve);
  });
  await began;
  const second=withWalletRoleSelection('game',()=>selected,'conflict',async()=> 'unexpected');
  release();await first;
  await assert.rejects(second,WalletRoleConflictError);
});
