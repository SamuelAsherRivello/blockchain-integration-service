import test from 'node:test';
import assert from 'node:assert/strict';
import {createBisGameWallet} from '../src/core/game-wallet.ts';
import {testLocks} from './locks-fixture.mjs';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('F3 enables at 1000 sats and remains unavailable below 1000',async()=>{
  for(const amount of [999,1000]) {
    const f=fixture();
    f.dependencies.balance=async()=>({availableSats:amount,totalSats:amount,bitcoinSats:0,arkadeSats:amount});
    const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,()=>{});
    await tick();await c.importWallet('sender');
    assert.equal(c.canPayPlayer(),amount===1000);c.dispose();
  }
});

test('C1 checks and mints with the selected game identity, never the player identity',async()=>{
 const values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 const f=fixture(),calls=[];
 const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,undefined,{
  availability:async account=>{calls.push(['balance',account.profileId]);return {canMint:true};},
  mint:async(account,request,_signal,current)=>{assert.equal(current(),true);calls.push(['mint',account.profileId]);return {status:'minted',profileId:account.profileId,operationId:request.operationId,asset:{assetId:'test',quantity:'1'}};},
 });
 await tick();await c.importWallet('game');
 assert.equal((await c.getMintAvailability()).canMint,true);
 assert.equal((await c.mintAsset({operationId:'mint-test',name:'Test',ticker:'TEST',amount:'1',decimals:0})).profileId,'game');
 assert.deepEqual(calls,[['balance','game'],['mint','game']]);
 assert.equal(values.get('bis-game-wallet-mint-owner:game'),'1');c.dispose();
});
test('F2 reports unresolved boarding rather than awaiting balance and recovers when cleared',async()=>{
  const f=fixture();let blocked=true;
  const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,()=>{if(blocked)throw Error('A transfer is unresolved. Open Account Transfer and check its status before clearing this account or using these funds.');});
  await tick();await c.importWallet('sender');
  assert.equal(c.getPlayerPaymentBlockReason(),'Awaiting Confirmation');
  assert.equal(c.getPlayerPaymentBalance(),0);
  assert.equal(c.canPayPlayer(),false);
  blocked=false;assert.equal(c.getPlayerPaymentBlockReason(),undefined);assert.equal(c.getPlayerPaymentBalance(),1000);assert.equal(c.canPayPlayer(),true);c.dispose();
});
test('boarding uses selected game identity and rejects a quote from another wallet', async () => {
  const f = fixture(), calls = [];
  const boarding = {
    quote: async account => { calls.push(account.profileId); return {profileId:account.profileId,direction:'to-arkade'}; },
    submit: async (account, quote, current) => { assert.equal(current(),true); calls.push(account.profileId); return {status:'pending'}; },
    check: async account => { calls.push(account.profileId); return {status:'idle'}; },
  };
  const c = createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,boarding);
  await tick(); await assert.rejects(c.quoteBoarding());
  await c.importWallet('game');
  const quote = await c.quoteBoarding();
  await assert.rejects(c.board({...quote,profileId:'player'}));
  assert.equal((await c.board(quote)).status,'pending');
  await c.checkBoarding(); assert.deepEqual(calls,['game','game','game']);
  c.dispose();
});
function fixture() {
  let selected = null;
  const saved = new Map(), listeners = new Set();
  const storage = {logout:async()=>{selected=null;},load:async()=>selected, select:async a=>{saved.set(a.profileId,a);selected=a;},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},dispose(){}};
  const dependencies = {storage, restore:async phrase=>{if(phrase==='invalid')throw Error('sensitive');return {phrase,profileId:phrase};},addresses:async a=>({arkadeAddress:`tark1${a.profileId}`,bitcoinAddress:`tb1${a.profileId}`}),balance:async()=>({availableSats:1000,totalSats:1000,bitcoinSats:0,arkadeSats:1000})};
  return {dependencies,saved,listeners,create:()=>createBisGameWallet({playerProfileId:()=> 'player'},dependencies)};
}
test('import retains wallets, reselects without duplicates and restores last selection',async()=>{
  const f=fixture(),c=f.create();await tick();
  assert.equal(await c.importWallet('a'),true);assert.equal(await c.importWallet('b'),true);assert.equal(await c.importWallet('a'),true);
  assert.equal(f.saved.size,2);assert.equal(c.getState().profileId,'a');assert.equal('phrase' in c.getState(),false);
  assert.equal(await c.importWallet('invalid'),false);assert.equal(c.getState().profileId,'a');
  assert.equal(await c.importWallet('player'),false);assert.equal(f.saved.size,2);
  c.dispose();const reloaded=f.create();await tick();assert.equal(reloaded.getState().profileId,'a');reloaded.dispose();
});
test('late balance read cannot populate a different selected wallet',async()=>{
  const f=fixture();let resolve;
  f.dependencies.balance=async a=>a.profileId==='a'?await new Promise(r=>resolve=r):{availableSats:2,totalSats:2,bitcoinSats:0,arkadeSats:2};
  const c=f.create();await tick();const importing=c.importWallet('a');await tick();
  // Import serializes selection; duplicate clicks cannot start another identity mutation.
  assert.equal(await c.importWallet('b'),false);
  resolve({availableSats:1,totalSats:1,bitcoinSats:0,arkadeSats:1});await importing;
  await c.importWallet('b');assert.equal(c.getState().balance.availableSats,2);c.dispose();
});
test('provider failures do not fabricate a balance and refresh retries',async()=>{
  const f=fixture();f.dependencies.balance=async()=>{throw Error('private provider detail');};
  const c=f.create();await tick();await c.importWallet('a');assert.equal(c.getState().status,'unavailable');assert.equal(c.getState().balance,undefined);
  f.dependencies.balance=async()=>({availableSats:3,totalSats:3,bitcoinSats:0,arkadeSats:3});await c.refresh();assert.equal(c.getState().balance.availableSats,3);c.dispose();
});


test('logout deselects persistently without deleting retained wallets',async()=>{
  const f=fixture(),c=f.create();await tick();await c.importWallet('a');await c.logout();
  assert.equal(c.getState().status,'empty');assert.equal(c.getState().profileId,undefined);assert.equal(f.saved.size,1);
  c.dispose();const reopened=f.create();await tick();assert.equal(reopened.getState().status,'empty');
  await reopened.importWallet('a');assert.equal(reopened.getState().profileId,'a');assert.equal(f.saved.size,1);reopened.dispose();
});

test('push events refresh balance without scheduled reads and logout aborts the subscription',async()=>{
  const f=fixture();let changed,signal,reads=0,value=1000;
  f.dependencies.balance=async()=>{reads++;return {availableSats:value,totalSats:value,bitcoinSats:0,arkadeSats:value};};
  f.dependencies.watch=async(address,s,onChange)=>{signal=s;changed=onChange;await new Promise(resolve=>s.addEventListener('abort',resolve,{once:true}));};
  const c=f.create();await tick();await c.importWallet('a');assert.equal(c.getState().balance.availableSats,1000);
  const initialReads=reads;await tick();await tick();assert.equal(reads,initialReads);
  value=2000;await changed();assert.equal(c.getState().balance.availableSats,2000);assert.equal(reads,initialReads+1);
  await c.logout();assert.equal(signal.aborted,true);value=3000;await changed();assert.equal(c.getState().status,'empty');assert.equal(c.getState().balance,undefined);c.dispose();
});

test('stream failure removes stale live balance',async()=>{
  const f=fixture();let fail;f.dependencies.watch=async()=>await new Promise((_,reject)=>fail=reject);
  const c=f.create();await tick();await c.importWallet('a');fail(Error('offline'));await tick();
  assert.equal(c.getState().balance,undefined);assert.match(c.getState().message,/disconnected/);c.dispose();
});
