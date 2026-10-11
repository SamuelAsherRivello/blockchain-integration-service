import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RestArkProvider,RestIndexerProvider} from '@arkade-os/sdk';
import {createAppWalletSession} from '../../src/client/wallet-layer-arkade/app-wallet-session.ts';
import {bindRoleWallet} from '../../src/client/wallet-layer-arkade/adapter-session.ts';
import {createArkadeContextDependencies} from '../../src/client/wallet-layer-arkade/context-dependencies.ts';
import {loadBalance} from '../../src/client/wallet-layer-arkade/balance.ts';
import {loadAddresses} from '../../src/client/wallet-layer-arkade/addresses.ts';
import {listWalletAssets,watchAssetChanges} from '../../src/client/wallet-layer-arkade/assets.ts';

const phrase='abandon '.repeat(11)+'about',account={phrase,profileId:'public-fixture',network:'signet'};
const signal=()=>new AbortController().signal;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const assetId='a'.repeat(68);
function setup(t){
  const state={created:0,disposed:0,metadata:0,subscriptions:0,stops:0,submits:0,failed:false,quantity:9007199254740993n,coins:[],notifications:[]};
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet'}));
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>{
    if(state.failed)throw Error('live read failed');
    return {vtxos:state.quantity?[{txid:'a'.repeat(64),vout:0,value:100,script:'script',assets:[{assetId,amount:state.quantity}]}]:[]};
  });
  const owner=createAppWalletSession({retirementMs:20,createWallet:async config=>{
    state.created++;
    const manager={getContracts:async()=>[{script:'script',address:'owned',state:'inactive'}],annotateVtxos:async coins=>coins,getContractsWithVtxos:async()=>{throw Error('repository fallback must never run');}};
    const wallet={...config,getContractManager:async()=>manager,
      getAddress:async()=> 'tark1-fixture',getBoardingAddress:async()=> 'tb1p-fixture',
      getProviderConnectionState:()=>({mode:'online',source:'live'}),
      getBalance:async()=>{
        const current=await manager.getContractsWithVtxos();
        return {available:current.flatMap(c=>c.vtxos).reduce((n,c)=>n+c.value,0),total:100+current.flatMap(c=>c.vtxos).reduce((n,c)=>n+c.value,0),boarding:{confirmed:100,total:100}};
      },
      getVtxos:async()=> (await manager.getContractsWithVtxos()).flatMap(c=>c.vtxos),
      assetManager:{getAssetDetails:async id=>{state.metadata++;return {assetId:id,metadata:{name:'External asset'}};}},
      notifyIncomingFunds:async callback=>{state.subscriptions++;state.notifications.push(callback);return ()=>{state.stops++;};},
      dispose:async()=>{state.disposed++;},
    };
    state.coins.push(wallet);return wallet;
  }});
  t.after(()=>owner.dispose());
  return {state,owner,player:bindRoleWallet(owner,'player'),game:bindRoleWallet(owner,'game')};
}
test('cross-feature warm reads, metadata reuse, observers, optional Game and retirement obey the construction budget',async t=>{
  const {state,owner,player,game}=setup(t);
  assert.equal(state.created,0);
  const [balance,assets,addresses]=await Promise.all([loadBalance(account,signal(),player),listWalletAssets(account,signal(),player),loadAddresses(account,signal(),player)]);
  assert.equal(balance.availableSats,100);assert.equal(assets[0].quantity,'9007199254740993');assert.equal(addresses.arkadeAddress,'tark1-fixture');assert.equal(state.created,1);
  for(let i=0;i<10;i++)await Promise.all([loadBalance(account,signal(),player),listWalletAssets(account,signal(),player)]);
  assert.equal(state.created,1);assert.equal(state.disposed,0);assert.equal(state.metadata,1);
  const a=new AbortController(),b=new AbortController();let changes=0;
  const first=watchAssetChanges(account,a.signal,()=>{changes++;},player);
  const second=watchAssetChanges(account,b.signal,()=>{},player);
  await tick();assert.equal(state.subscriptions,1);a.abort();await first;
  const after=changes;state.notifications[0]();assert.equal(changes,after);
  b.abort();await second;
  const c=new AbortController(),third=watchAssetChanges(account,c.signal,()=>{},player);await tick();assert.equal(state.subscriptions,1);
  await loadBalance({...account,profileId:'game'},signal(),game);assert.equal(state.created,2);
  state.quantity=2n;assert.equal((await listWalletAssets(account,signal(),player))[0].quantity,'2');assert.equal(state.metadata,1,'changed live quantities reuse metadata; Game balance does not hydrate it');
  c.abort();await third;await owner.dispose();assert.equal(state.disposed,2);assert.equal(state.stops,1);assert.equal(state.submits,0);
});
test('failed live read never returns previous holdings and recovery reuses the same resource',async t=>{
  const {state,player}=setup(t);
  await loadBalance(account,signal(),player);await listWalletAssets(account,signal(),player);
  state.failed=true;await assert.rejects(loadBalance(account,signal(),player));await assert.rejects(listWalletAssets(account,signal(),player));
  state.failed=false;state.quantity=0n;
  assert.deepEqual(await listWalletAssets(account,signal(),player),[]);assert.equal((await loadBalance(account,signal(),player)).availableSats,0);assert.equal(state.created,1);
});
test('scoped signing hooks restore on failure; cancelled local presentation does not release an active signer',async t=>{
  const {state,owner,player}=setup(t);
  await loadAddresses(account,signal(),player);
  const wallet=state.coins[0],original=wallet.getAddress,gate=deferred();
  const signing=player.sign(account,signal(),{},async(w,active)=>{
    w.getAddress=async()=> 'overridden';await gate.promise;active.throwIfAborted();
  });
  const rejected=assert.rejects(signing);await tick();
  const retirement=owner.retire('player');const retired=assert.rejects(retirement);
  await rejected;await retired;
  await assert.rejects(loadAddresses({...account,profileId:'replacement'},signal(),player));assert.equal(state.created,1);
  gate.resolve();await tick();assert.equal(wallet.getAddress,original);assert.equal(state.disposed,1);
  await loadAddresses({...account,profileId:'replacement'},signal(),player);assert.equal(state.created,2);
});
test('package exports keep session/provider resources private and context uses one history observer seam',()=>{
  const exports=readFileSync(new URL('../../src/index.ts',import.meta.url),'utf8');
  assert.doesNotMatch(exports,/app-wallet-session|adapter-session|complete-snapshot|RoleWalletAccess/);
  const deps=createArkadeContextDependencies();assert.equal(deps.observeActivity,deps.observePayments);
  const facade=readFileSync(new URL('../../src/client/integration-layer/bis-service.ts',import.meta.url),'utf8');
  assert.doesNotMatch(facade,/wallet\?\.refresh\(\)/);
});
