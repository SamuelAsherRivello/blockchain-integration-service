import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.ts';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const addresses={arkadeAddress:'tark1-test-address',bitcoinAddress:'tb1p-test-address'};
function setup(readAddresses) {
  const account={phrase:'test-placeholder',profileId:'test-profile'};
  return createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('Unexpected write');},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>{throw Error('Balance unavailable');},undefined,readAddresses);
}
test('addresses load only in Receive, without loading balance, and clear on Back',async()=>{
  let calls=0;const c=setup(async()=>{calls++;return addresses;});
  await c.ready();c.openAccountDialog();await tick();assert.equal(calls,0);
  c.openAccountReceive();await tick();assert.equal(calls,1);
  assert.deepEqual(c.getState().addresses,{status:'ready',...addresses});
  assert.equal(c.getState().balance.status,'idle');
  c.closeAccount();assert.deepEqual(c.getState().addresses,{status:'idle'});
  c.openAccountReceive();await tick();assert.equal(calls,2);c.dispose();
});
test('refresh failure removes old addresses and a subsequent refresh recovers',async()=>{
  let fail=false;const c=setup(async()=>{if(fail)throw Error('private error');return addresses;});
  await c.ready();c.openAccountDialog();c.openAccountReceive();await tick();
  fail=true;const work=c.refreshBalance();assert.deepEqual(c.getState().addresses,{status:'loading'});await work;
  assert.deepEqual(c.getState().addresses,{status:'unavailable'});assert.equal(c.getState().phase,'active');
  fail=false;await c.refreshBalance();assert.equal(c.getState().addresses.status,'ready');c.dispose();
});
test('closing or disposing prevents a late address result from publishing',async()=>{
  for(const action of ['close','dispose']) {
    let finish,signal;const c=setup((_,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
    await c.ready();c.openAccountDialog();c.openAccountReceive();await tick();
    if(action==='close')c.closeAccount();else c.dispose();
    assert.ok(signal.aborted);finish(addresses);await tick();assert.deepEqual(c.getState().addresses,{status:'idle'});c.dispose();
  }
});

test('Details, Receive, Send and recovery navigate without leaking requests or stale addresses',async()=>{
  let calls=0;const c=setup(async()=>{calls++;return addresses;});
  await c.ready();c.openAccountDialog();c.openAccountDetails();await tick();
  assert.equal(calls,0);assert.equal(c.getState().balance.status,'unavailable');
  c.openAccountRecovery();c.closeAccount();await tick();
  assert.equal(c.getState().accountDetails,true);assert.equal(c.getState().recoveryStatus,'hidden');
  c.openAccountReceive();await tick();assert.equal(calls,1);assert.equal(c.getState().accountDetails,false);
  c.openAccountSend();await tick();assert.equal(calls,1);assert.equal(c.getState().accountReceive,false);
  assert.deepEqual(c.getState().addresses,{status:'idle'});assert.deepEqual(c.getState().balance,{status:'idle'});
  c.closeAccount();assert.equal(c.getState().accountSend,false);assert.equal(c.getState().view,'account');c.dispose();
});
