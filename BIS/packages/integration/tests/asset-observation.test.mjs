import test from 'node:test';
import assert from 'node:assert/strict';
import {observeAssetScripts} from '../src/arkade/assets.ts';
import {createContext} from '../src/core/context.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('asset stream observes new, spent and swept outputs, ignores empty events, and unsubscribes',async()=>{
  const controller=new AbortController();let changes=0,stops=0;
  const empty={scripts:[],newVtxos:[],spentVtxos:[],sweptVtxos:[]};
  const provider={subscribeForScripts:async scripts=>{assert.deepEqual(scripts,['script']);return 'subscription';},
    async *getSubscription(id,signal){assert.equal(id,'subscription');assert.equal(signal,controller.signal);yield empty;yield {...empty,newVtxos:[{}]};yield {...empty,spentVtxos:[{}]};yield {...empty,sweptVtxos:[{}]};controller.abort();yield {...empty,newVtxos:[{}]};},
    unsubscribeForScripts:async id=>{assert.equal(id,'subscription');stops++;}};
  await observeAssetScripts(provider,['script'],controller.signal,()=>changes++);
  assert.equal(changes,4);assert.equal(stops,1);
});

test('visible assets refresh on events without loading, coalesce bursts, and stop on exit',async()=>{
  const account={phrase:'isolated-placeholder',profileId:'asset-stream'};
  let changed,signal,reads=0,finish;let holdings=[{assetId:'a',quantity:'1'}];
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,
    {list:async()=>{reads++;if(finish===null)return new Promise(resolve=>{finish=resolve;});return holdings;},mint:async()=>{throw Error('No mutation');}},undefined,undefined,undefined,{},undefined,
    async(_account,s,onChange)=>{signal=s;changed=onChange;await new Promise(resolve=>s.addEventListener('abort',resolve,{once:true}));});
  await c.ready();c.openAccountDialog();c.openAccountAssets();await tick();assert.equal(reads,1);
  await tick();assert.equal(reads,1,'idle window does not request holdings');
  finish=null;changed();await tick();assert.equal(c.getState().assets.status,'ready');assert.equal(reads,2);
  changed();changed();holdings=[{assetId:'a',quantity:'2'}];finish(holdings);await tick();
  assert.equal(reads,3,'burst results in one trailing fresh read');assert.equal(c.getState().assets.assets[0].quantity,'2');
  c.closeAccount();assert(signal.aborted);changed();await tick();assert.equal(reads,3);assert.equal(c.getState().assets.status,'idle');c.dispose();
});
