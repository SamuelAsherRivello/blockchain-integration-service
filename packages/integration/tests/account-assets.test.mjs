import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,getControls} from '../src/core/context.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const holding={assetId:'asset-a',quantity:'12345',decimals:2};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function setup(list=async()=>[holding]) {
  let account={phrase:'isolated-placeholder',profileId:'account-a'},generation=0;
  const listeners=new Set();
  const context=createContext({load:async()=>({account,generation}),save:async()=>{},reset:async()=>{},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,{list,mint:async()=>{throw Error('unexpected mutation');}});
  return {context,replace(){account={...account,profileId:'account-b'};generation++;for(const l of listeners)l();}};
}
test('entry, ready, Back, and headless reads keep API and presentation separate',async()=>{
  let reads=0;const {context:c}=setup(async()=>{reads++;return[holding];});await c.ready();c.openAccountDialog();await tick();assert.equal(reads,0);
  c.openAccountAssets();await tick();assert.equal(reads,1);assert.equal(c.getState().assets.status,'ready');
  const state=c.getState();await c.listAssets();assert.equal(reads,2);assert.equal(c.getState(),state);
  c.closeAccount();assert.equal(c.getState().accountAssets,false);assert.equal(c.getState().assets.status,'idle');assert.equal(c.getState().view,'account');c.dispose();
});
test('failed refresh clears values; empty success is distinct and retry works',async()=>{
  let mode='ready';const {context:c}=setup(async()=>{if(mode==='fail')throw Error('private provider failure');return mode==='empty'?[]:[holding];});await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();
  mode='fail';const work=c.refreshAssets();assert.deepEqual(c.getState().assets,{status:'loading'});await work;assert.deepEqual(c.getState().assets,{status:'unavailable'});
  mode='empty';await c.refreshAssets();assert.deepEqual(c.getState().assets,{status:'ready',assets:[]});c.dispose();
});
test('old session response cannot overwrite newer same-account entry',async()=>{
  const old=deferred(),fresh=deferred();let reads=0;const {context:c}=setup(()=>++reads===1?old.promise:fresh.promise);await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();
  c.closeAccount();c.openAccountAssets();await tick();fresh.resolve([{...holding,quantity:'99'}]);await tick();old.resolve([holding]);await tick();assert.equal(c.getState().assets.assets[0].quantity,'99');c.dispose();
});
test('account replacement and disposal invalidate obsolete reads',async()=>{
  const read=deferred();const s=setup(()=>read.promise),c=s.context;await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();s.replace();await c.ready();read.resolve([holding]);await tick();assert.equal(c.getState().profileId,'account-b');assert.equal(c.getState().assets.status,'idle');
  c.openAccountAssets();c.dispose();await tick();assert.equal(c.getState().assets.status,'idle');assert.equal(c.getState().accountAssets,false);
});
test('presentation cleanup does not cancel independent callers',async()=>{
  const read=deferred();const signals=[];const {context:c}=setup((_account,signal)=>{signals.push(signal);return read.promise;});await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();const publicRead=c.listAssets();await tick();
  getControls(c).hideAssets();assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);read.resolve([holding]);assert.equal((await publicRead).status,'success');assert.equal(c.getState().assets.status,'idle');c.dispose();
});
test('each 30 second attempt is bounded despite a noncooperative reader',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const read=deferred();let signal;const {context:c}=setup((_account,s)=>{signal=s;return read.promise;});await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();
  t.mock.timers.tick(29999);await tick();assert.equal(c.getState().assets.status,'loading');t.mock.timers.tick(1);await tick();assert.equal(c.getState().assets.status,'loading');t.mock.timers.tick(30000);await tick();assert.equal(c.getState().assets.status,'unavailable');assert.equal(signal.aborted,true);
  read.resolve([holding]);await tick();assert.equal(c.getState().assets.status,'unavailable');c.dispose();t.mock.timers.reset();
});
test('other pages and logout clear asset presentation without wallet mutation',async()=>{
  const {context:c}=setup();await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();c.openAccountActivity();assert.equal(c.getState().accountAssets,false);assert.equal(c.getState().assets.status,'idle');c.closeAccount();
  c.openAccountAssets();await tick();c.openLogoutConfirmation();assert.equal(c.getState().assets.status,'idle');c.cancelLogout();c.dispose();
});
