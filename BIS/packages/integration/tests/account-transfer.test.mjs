import test from 'node:test';
import assert from 'node:assert/strict';
import { readFreshBalance } from '../src/arkade/balance.ts';
import { createContext } from '../src/core/context.ts';

test('balance split includes nonspendable Arkade holdings and rejects inconsistent boarding amounts', async () => {
  const wallet = value => ({getBalance: async () => value, getProviderConnectionState: () => ({mode:'online',source:'live'})});
  assert.deepEqual(await readFreshBalance(wallet({available:800,total:1500,boarding:{total:500}})), {
    availableSats:800,totalSats:1500,bitcoinSats:500,arkadeSats:1000,
  });
  for (const boarding of [undefined, {total:-1}, {total:0.5}, {total:NaN}, {total:701}, {total:1600}]) {
    await assert.rejects(readFreshBalance(wallet({available:800,total:1500,boarding})));
  }
});

test('transfer navigation reads fresh, returns to Details and is cleared by account changes', async () => {
  let account = {phrase:'isolated-placeholder',profileId:'profile-a'}, notify;
  let reads = 0;
  const c = createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('Unexpected save');},reset:async()=>{},subscribe:fn=>{notify=fn;return()=>{};}}, undefined, async()=>account?.profileId, undefined,
    async()=>{reads++;return {availableSats:800,totalSats:1500,bitcoinSats:500,arkadeSats:1000};});
  const tick = () => new Promise(resolve=>setImmediate(resolve));
  await c.ready();c.openAccountDialog();c.openAccountDetails();await tick();
  c.openAccountTransfer();await tick();
  assert.equal(c.getState().accountTransfer,true);assert.equal(c.getState().accountDetails,false);assert.equal(reads,2);
  c.closeAccount();await tick();assert.equal(c.getState().accountDetails,true);assert.equal(c.getState().accountTransfer,false);assert.equal(reads,3);
  c.openAccountTransfer();await tick();account={phrase:'other-placeholder',profileId:'profile-b'};notify();await c.ready();await tick();
  assert.equal(c.getState().accountTransfer,false);
  c.dispose();
});
