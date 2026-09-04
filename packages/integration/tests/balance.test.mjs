import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, createBisAdminContext } from '../src/core/context.ts';
import { readFreshBalance } from '../src/arkade/balance.ts';
import { withTemporaryWallet } from '../src/arkade/account.ts';

const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const amounts={availableSats:1000,totalSats:1500};
function setup(read=async()=>amounts) {
  let account={phrase:'isolated-placeholder',profileId:'profile-a'},generation=0,writes=0;
  const listeners=new Set();
  const storage={load:async()=>({account,generation}),save:async()=>{writes++;},reset:async()=>{account=null;generation++;for(const l of listeners)l();},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}};
  const context=createContext(storage,undefined,async()=>account?.profileId,undefined,read);
  return {context,storage,writes:()=>writes,replace(){account={phrase:'replacement-placeholder',profileId:'profile-b'};generation++;for(const l of listeners)l();}};
}

test('Account menu does not read balances; Details Back returns to menu before host',async()=>{
  let calls=0;const {context}=setup(async()=>{calls++;return amounts;});
  await context.ready();context.openAccountDialog();await tick();
  assert.equal(context.getState().accountDetails,false);assert.equal(calls,0);
  await context.refreshBalance();assert.equal(calls,0);
  context.openAccountDetails();await tick();assert.equal(calls,1);assert.equal(context.getState().accountDetails,true);
  context.closeAccount();assert.equal(context.getState().view,'account');assert.equal(context.getState().accountDetails,false);
  assert.equal(context.getState().balance.status,'idle');await tick();assert.equal(calls,1);
  context.openLogoutConfirmation();context.cancelLogout();await tick();assert.equal(calls,1);
  context.closeAccount();assert.equal(context.getState().view,'empty');context.dispose();
});

test('adapter accepts real zero and maps available/total; rejects partial, invalid, degraded or failed reads',async()=>{
  for(const [available,total] of [[0,0],[1000,1500]]) {
    const result=await readFreshBalance({getBalance:async()=>({available,total,boarding:{total:total-available}}),getProviderConnectionState:()=>({mode:'online',source:'live'})});
    assert.deepEqual(result,{availableSats:available,totalSats:total,bitcoinSats:total-available,arkadeSats:available});assert.ok(Object.isFrozen(result));
  }
  for(const b of [{available:-1,total:0},{available:1.5,total:2},{available:2,total:1},{available:0,total:NaN},{available:0},{available:0,total:Infinity}]) {
    await assert.rejects(readFreshBalance({getBalance:async()=>b,getProviderConnectionState:()=>({mode:'online',source:'live'})}));
  }
  for(const state of [{mode:'degraded',source:'repository'},{mode:'degraded',source:'cache'}]) {
    await assert.rejects(readFreshBalance({getBalance:async()=>({available:99,total:99}),getProviderConnectionState:()=>state}));
  }
  await assert.rejects(readFreshBalance({getBalance:async()=>{throw Error('source unavailable');}}));
});

test('bounded balance acquisition disposes on failure, timeout and late acquisition',async()=>{
  for(const mode of ['failure','timeout']) {
    let disposed=0;const wallet={dispose:async()=>{disposed++;}};
    const keepAlive=setInterval(()=>{},20);
    try {await assert.rejects(withTemporaryWallet(Promise.resolve(wallet),new AbortController().signal,async()=>{if(mode==='failure')throw Error('unavailable');return new Promise(()=>{});},5));assert.equal(disposed,1);}finally{clearInterval(keepAlive);}
  }
  const d=deferred(),abort=new AbortController();let disposed=0;
  const work=withTemporaryWallet(d.promise,abort.signal,async()=>amounts);
  abort.abort();await assert.rejects(work);d.resolve({dispose:async()=>{disposed++;}});await tick();assert.equal(disposed,1);
});

test('on-open/manual refresh clears old values, failure remains retryable, no storage writes or duplicate reads',async()=>{
  let calls=0,next=deferred();const {context,writes}=setup(()=>{calls++;return next.promise;});
  await context.ready();assert.equal(calls,0);context.openAccountDialog();context.openAccountDetails();await tick();
  assert.deepEqual(context.getState().balance,{status:'loading'});
  context.openAccountDialog();context.openAccountDetails();await context.refreshBalance();assert.equal(calls,1);
  next.resolve(amounts);await tick();assert.deepEqual(context.getState().balance,{status:'ready',...amounts});
  next=deferred();const work=context.refreshBalance();assert.deepEqual(context.getState().balance,{status:'loading'});await tick();
  next.reject(Error('private source failure'));await work;assert.deepEqual(context.getState().balance,{status:'unavailable'});assert.equal(context.getState().phase,'active');
  next=deferred();const retry=context.refreshBalance();await tick();next.resolve({availableSats:0,totalSats:0});await retry;
  assert.equal(context.getState().balance.availableSats,0);assert.equal(writes(),0);assert.equal(calls,3);
  context.closeAccount();assert.deepEqual(context.getState().balance,{status:'idle'});context.openAccountDialog();context.openAccountDetails();await tick();assert.equal(calls,4);context.dispose();
});

test('Back and logout cancellation discard pending work and request fresh balances',async()=>{
  const reads=[];const {context}=setup((_,signal)=>{const d=deferred();reads.push({...d,signal});return d.promise;});
  await context.ready();context.openAccountDialog();context.openAccountDetails();await tick();context.closeAccount();assert.ok(reads[0].signal.aborted);
  reads[0].resolve(amounts);await tick();assert.equal(context.getState().balance.status,'idle');
  context.openAccountDialog();context.openAccountDetails();await tick();context.openLogoutConfirmation();assert.ok(reads[1].signal.aborted);assert.equal(context.getState().phase,'logout-confirmation');
  context.cancelLogout();await tick();assert.equal(reads.length,2);assert.equal(context.getState().accountDetails,false);context.openAccountDetails();await tick();assert.equal(reads.length,3);reads[1].resolve(amounts);await tick();assert.equal(context.getState().balance.status,'loading');
  reads[2].resolve(amounts);await tick();assert.equal(context.getState().balance.status,'ready');context.dispose();
});

test('replacement, reset and disposal invalidate old reads without publishing',async()=>{
  for(const action of ['replace','reset','dispose']) {
    const reads=[];const s=setup((_,signal)=>{const d=deferred();reads.push({...d,signal});return d.promise;});const c=s.context;
    await c.ready();c.openAccountDialog();c.openAccountDetails();await tick();
    if(action==='replace'){s.replace();await c.ready();await tick();}
    if(action==='reset')await createBisAdminContext(c).resetClient();
    if(action==='dispose')c.dispose();
    assert.ok(reads[0].signal.aborted);let notifications=0;c.getState();if(action!=='dispose')c.subscribe(()=>notifications++);
    reads[0].resolve(amounts);await tick();assert.equal(notifications,0);assert.notEqual(c.getState().balance.status,'ready');c.dispose();
  }
});

test('identity read failure is an account error, never a balance success',async()=>{
  const s=setup();await s.context.ready();s.storage.load=async()=>{throw Error('unreadable');};
  s.context.openAccountDialog();s.context.openAccountDetails();await tick();assert.equal(s.context.getState().phase,'error');assert.equal(s.context.getState().balance.status,'idle');s.context.dispose();
});

