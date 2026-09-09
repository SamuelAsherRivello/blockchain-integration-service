import test from 'node:test';
import assert from 'node:assert/strict';
import {createLtoService} from '../src/core/lto-service.ts';
import {createContractStorage} from '../src/core/contract-storage.ts';
import {markContractSubmission,finishContractOperation} from '../src/core/contracts.ts';
import {testLocks} from './locks-fixture.mjs';
import {walletReservations} from '../src/core/wallet-reservations.ts';

const delay=()=>new Promise(resolve=>setTimeout(resolve,5));
async function until(check) { for(let i=0;i<100;i++){if(await check())return;await delay();}assert.fail('operation did not finish'); }
function setup(overrides={}) {
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),key:i=>[...values.keys()][i]??null,get length(){return values.size;}}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:testLocks()}});
  let envelope;
  const storage=createContractStorage({read:async()=>structuredClone(envelope),write:async(next,revision)=>{assert.equal(envelope?.revision??0,revision);envelope=structuredClone(next);}});
  const player={profileId:'player',phrase:'test-only-placeholder'},game={profileId:'game',phrase:'test-only-placeholder'};
  const playerState={profileId:'player',phase:'active'},gameState={profileId:'game',status:'ready'};
  const calls=[],toasts=[];
  const context={getState:()=>playerState,showToast:text=>toasts.push(text),refreshBalance:async()=>{}},gameWallet={getState:()=>gameState,refresh:async()=>{}};
  const recovery={secretHex:'12'.repeat(32),playerKey:'23'.repeat(32),gameKey:'34'.repeat(32),operatorKey:'45'.repeat(32),exitDelay:'512',gameScript:'00',playerScript:'01',contractScript:'02'};
  const dependencies={storage,playerStorage:{load:async()=>({generation:0,account:player})},gameStorage:{load:async()=>game,dispose(){}},poll:false,
    prepare:async()=>recovery,reconcile:async(record,recovery)=>({record,recovery}),resume:async(record,recovery)=>({record,recovery}),
    submit:async(record,recovery,account,commit,isCurrent)=>{
      assert.ok(isCurrent());calls.push(record.operation.kind);
      const transactionId=(record.operation.kind==='fund'?'b':'c').repeat(64);
      const material={...recovery,spend:{operationId:record.operation.id,transactionId,inputs:[recovery.fundingOutput??{txid:'a'.repeat(64),vout:0,value:1000}],destinationScript:'00',amountSats:1000}};
      record=markContractSubmission(record,record.operation.id,Date.now());await commit(record,material);
      assert.ok(walletReservations('game').some(operation=>operation.id===`contract:${record.id}`),'reserved before completion');
      await overrides.wait?.(record.operation.kind);
      if(overrides.unknown===record.operation.kind){record=markContractSubmission(record,record.operation.id,Date.now(),true);await commit(record,material);return{record,recovery:material};}
      record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'confirmed'});
      if(record.operation.kind==='fund')material.fundingOutput={txid:transactionId,vout:0,value:1000};
      await commit(record,material);return{record,recovery:material};
    }};
  const service=createLtoService({context,gameWallet},dependencies);
  const now=Date.now(),request={sessionId:'session',purpose:'treasureLTO',hostReference:'chest',exclusivityKey:'treasure',amountSats:1000,startedAt:now,expiresAt:now+90000};
  return{service,storage,calls,toasts,request,playerState,gameState,dependencies,context,gameWallet};
}

test('disposed recovery worker refunds its offer and stops even when an unrelated operator record stays unresolved',async t=>{
  const s=setup(),timers=[],cleared=[];
  t.mock.method(globalThis,'setInterval',callback=>{timers.push(callback);return timers.length;});
  t.mock.method(globalThis,'clearInterval',id=>cleared.push(id));
  const page=new EventTarget();page.visibilityState='visible';
  Object.defineProperty(globalThis,'document',{configurable:true,value:page});
  let storageDisposed=false;s.dependencies.gameStorage.dispose=()=>{storageDisposed=true;};
  const worker=createLtoService({context:s.context,gameWallet:s.gameWallet},{...s.dependencies,poll:true});
  await delay();await worker.start(s.request);await delay();
  const saved=await s.storage.load(),own=saved.ledger.contracts[0];
  const unrelated={...own,id:'other-operator',scope:{...own.scope,operator:'https://unrelated.invalid'}};
  await s.storage.save({...saved,ledger:{...saved.ledger,contracts:[own,unrelated],attempts:[...saved.ledger.attempts,{...saved.ledger.attempts[0],scope:unrelated.scope,contractId:unrelated.id}]},recovery:{...saved.recovery,[unrelated.id]:saved.recovery[own.id]}});
  worker.dispose();await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  timers[1]();await delay();
  assert.equal(storageDisposed,true);assert.equal(cleared.length,2);
  assert.equal((await s.storage.load()).ledger.contracts[1].financial,'funded');assert.deepEqual(s.calls,['fund','refund']);
});

test('game-role Refund reports its pending and confirmed feedback to the inspecting game account',async()=>{
  const s=setup(),funded=await s.service.start(s.request);await delay();
  s.playerState.profileId='game';assert.equal((await s.service.refund(funded.contract.id)).status,'pending');
  await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  assert.ok(s.toasts.includes('Contract refund pending'));assert.ok(s.toasts.some(text=>text.startsWith('Contract refund confirmed')));
});

test('visibility recovery refunds an elapsed offer once without extending its original deadline',async t=>{
  const s=setup(),page=new EventTarget();page.visibilityState='hidden';
  Object.defineProperty(globalThis,'document',{configurable:true,value:page});
  t.mock.method(globalThis,'setInterval',()=>1);t.mock.method(globalThis,'clearInterval',()=>{});
  const worker=createLtoService({context:s.context,gameWallet:s.gameWallet},{...s.dependencies,poll:true});
  await delay();await worker.start(s.request);await delay();
  t.mock.method(Date,'now',()=>s.request.expiresAt+1);
  page.visibilityState='visible';page.dispatchEvent(new Event('visibilitychange'));
  await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  page.dispatchEvent(new Event('visibilitychange'));await delay();
  const record=(await s.storage.load()).ledger.contracts[0];
  assert.equal(record.expiresAt,s.request.expiresAt);assert.deepEqual(s.calls,['fund','refund']);
  worker.dispose();
});

test('creation-disabled rollback keeps query and refund recovery available',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const recovery=createLtoService({context:s.context,gameWallet:s.gameWallet,creationEnabled:false},s.dependencies);
  assert.equal((await recovery.start({...s.request,sessionId:'disabled'})).status,'unavailable');
  await s.service.endSession(s.request.sessionId);await recovery.reconcile();
  await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  assert.deepEqual(s.calls,['fund','refund']);
  assert.equal((await recovery.start({...s.request,sessionId:'disabled-after-refund'})).status,'unavailable');
  assert.deepEqual(s.calls,['fund','refund']);
});

test('reload recovers a prepared operation as never submitted under the mutation lock',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const document=await s.storage.load(),record=document.ledger.contracts[0];
  const {beginContractOperation}=await import('../src/core/contracts.ts');
  const prepared=beginContractOperation(record,'claim','prepared-claim',Date.now());
  await s.storage.save({...document,ledger:{...document.ledger,contracts:[prepared]},recovery:{[record.id]:{...document.recovery[record.id],spend:undefined,finalization:undefined}}});
  await s.service.endSession(s.request.sessionId);await s.service.reconcile();
  await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  assert.deepEqual(s.calls,['fund','refund']);
});

test('same session submits once; funded slot stays reserved and duplicate notifications are suppressed',async()=>{
  const s=setup();const first=s.service.start(s.request),second=s.service.start(s.request);
  assert.equal(first,second);assert.equal((await first).status,'confirmed');
  await delay();await s.service.reconcile();
  assert.deepEqual(s.calls,['fund']);assert.equal(s.toasts.filter(text=>text.includes('confirmed')).length,1);
  assert.equal((await s.storage.load()).ledger.contracts.length,1);
});
test('end during funding immediately persists forfeiture, then refunds late success',async()=>{
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const s=setup({wait:kind=>kind==='fund'?wait:undefined});
  const funding=s.service.start(s.request);await until(()=>s.calls.length===1);
  await s.service.endSession(s.request.sessionId);release();await funding;
  await until(async()=> (await s.storage.load()).ledger.contracts[0]?.financial==='refunded');
  assert.deepEqual(s.calls,['fund','refund']);
  assert.equal(walletReservations('game').length,0);
  assert.ok(!s.toasts.some(text=>text.startsWith('Offer funding confirmed')));
});
test('older offer blocks the entire new session, including after its refund finishes',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const next={...s.request,sessionId:'next'};
  assert.equal((await s.service.start(next)).status,'unavailable');
  await until(async()=> (await s.storage.load()).ledger.contracts[0]?.financial==='refunded');
  assert.equal((await s.service.start(next)).status,'unavailable');
  assert.deepEqual(s.calls,['fund','refund']);
});
test('Claim returns pending after durable acceptance; unknown outcome prevents competing refund after logout',async()=>{
  const s=setup({unknown:'claim'});const funded=await s.service.start(s.request);await delay();
  const action=await s.service.claim(funded.contract.id);assert.equal(action.status,'pending');
  await until(async()=> (await s.storage.load()).ledger.contracts[0].financial==='unknown');
  s.playerState.profileId=undefined;await s.service.endSession(s.request.sessionId);await s.service.reconcile();
  assert.deepEqual(s.calls,['fund','claim']);assert.equal(walletReservations('game').length,1);
});
test('readiness failure never starts late and cooperating controllers cannot create overlapping offers',async()=>{
  const s=setup();s.gameState.status='loading';assert.equal((await s.service.start(s.request)).status,'unavailable');
  s.gameState.status='ready';assert.equal((await s.service.start(s.request)).status,'unavailable');assert.equal(s.calls.length,0);
  const other=createLtoService({context:s.context,gameWallet:s.gameWallet},s.dependencies);
  const result=await Promise.all([s.service.start({...s.request,sessionId:'one'}),other.start({...s.request,sessionId:'two'})]);
  assert.equal(result.filter(r=>r.status==='confirmed').length,1);assert.deepEqual(s.calls,['fund']);
});

test('public inspection filters exact host reference, exposes roles and never signs',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const read=await s.service.checkContracts({hostReference:'chest'});
  assert.equal(read.contracts[0].role,'player');assert.equal(read.contracts[0].canRefund,false);
  assert.equal(read.contracts[0].canClaim,true);assert.equal('secretHex' in read.contracts[0],false);
  assert.equal((await s.service.checkContracts({hostReference:'other'})).contracts.length,0);
  s.playerState.profileId='game';const game=await s.service.checkContracts();
  assert.equal(game.contracts[0].role,'game');assert.equal(game.contracts[0].canClaim,false);assert.equal(game.contracts[0].canRefund,true);
  assert.deepEqual(s.calls,['fund']);
});

test('player cannot use the game Refund action and logout preserves game contract recovery',async()=>{
  const s=setup();const result=await s.service.start(s.request);await delay();
  assert.equal((await s.service.refund(result.contract.id)).status,'unavailable');
  const {pendingLogoutOperations,clearBrowserPreferences,assertLogoutResolvable}=await import('../src/core/logout-cleanup.ts');
  assert.equal(pendingLogoutOperations().count,1);assert.throws(()=>assertLogoutResolvable());
  clearBrowserPreferences(localStorage);
  assert.equal(walletReservations('game').length,1);assert.equal((await s.storage.load()).ledger.contracts.length,1);
  s.playerState.profileId=undefined;await s.service.endSession(s.request.sessionId);await s.service.reconcile();
  await until(async()=>(await s.storage.load()).ledger.contracts[0].financial==='refunded');
  assert.equal(walletReservations('game').length,0);
});

test('known reserved outpoints leave independent funds available and switching games preserves old recovery',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const {eligibleUnreservedCoins}=await import('../src/core/wallet-reservations.ts');
  const coins=[{txid:'b'.repeat(64),vout:0},{txid:'d'.repeat(64),vout:0}];
  assert.deepEqual(eligibleUnreservedCoins(coins,walletReservations('game')),[coins[1]]);
  s.gameState.profileId='different-game';s.dependencies.gameStorage.load=async()=>({profileId:'different-game'});
  await s.service.endSession(s.request.sessionId);await s.service.reconcile();
  assert.equal((await s.storage.load()).ledger.contracts[0].financial,'funded');assert.equal(walletReservations('game').length,1);
});

test('Admin Reset cannot clear either participant while a contract is unresolved',async()=>{
  const s=setup();await s.service.start(s.request);await delay();
  const {createAccountStorage}=await import('../src/core/account-storage.ts');
  const before=await s.storage.load();
  for(const profileId of ['player','game']) {
    const accountStorage=createAccountStorage();
    accountStorage.load=async()=>({generation:0,account:{profileId}});
    await assert.rejects(accountStorage.reset(),/contract.*unresolved/i);
  }
  assert.deepEqual(await s.storage.load(),before);
  assert.equal(walletReservations('game').length,1);
  assert.deepEqual(s.calls,['fund']);
});
