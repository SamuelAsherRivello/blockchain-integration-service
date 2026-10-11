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
import {restoreAccount} from '../../src/client/wallet-layer-arkade/account.ts';

const phrase='abandon '.repeat(11)+'about',account={phrase,profileId:'public-fixture',network:'signet'};
const signal=()=>new AbortController().signal;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const assetId='a'.repeat(68);
function setup(t){
  const state={created:0,disposed:0,metadata:0,subscriptions:0,stops:0,submits:0,failed:false,quantity:9007199254740993n,coins:[],notifications:[]};
  t.mock.method(RestArkProvider.prototype,'getInfo',async function(){return {network:this.serverUrl.includes('mutinynet')?'mutinynet':'signet'};});
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>{
    state.queries=(state.queries??0)+1;if(state.indexerGate)await state.indexerGate.promise;
    if(state.failed)throw Error('live read failed');
    return {vtxos:state.quantity?[{txid:'a'.repeat(64),vout:0,value:100,script:'script',assets:[{assetId,amount:state.quantity}]}]:[]};
  });
  const owner=createAppWalletSession({retirementMs:20,createWallet:async config=>{
    state.created++;
    const manager={getContracts:async()=>[{script:'script',address:'owned',state:'inactive'}],annotateVtxos:async coins=>coins,getContractsWithVtxos:async()=>{throw Error('repository fallback must never run');}};
    const wallet={...config,getContractManager:async()=>manager,
      getAddress:async()=> 'tark1-fixture',getBoardingAddress:async()=> 'tb1p-fixture',
      getProviderConnectionState:()=>({mode:'online',source:'live'}),
      getBalance:async function(){
        const current=await (await this.getContractManager()).getContractsWithVtxos();
        return {available:current.flatMap(c=>c.vtxos).reduce((n,c)=>n+c.value,0),total:100+current.flatMap(c=>c.vtxos).reduce((n,c)=>n+c.value,0),boarding:{confirmed:100,total:100}};
      },
      getVtxos:async function(){return (await (await this.getContractManager()).getContractsWithVtxos()).flatMap(c=>c.vtxos);},
      getTransactionHistory:async function(){return state.history?state.history.call(this):[];},
      assetManager:{getAssetDetails:async id=>{state.metadata++;if(state.metadataFailed)throw Error('required metadata unavailable');return {assetId:id,metadata:{name:'External asset'}};}},
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
  assert.equal(bindRoleWallet(owner,'player'),player);assert.equal(bindRoleWallet(owner,'game'),game);
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
  c.abort();await third;
  await loadBalance({...account,profileId:'replacement'},signal(),player);assert.equal(state.created,3);assert.equal(state.disposed,1);
  await loadBalance({...account,profileId:'game'},signal(),game);assert.equal(state.created,3,'replacing Player leaves Game resource intact');
  await owner.dispose();assert.equal(state.disposed,3);assert.equal(state.stops,1);assert.equal(state.submits,0);
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

test('fresh reads bypass long signing and history without observing scoped hooks or fallback',async t=>{
  const {state,player}=setup(t);
  await loadAddresses(account,signal(),player);
  const wallet=state.coins[0],signGate=deferred(),historyGate=deferred();
  state.history=async function(){
    await historyGate.promise;
    return (await (await this.getContractManager()).getContractsWithVtxos()).flatMap(row=>row.vtxos);
  };
  const history=player.history(account,signal());
  const signing=player.sign(account,signal(),{},async w=>{
    w.indexerProvider.getVtxos=async()=>{throw Error('operation-only interceptor');};
    w.getBalance=async()=>{throw Error('operation-only wallet interceptor');};
    await signGate.promise;
  });
  await tick();
  assert.equal((await loadBalance(account,signal(),player)).availableSats,100);
  assert.equal((await listWalletAssets(account,signal(),player))[0].quantity,'9007199254740993');
  signGate.resolve();await signing;historyGate.resolve();assert.equal((await history).length,1);
  assert.equal(state.created,1);
});

test('history failure is attempt-local, even if SDK catches it, and later history and balance recover',async t=>{
  const {state,player}=setup(t);await loadAddresses(account,signal(),player);
  const wallet=state.coins[0];
  let failHistory=true;
  state.history=async function(){state.failed=failHistory;try{await this.indexerProvider.getVtxos({scripts:['script']});}catch{}finally{state.failed=false;}return [];};
  await assert.rejects(player.history(account,signal()));
  failHistory=false;assert.equal((await loadBalance(account,signal(),player)).availableSats,100);
  assert.deepEqual(await player.history(account,signal()),[]);assert.equal(state.created,1);
});

test('activation promotes the restored candidate and invalid restore does not retire saved identity',async t=>{
  const {state,owner,player}=setup(t);
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({network:'signet'})));
  const restored=await restoreAccount(phrase,signal(),'signet',player);
  owner.select('player',restored.profileId,'signet');await loadBalance(restored,signal(),player);
  assert.equal(state.created,1);await assert.rejects(restoreAccount('invalid',signal(),'signet',player));
  await loadBalance(restored,signal(),player);assert.equal(state.created,1);assert.equal(state.disposed,0);
});

test('retirement stops late SDK submission including settlement confirmation and forfeit methods',async t=>{
  const {state,owner,player}=setup(t);await loadAddresses(account,signal(),player);
  const wallet=state.coins[0],gate=deferred();
  for(const key of ['confirmRegistration','submitSignedForfeitTxs'])wallet.arkProvider[key]=async()=>{state.submits++;};
  const work=player.sign(account,signal(),{},async w=>{await gate.promise;await w.arkProvider.confirmRegistration();});
  const rejected=assert.rejects(work);await tick();const retired=owner.retire('player');
  gate.resolve();await rejected;await retired;assert.equal(state.submits,0);assert.equal(state.disposed,1);
});

test('immutable metadata keys include network and missing optional fields remain missing',async t=>{
  const {state,player}=setup(t);
  const first=(await listWalletAssets(account,signal(),player))[0];
  assert.equal(first.decimals,undefined);assert.equal(first.iconUrl,undefined);
  await listWalletAssets({...account,network:'mutinynet'},signal(),player);assert.equal(state.metadata,2);
  await listWalletAssets(account,signal(),player);assert.equal(state.metadata,2,'same network/operator/asset can reuse immutable metadata after role replacement');
  assert.equal(state.created,3);assert.equal(state.disposed,2);
});

test('uncached required metadata failure is not an empty or partial successful listing',async t=>{
  const {state,player}=setup(t);state.metadataFailed=true;
  await assert.rejects(listWalletAssets(account,signal(),player));
  state.metadataFailed=false;assert.equal((await listWalletAssets(account,signal(),player)).length,1);assert.equal(state.created,1);assert.equal(state.metadata,2);
});

test('one cancelled live consumer detaches without cancelling compatible ownership work',async t=>{
  const {state,player}=setup(t),gate=deferred(),cancel=new AbortController();state.indexerGate=gate;
  const balance=loadBalance(account,cancel.signal,player),rejected=assert.rejects(balance);
  const assets=listWalletAssets(account,signal(),player);await tick();
  cancel.abort();await rejected;gate.resolve();assert.equal((await assets).length,1);
  assert.equal(state.created,1);assert.equal(state.queries,1);assert.equal(state.disposed,0);
});

test('owner retirement stops attached observer callbacks and owns the only disposal',async t=>{
  const {state,owner,player}=setup(t);let changed=0;
  const observing=watchAssetChanges(account,signal(),()=>{changed++;},player);
  const ended=observing.catch(()=>{});await tick();await owner.retire('player');await ended;
  const prior=changed;state.notifications[0]();assert.equal(changed,prior);assert.equal(state.stops,1);assert.equal(state.disposed,1);
});
