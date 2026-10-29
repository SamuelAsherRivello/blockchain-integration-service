import test from 'node:test';
import assert from 'node:assert/strict';
import {createBisGameWallet,createLocalGameWallet,createNetworkScopedGameWalletStorage} from '../../src/client/state-layer-core/game-wallet.ts';
import {writeAssetRecord} from '../../src/client/state-layer-core/assets.ts';
import {invalidateSharedAssetInventory} from '../../src/client/state-layer-core/shared-asset-inventory.ts';
import {testLocks} from './locks-fixture.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Game Wallet availability and payment readiness read reservations on the Player network',async()=>{
 const f=fixture(),calls=[];
 const c=createBisGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'mutinynet'},f.dependencies,undefined,undefined,(profile,network)=>{calls.push([profile,network]);});
 await tick();await c.importWallet('game');
 c.getOperationAvailability();c.canPayPlayer();c.getPlayerPaymentBalance();
 assert.deepEqual(calls,[['game','mutinynet'],['game','mutinynet'],['game','mutinynet']]);c.dispose();
});

test('Game Wallet preflight storage read is bounded without retry or mutation',async t=>{
 const f=fixture(),c=f.create();await tick();await c.importWallet('game');
 let reads=0;f.storage.load=()=>{reads++;return new Promise(()=>{});};
 t.mock.timers.enable({apis:['setTimeout']});
 const result=c.getPendingAssetMint();
 const rejected=assert.rejects(result,/timed out/);
 t.mock.timers.tick(30000);await rejected;assert.equal(reads,1);c.dispose();
});

test('forced Game Wallet inventory preparation replaces cached pre-trade holdings',async()=>{
 invalidateSharedAssetInventory();const f=fixture();let assets=[],reads=0;
 const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,undefined,{
  availability:async()=>({canMint:true}),list:async()=>{reads++;return assets;},mint:async()=>{throw Error('Not used');},
 });
 await tick();await c.importWallet('game');assert.deepEqual((await c.prepareAssetInventory()).assets,[]);
 assets=[{assetId:'incoming',quantity:'1'}];assert.deepEqual((await c.prepareAssetInventory()).assets,[]);
 assert.equal((await c.prepareAssetInventory(true)).assets[0].assetId,'incoming');assert.equal(reads,2);c.dispose();invalidateSharedAssetInventory();
});

test('confirmed Game Wallet mint invalidates presentation inventory',async()=>{
 invalidateSharedAssetInventory();const values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 const f=fixture();let assets=[],reads=0;
 const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,undefined,{
  availability:async()=>({canMint:true}),list:async()=>{reads++;return assets;},
  mint:async(account,request)=>{const asset={assetId:'fresh-item',quantity:'1'};assets=[asset];return {status:'minted',profileId:account.profileId,operationId:request.operationId,asset};},
 });
 await tick();await c.importWallet('game');
 assert.deepEqual((await c.prepareAssetInventory()).assets,[]);
 await c.mintAsset({operationId:'cache-mint',name:'Test',ticker:'TEST',amount:'1',decimals:0});
 assert.equal((await c.prepareAssetInventory()).assets[0].assetId,'fresh-item');assert.equal(reads,2);
 c.dispose();invalidateSharedAssetInventory();
});

test('authoritative Game Wallet listing suppresses a same-profile network switch',async()=>{
 const f=fixture();let network='signet',finish,begin;
 const started=new Promise(resolve=>{begin=resolve;});
 const c=createBisGameWallet({playerProfileId:()=> 'player',playerNetwork:()=>network},f.dependencies,undefined,undefined,undefined,{
  availability:async()=>({canMint:true}),mint:async()=>{throw Error('Not used');},
  list:async account=>{assert.equal(account.network,'signet');begin();return new Promise(resolve=>{finish=resolve;});},
 });
 await tick();await c.importWallet('game');const pending=c.listAssets();await started;
 network='mutinynet';finish([{assetId:'obsolete',quantity:'1'}]);
 assert.equal((await pending).code,'account-changed');c.dispose();
});

test('A.G.3 enables at 1000 sats and remains unavailable below 1000',async()=>{
  for(const amount of [999,1000]) {
    const f=fixture();
    f.dependencies.balance=async()=>({availableSats:amount,totalSats:amount,bitcoinSats:0,arkadeSats:amount});
    const c=createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,undefined,undefined,()=>{});
    await tick();await c.importWallet('sender');
    assert.equal(c.canPayPlayer(),amount===1000);c.dispose();
  }
});

test('Admin operation scope is public, current, and reports truthful wallet availability',async()=>{
  const f=fixture();
  const c=createBisGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'signet'},f.dependencies,undefined,undefined,()=>{});
  await tick(); await c.importWallet('game');
  const scope=c.getOperationScope();
  assert.deepEqual(scope,{playerProfileId:'player',gameProfileId:'game',network:'signet',selectionVersion:c.getState().selectionVersion});
  assert.equal(c.isOperationScopeCurrent(scope),true);
  assert.equal(c.getOperationAvailability().available,true);
  assert.equal('phrase' in scope,false);
  await c.logout();
  assert.equal(c.isOperationScopeCurrent(scope),false);
  assert.equal(c.getOperationAvailability().reason,'game-wallet');
  c.dispose();
});

test('Admin operation availability distinguishes a network-mismatched retained wallet',async()=>{
  const f=fixture();
  await f.storage.select({phrase:'game',profileId:'game',network:'mutinynet'});
  const c=createBisGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'signet'},f.dependencies);
  await tick();
  assert.equal(c.getState().readStatus,'network-mismatch');
  assert.equal(c.getOperationAvailability().reason,'network-mismatch');
  assert.equal(c.getOperationAvailability().available,false);
  c.dispose();
});

test('C.G.1 checks and mints with the selected game identity, never the player identity',async()=>{
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
test('C.G.1 pending mint lookup follows the selected game wallet network',async()=>{
 const values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),key:i=>[...values.keys()][i]??null,get length(){return values.size;}}});
 const f=fixture();
 f.dependencies.restore=async phrase=>({phrase,profileId:'game',network:'mutinynet'});
 const c=createBisGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'mutinynet'},f.dependencies);
 await tick();await c.importWallet('game');
 const request={operationId:'mutiny-mint',name:'Mutiny',ticker:'MUT',amount:'1',decimals:0};
 writeAssetRecord('game',{request,status:'pending',network:'mutinynet'});
 assert.deepEqual((await c.getPendingAssetMint()).request,request);
 c.dispose();
});
test('A.G.2 reports unresolved boarding rather than awaiting balance and recovers when cleared',async()=>{
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
    quote: async (account, _signal, requestedSats) => { calls.push([account.profileId,requestedSats]); return {profileId:account.profileId,direction:'to-arkade',requestedSats}; },
    submit: async (account, quote, current) => { assert.equal(current(),true); calls.push(account.profileId); return {status:'pending'}; },
    check: async account => { calls.push(account.profileId); return {status:'idle'}; },
  };
  const c = createBisGameWallet({playerProfileId:()=> 'player'},f.dependencies,boarding);
  await tick(); await assert.rejects(c.quoteBoarding());
  for (const invalid of [0,-1,1.5,Number.NaN,Number.POSITIVE_INFINITY]) await assert.rejects(c.quoteBoarding(invalid),/positive whole-sat/);
  await c.importWallet('game');
  const quote = await c.quoteBoarding(1000);
  assert.equal(quote.requestedSats,1000);
  await assert.rejects(c.board({...quote,profileId:'player'}));
  assert.equal((await c.board(quote)).status,'pending');
  await c.checkBoarding(); assert.deepEqual(calls,[['game',1000],'game','game']);
  c.dispose();
});
function fixture() {
  let selected = null,playerProfileId='player';
  const saved = new Map(), listeners = new Set();
  const storage = {logout:async()=>{selected=null;saved.clear();},load:async()=>selected, select:async a=>{saved.set(a.profileId,a);selected=a;},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},dispose(){}};
  const dependencies = {storage, restore:async phrase=>{if(phrase==='invalid')throw Error('sensitive');return {phrase,profileId:phrase};},addresses:async a=>({arkadeAddress:`tark1${a.profileId}`,bitcoinAddress:`tb1${a.profileId}`}),balance:async()=>({availableSats:1000,totalSats:1000,bitcoinSats:0,arkadeSats:1000})};
  return {dependencies,saved,listeners,storage,setPlayerProfileId:value=>{playerProfileId=value;},create:()=>createBisGameWallet({playerProfileId:()=> playerProfileId},dependencies)};
}
test('prewarmed public Game Wallet addresses are reused when the Player connects',async()=>{
  const f=fixture();let playerProfileId:string|undefined;let addressReads=0,releasePrewarm:undefined|(()=>void);
  f.storage.load=async()=>({phrase:'game',profileId:'game',network:'signet'});
  f.dependencies.addresses=async account=>{
    addressReads++;
    if(addressReads===1)return new Promise(resolve=>{releasePrewarm=()=>resolve({arkadeAddress:`tark1${account.profileId}`,bitcoinAddress:`tb1${account.profileId}`});});
    return {arkadeAddress:`tark1${account.profileId}`,bitcoinAddress:`tb1${account.profileId}`};
  };
  const c=createLocalGameWallet({playerProfileId:()=>playerProfileId},f.dependencies);
  await tick();await tick();
  assert.equal(c.getState().status,'empty');assert.equal(c.getState().addresses,undefined);assert.equal(addressReads,1);
  playerProfileId='player';const refresh=c.refresh();await tick();releasePrewarm?.();await refresh;
  assert.equal(c.getState().status,'ready');assert.equal(c.getState().addresses?.arkadeAddress,'tark1game');assert.equal(addressReads,1);
  c.dispose();
});
test('Player refresh does not wait for an address prewarm whose wallet identity is not yet known',async()=>{
  const f=fixture();let playerProfileId:string|undefined,storageReads=0,addressReads=0,releasePrewarm:undefined|(()=>void);
  const saved={phrase:'game',profileId:'game',network:'signet' as const};
  f.storage.load=async()=>{
    storageReads++;
    if(storageReads===1)return new Promise<typeof saved>(resolve=>{releasePrewarm=()=>resolve(saved);});
    return saved;
  };
  f.dependencies.addresses=async account=>{addressReads++;return {arkadeAddress:`tark1${account.profileId}`,bitcoinAddress:`tb1${account.profileId}`};};
  const c=createLocalGameWallet({playerProfileId:()=>playerProfileId},f.dependencies);
  await tick();await tick();
  assert.equal(storageReads,1);
  playerProfileId='player';
  await c.refresh();
  assert.equal(c.getState().status,'ready');
  assert.equal(c.getState().addresses?.arkadeAddress,'tark1game');
  assert.equal(addressReads,1);
  c.dispose();
  releasePrewarm?.();
});
test('import retains wallets, reselects without duplicates and restores last selection',async()=>{
  const f=fixture(),c=f.create();await tick();
  assert.equal(await c.importWallet('a'),true);assert.equal(await c.importWallet('b'),true);assert.equal(await c.importWallet('a'),true);
  assert.equal(f.saved.size,2);assert.equal(c.getState().profileId,'a');assert.equal('phrase' in c.getState(),false);
  assert.equal(await c.importWallet('invalid'),false);assert.equal(c.getState().profileId,'a');
  assert.equal(await c.importWallet('player'),false);assert.equal(f.saved.size,2);
  assert.equal(c.getState().message,'This recovery phrase belongs to the player wallet. Restore or create a separate game wallet.');
  c.dispose();const reloaded=f.create();await tick();assert.equal(reloaded.getState().profileId,'a');reloaded.dispose();
});
test('A.G.2 create requires explicit selection and publishes a new non-secret selection version',async()=>{
  const f=fixture();f.dependencies.create=async()=>({phrase:'created game wallet',profileId:'created-game'});
  const c=f.create();await tick();const before=c.getState().selectionVersion;
  const candidate=await c.createWallet();
  assert.equal(candidate.profileId,'created-game');assert.equal(c.getState().profileId,undefined);
  assert.equal(await c.selectWallet(candidate),true);assert.equal(c.getState().profileId,'created-game');
  assert.ok(c.getState().selectionVersion>before);assert.equal('phrase' in c.getState(),false);
  const selectedVersion=c.getState().selectionVersion;await c.logout();
  assert.ok(c.getState().selectionVersion>selectedVersion);assert.equal(c.getState().status,'empty');c.dispose();
});
test('Game Wallet selection and refresh reject a Player Wallet match without replacing storage',async()=>{
  const f=fixture(),c=f.create();await tick();await c.importWallet('a');
  f.setPlayerProfileId('b');
  assert.equal(await c.selectWallet({profileId:'b',phrase:'b'}),false);
  assert.equal(c.getState().profileId,'a');assert.match(c.getState().message,/Player Wallet/);
  f.setPlayerProfileId('a');await c.refresh();
  assert.equal(c.getState().status,'unavailable');assert.equal(c.getState().profileId,undefined);
  f.setPlayerProfileId(undefined);await c.refresh();
  assert.equal(c.getState().profileId,undefined);assert.equal(c.getState().status,'empty');
  assert.match(c.getState().message,/Connect a Player Wallet/);c.dispose();
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

test('transient address and balance failures retry before Game Wallet becomes ready',async()=>{
  const f=fixture();let addressReads=0,balanceReads=0;
  f.dependencies.addresses=async account=>{if(++addressReads===1)throw Error('temporary address failure');return {arkadeAddress:`tark1${account.profileId}`,bitcoinAddress:`tb1${account.profileId}`};};
  f.dependencies.balance=async()=>{if(++balanceReads===1)throw Error('temporary balance failure');return {availableSats:4,totalSats:4,bitcoinSats:0,arkadeSats:4};};
  const c=f.create();await tick();await c.importWallet('a');
  assert.equal(c.getState().status,'ready');assert.equal(c.getState().balance.availableSats,4);
  assert.equal(addressReads,2);assert.equal(balanceReads,2);c.dispose();
});

test('refresh keeps the selected game wallet address and balance visible while reads are pending',async()=>{
  const f=fixture();let releaseBalance;
  f.dependencies.balance=async a=>a.profileId==='a'?await new Promise(resolve=>{releaseBalance=resolve;}):{availableSats:2,totalSats:2,bitcoinSats:0,arkadeSats:2};
  const c=f.create();await tick();
  const importing=c.importWallet('a');await tick();
  releaseBalance({availableSats:1,totalSats:1,bitcoinSats:0,arkadeSats:1});await importing;
  assert.equal(c.getState().addresses.arkadeAddress,'tark1a');
  assert.equal(c.getState().balance.arkadeSats,1);
  const refreshing=c.refresh();await tick();
  assert.equal(c.getState().status,'loading');
  assert.equal(c.getState().addresses.arkadeAddress,'tark1a');
  assert.equal(c.getState().balance.arkadeSats,1);
  releaseBalance({availableSats:3,totalSats:3,bitcoinSats:0,arkadeSats:3});await refreshing;
  assert.equal(c.getState().addresses.arkadeAddress,'tark1a');
  assert.equal(c.getState().balance.arkadeSats,3);c.dispose();
});


test('logout purges every retained wallet and requires a fresh import',async()=>{
  const f=fixture(),c=f.create();await tick();await c.importWallet('a');await c.logout();
  assert.equal(c.getState().status,'empty');assert.equal(c.getState().profileId,undefined);assert.equal(f.saved.size,0);
  c.dispose();const reopened=f.create();await tick();assert.equal(reopened.getState().status,'empty');
  await reopened.importWallet('a');assert.equal(reopened.getState().profileId,'a');assert.equal(f.saved.size,1);reopened.dispose();
});

test('a Player network change cannot leave the prior-network Game Wallet visible',async()=>{
  let network='signet';
  const stores=new Map();
  const storageFor=value=>{
    if(!stores.has(value)){
      let selected=null;
      stores.set(value,{load:async()=>selected,select:async account=>{selected=account;},logout:async()=>{selected=null;},reset:async()=>{selected=null;},subscribe:()=>()=>{},dispose:()=>{}});
    }
    return stores.get(value);
  };
  const c=createLocalGameWallet({playerProfileId:()=> 'player',playerNetwork:()=>network},{
    storage:createNetworkScopedGameWalletStorage(()=>network,storageFor),
    restore:async(phrase,_signal,selectedNetwork)=>({phrase,profileId:`${selectedNetwork}-wallet`,network:selectedNetwork}),
    addresses:async()=>({arkadeAddress:'tark1fixture',bitcoinAddress:'tb1fixture'}),
    balance:async()=>({availableSats:1,totalSats:1,bitcoinSats:0,arkadeSats:1}),watch:undefined,
  });
  await tick();
  await c.importWallet('signet fixture');
  assert.equal(c.getState().profileId,'signet-wallet');
  assert.equal(c.getState().network,'signet');

  network='mutinynet';
  await c.refresh();
  assert.equal(c.getState().status,'empty');
  assert.equal(c.getState().profileId,undefined);
  assert.equal(c.getState().network,'mutinynet');
  c.dispose();
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

test('stream failure recovers through a fresh balance read',async()=>{
  const f=fixture();let fail;let reads=0;
  f.dependencies.balance=async()=>({availableSats:++reads,totalSats:reads,bitcoinSats:0,arkadeSats:reads});
  f.dependencies.watch=async()=>await new Promise((_,reject)=>fail=reject);
  const c=f.create();await tick();await c.importWallet('a');const initialReads=reads;fail(Error('offline'));await tick();await tick();
  assert.equal(c.getState().status,'ready');assert.equal(c.getState().balance.availableSats,initialReads+1);c.dispose();
});

test('unchanged Player publications do not refresh Game; identity changes refresh once',async()=>{
  const f=fixture();let notify,player='player',reads=0;
  f.dependencies.balance=async()=>{reads++;return {availableSats:1,totalSats:1,bitcoinSats:0,arkadeSats:1};};
  const c=createLocalGameWallet({playerProfileId:()=>player,playerNetwork:()=> 'signet',
    playerSubscribe:listener=>{notify=listener;return()=>{};},
    playerSessionKey:()=>JSON.stringify([player,'signet']),
  },f.dependencies);
  await tick();await c.importWallet('game');const initial=reads;
  for(let i=0;i<20;i++)notify();await tick();assert.equal(reads,initial);
  player='other-player';notify();for(let i=0;i<20;i++)notify();await tick();assert.equal(reads,initial+1);
  c.dispose();
});

test('external Game storage change retires immediately, but own candidate selection is retained',async()=>{
  const f=fixture();let retired=0;f.dependencies.retire=()=>{retired++;};
  const c=f.create();await tick();await c.importWallet('game');
  assert.equal(retired,0);
  for(const listener of f.listeners)listener();assert.equal(retired,1,'retirement precedes asynchronous reload');
  await tick();c.dispose();
});

