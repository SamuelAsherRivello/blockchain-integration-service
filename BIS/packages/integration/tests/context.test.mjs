import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, createBisAdminContext, getControls } from '../src/core/context.ts';
import { requireSignet } from '../src/arkade/account.ts';
const secret={phrase:'isolated-test-placeholder',profileId:'test-profile'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(overrides={}) {
 let account=null,generation=0,saves=0;const listeners=new Set();
 const storage={load:async()=>({account,generation}),save:async(a,g,signal)=>{signal.throwIfAborted();assert.equal(g,generation);account=a;saves++;},reset:async()=>{account=null;generation++;for(const l of listeners)l();},subscribe:l=>{listeners.add(l);return ()=>listeners.delete(l);},...overrides};
 const context=createContext(storage,async()=>secret,async()=>secret.profileId);
 return {context,storage,saves:()=>saves,account:()=>account};
}
test('entry round trip, repeated open, immutable state and disposal',async()=>{
 const {context}=setup();await context.ready();const views=[];const unsub=context.subscribe(()=>views.push(context.getState().view));
 getControls(context).present();context.openAccountDialog();context.openAccountDialog();context.closeAccount();
 assert.deepEqual(views,['account-button','account','account-button']);assert.ok(Object.isFrozen(context.getState()));
 unsub();context.dispose();assert.throws(()=>context.openAccountDialog(),/disposed/);
});
test('recovery stays private and repeated Continue commits once before activation',async()=>{
 const {context,saves,account}=setup();await context.ready();const events=[];context.onEvent(e=>events.push(e));
 context.openAccountDialog();await context.createAccount();assert.equal(account(),null);assert.equal(context.getState().hasProfile,false);
 assert.equal(JSON.stringify(context.getState()).includes(secret.phrase),false);
 assert.equal(getControls(context).recovery(),secret.phrase);
 await Promise.all([context.continueAccount(),context.continueAccount()]);
 assert.equal(saves(),1);assert.deepEqual(events,[{type:'accountConnected',profileId:secret.profileId}]);assert.equal(getControls(context).recovery(),undefined);
 context.closeAccount();assert.equal(context.getState().view,'empty');context.dispose();
});
test('failed save retries same identity without premature event',async()=>{
 let tries=0;const {context}=setup({save:async(a)=>{assert.equal(a,secret);if(++tries===1)throw Error('private details');}});
 await context.ready();let events=0;context.onEvent(()=>events++);await context.createAccount();await context.continueAccount();
 assert.equal(events,0);assert.equal(context.getState().phase,'error');assert.equal(context.getState().error.includes('private details'),false);
 await context.retry();assert.equal(events,1);context.dispose();
});
test('reset invalidates delayed creation and old subscribers',async()=>{
 const d=deferred();const {storage}=setup();const context=createContext(storage,()=>d.promise,async()=>secret.profileId);await context.ready();
 const work=context.createAccount();await createBisAdminContext(context).resetClient();d.resolve(secret);await work;
 assert.equal(context.getState().hasProfile,false);assert.equal(context.getState().phase,'idle');assert.equal(getControls(context).recovery(),undefined);context.dispose();
});
test('reload restores same identity but incomplete creation is forgotten',async()=>{
 const {context,storage}=setup();await context.ready();await context.createAccount();context.dispose();
 const second=createContext(storage,async()=>secret,async()=>secret.profileId);await second.ready();assert.equal(second.getState().hasProfile,false);
 await second.createAccount();await second.continueAccount();second.dispose();
 const third=createContext(storage,async()=>{throw Error('must not create');},async()=>secret.profileId);await third.ready();assert.equal(third.getState().profileId,secret.profileId);third.dispose();
});
test('corrupt hydration is an error and cannot create a replacement',async()=>{
 const {context}=setup({load:async()=>{throw Error('private storage error');}});await context.ready();await context.createAccount();
 assert.equal(context.getState().phase,'error');assert.equal(context.getState().canReset,true);context.dispose();
});
test('only Signet is accepted',()=>{requireSignet('signet');for(const n of ['bitcoin','mainnet','testnet','mutinynet','regtest'])assert.throws(()=>requireSignet(n));});

test('cross-instance reset notification invalidates the remembered account',async()=>{
 const {context,storage}=setup();await context.ready();await context.createAccount();await context.continueAccount();
 const other=createContext(storage,async()=>secret,async()=>secret.profileId);await other.ready();assert.equal(other.getState().hasProfile,true);
 await createBisAdminContext(context).resetClient();await other.ready();assert.equal(other.getState().hasProfile,false);context.dispose();other.dispose();
});
test('reset failure is visible and does not report success',async()=>{
 const {context}=setup({reset:async()=>{throw Error('failure');}});await context.ready();await context.createAccount();await context.continueAccount();
 await assert.rejects(createBisAdminContext(context).resetClient());assert.equal(context.getState().hasProfile,true);assert.equal(context.getState().phase,'error');context.dispose();
});
test('duplicate creation and disposal during creation do not publish a result',async()=>{
 const {storage}=setup();const d=deferred();let calls=0;
 const context=createContext(storage,()=>{calls++;return d.promise;},async()=>secret.profileId);await context.ready();
 const work=context.createAccount();await context.createAccount();assert.equal(calls,1);context.dispose();d.resolve(secret);await work;assert.equal(getControls(context).recovery(),undefined);
});
test('Back abandons recovery and returns to the logged-out chooser',async()=>{
 const {context,account}=setup();await context.ready();context.openAccountDialog();await context.createAccount();context.closeAccount();await context.ready();
 assert.equal(context.getState().view,'account');assert.equal(context.getState().phase,'idle');assert.equal(account(),null);context.dispose();
});
