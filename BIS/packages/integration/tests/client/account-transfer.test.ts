import test from 'node:test';
import assert from 'node:assert/strict';
import { readFreshBalance } from '../../src/client/wallet-layer-arkade/balance.ts';
import { createContext } from '../../src/client/state-layer-core/context.ts';

test('balance split includes nonspendable Arkade holdings and rejects inconsistent boarding amounts', async () => {
  const wallet = value => ({getBalance: async () => value, getProviderConnectionState: () => ({mode:'online',source:'live'})});
  assert.deepEqual(await readFreshBalance(wallet({available:800,total:1500,boarding:{confirmed:500,total:500}})), {
    availableSats:800,availableBitcoinSats:500,availableArkadeSats:800,totalSats:1500,bitcoinSats:500,arkadeSats:1000,
  });
  for (const boarding of [undefined, {confirmed:0,total:-1}, {confirmed:0,total:0.5}, {confirmed:0,total:NaN}, {confirmed:701,total:701}, {confirmed:0,total:1600}]) {
    await assert.rejects(readFreshBalance(wallet({available:800,total:1500,boarding})));
  }
});

test('transfer navigation reads fresh, returns to Details and is cleared by account changes', async () => {
  let account = {phrase:'isolated-placeholder',profileId:'profile-a'}, notify;
  let reads = 0;
  const c = createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('Unexpected save');},reset:async()=>{},subscribe:fn=>{notify=fn;return()=>{};}}, undefined, async()=>account?.profileId, undefined,
    async()=>{reads++;return {availableSats:800,availableBitcoinSats:500,availableArkadeSats:800,totalSats:1500,bitcoinSats:500,arkadeSats:1000};});
  const tick = () => new Promise(resolve=>setImmediate(resolve));
  await c.readyAsync();c.openAccountDialog();c.openAccountDetails();await tick();
  c.openAccountTransfer();await tick();
  assert.equal(c.getState().accountTransfer,true);assert.equal(c.getState().accountDetails,false);assert.equal(reads,1);
  c.closeAccount();await tick();assert.equal(c.getState().accountDetails,true);assert.equal(c.getState().accountTransfer,false);assert.equal(reads,1);
  c.openAccountTransfer();await tick();account={phrase:'other-placeholder',profileId:'profile-b'};notify();await c.readyAsync();await tick();
  assert.equal(c.getState().accountTransfer,false);
  c.dispose();
});

test('transfer availability is cached per direction and exposes a synchronous peek', async () => {
  let availabilityReads = 0;
  const transfers = {
    quote: async()=>{throw Error('unused');},
    submit: async()=>{throw Error('unused');},
    reconcile: async()=>undefined,
    availability: async()=>{availabilityReads++;return {available:true};},
  };
  const account={phrase:'isolated-placeholder',profileId:'profile-cache'};
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,
    async()=>({availableSats:800,availableBitcoinSats:500,availableArkadeSats:800,totalSats:1500,bitcoinSats:500,arkadeSats:1000}),undefined,undefined,undefined,transfers);
  await c.readyAsync();
  await c.getAccountTransferAvailability('to-arkade');
  await c.getAccountTransferAvailability('to-arkade');
  assert.equal(availabilityReads,1);
  assert.deepEqual(c.peekAccountTransferAvailability?.('to-arkade'),{available:true});
  c.dispose();
});
