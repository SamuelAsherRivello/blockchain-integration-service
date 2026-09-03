import test from 'node:test';
import assert from 'node:assert/strict';
import { requestTestSats, SIGNET_FAUCET } from '../src/arkade/funding.ts';
import { createContext, createBisAdminContext } from '../src/core/context.ts';

test('faucet sends exactly 1000 sats once; rejects non-Signet and failed responses', async () => {
  const signal = new AbortController().signal;
  let calls = 0;
  const send = async (url, options) => {
    calls++; assert.equal(url, SIGNET_FAUCET); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {address:'tark1-test', amount:1000});
    return new Response('', {status:502});
  };
  await assert.rejects(requestTestSats('ark1-mainnet', signal, send));
  assert.equal(calls, 0);
  await assert.rejects(requestTestSats('tark1-test', signal, send));
  assert.equal(calls, 1);
  await requestTestSats('tark1-test', signal, async () => new Response('', {status:200}));
});

test('admin funding requires account, prevents duplicate calls, preserves UI and balances', async () => {
  let account = null, generation = 0, finish, calls = 0;
  const listeners = new Set();
  const storage = {load:async()=>({account,generation}), subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);}};
  const context = createContext(storage, undefined, async()=>account?.profileId, undefined, undefined, async()=>{calls++; await new Promise(r=>finish=r);});
  const admin = createBisAdminContext(context);
  await context.ready(); await assert.rejects(admin.fund1000Sats(), /active account/);
  account = {profileId:'test',phrase:'isolated-placeholder'}; generation++;
  for (const listener of listeners) listener();
  await context.ready();
  const before = context.getState();
  const pending = admin.fund1000Sats();
  await new Promise(r=>setImmediate(r));
  await assert.rejects(admin.fund1000Sats(), /in progress/);
  finish(); assert.match(await pending, /request accepted/);
  assert.equal(calls,1); assert.deepEqual(context.getState(),before);
  const interrupted = admin.fund1000Sats();
  await new Promise(r=>setImmediate(r));
  context.dispose(); finish(); await assert.rejects(interrupted, /not confirmed/);
});
