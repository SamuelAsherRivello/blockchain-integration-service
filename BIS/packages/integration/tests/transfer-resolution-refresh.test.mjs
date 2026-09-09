import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext} from '../src/core/context.ts';
import {readBoardingRecord,writeBoardingRecord} from '../src/core/boarding-record.ts';
import {walletReservations} from '../src/core/wallet-reservations.ts';
const tick=()=>new Promise(r=>setImmediate(r));
const pending=(id,input='a')=>({version:1,id,profileId:'player',status:'pending',phase:'registered',createdAt:id==='older'?1:2,inputs:[{txid:input.repeat(64),vout:0}],bitcoinAddress:'tb1-test',quote:{profileId:'player',direction:'to-bitcoin',amountSats:1000,feeSats:0,netSats:1000,maxSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)}});
function setup(t,{latestPending=true,persist=true,failBalance=false,delay,failAfter=false,shared=false}={}) {
 const memory=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No network allowed');});
 writeBoardingRecord(pending('older'));if(latestPending)writeBoardingRecord(pending('latest','b'));
 let account={profileId:'player',phrase:'not-a-wallet'},generation=0,notify=()=>{},resolved=false;
 const reads={balance:0,assets:0,activity:0};
 const storage={load:async()=>({account,generation}),subscribe:fn=>{notify=fn;return()=>{};}};
 const reconcile=async()=>{
  if(delay)await delay;
  if(!persist)throw Error('Persistence unavailable');
  const record=readBoardingRecord('player','older');
  writeBoardingRecord({...record,status:'succeeded',commitmentTxid:'d'.repeat(64)});resolved=true;
  if(failAfter)throw Error('Later operation read unavailable');
  return readBoardingRecord('player',latestPending?'latest':'older');
 };
 const observe=async(_account,signal,publish)=>{reads.activity++;publish([]);await new Promise(r=>signal.addEventListener('abort',r,{once:true}));};
 const context=createContext(storage,undefined,async()=>account.profileId,undefined,
  async()=>{reads.balance++;if(resolved&&failBalance)throw Error('Balance unavailable');return {availableSats:resolved?1000:2000,totalSats:2000,arkadeSats:resolved?1000:2000,bitcoinSats:resolved?1000:0};},undefined,undefined,
  observe,
  {reconcile}, {list:async()=>{reads.assets++;return [];}},undefined,undefined,undefined,undefined,shared?observe:undefined);
 t.after(()=>context.dispose());
 return {context,reads,replace(){account={profileId:'other-player',phrase:'not-a-wallet'};generation++;notify();}};
}
for(const view of ['balance','assets','activity'])for(const latestPending of [true,false])test(`${view} refreshes once when ${latestPending?'an older':'the latest'} withdrawal resolves`,async t=>{
 const f=setup(t,{latestPending});await f.context.ready();f.context.openAccountDialog();
 if(view==='balance')f.context.openAccountDetails();
 if(view==='assets')f.context.openAccountAssets();
 if(view==='activity')f.context.openAccountActivity();
 await tick();const before=f.reads[view];
 await f.context.checkAccountTransfer();await tick();
 assert.equal(f.reads[view],before+1,'Any durably resolved operation refreshes the visible wallet');
 await f.context.checkAccountTransfer();await tick();
 assert.equal(f.reads[view],before+1,'Repeated checks do not publish the same completion twice');
 assert.deepEqual(walletReservations('player').map(r=>r.id),latestPending?['transfer:latest']:[]);
 if(view==='balance')assert.equal(f.context.getState().balance.arkadeSats,1000);
});
test('failure to persist resolution retains reservations without publishing availability',async t=>{
 const f=setup(t,{persist:false});await f.context.ready();f.context.openAccountDialog();f.context.openAccountDetails();await tick();
 const before=f.reads.balance;
 assert.equal((await f.context.checkAccountTransfer()).verification,'unavailable');await tick();
 assert.equal(f.reads.balance,before);assert.equal(walletReservations('player').length,2);
});
test('balance service failure does not erase durable completion or invent a zero balance',async t=>{
 const f=setup(t,{failBalance:true});await f.context.ready();f.context.openAccountDialog();f.context.openAccountDetails();await tick();
 await f.context.checkAccountTransfer();await tick();await tick();
 assert.equal(readBoardingRecord('player','older').status,'succeeded');
 assert.equal(f.context.getState().balance.status,'unavailable');
 assert.equal(f.context.getState().balance.arkadeSats,undefined);
});
test('late completion for a replaced account cannot refresh the replacement wallet',async t=>{
 let release;const delay=new Promise(r=>release=r);
 const f=setup(t,{delay});await f.context.ready();f.context.openAccountDialog();f.context.openAccountDetails();await tick();
 const work=f.context.checkAccountTransfer();await tick();f.replace();await f.context.ready();await tick();
 const before={...f.reads};release();await assert.rejects(work,/account changed/i);await tick();
 assert.deepEqual(f.reads,before);assert.equal(f.context.getState().profileId,'other-player');
 assert.equal(readBoardingRecord('player','older').status,'succeeded');
});
test('partial reconciliation failure still publishes an earlier durable resolution',async t=>{
 const f=setup(t,{failAfter:true});await f.context.ready();f.context.openAccountDialog();f.context.openAccountDetails();await tick();
 const before=f.reads.balance;
 assert.equal((await f.context.checkAccountTransfer()).verification,'unavailable');await tick();
 assert.equal(f.reads.balance,before+1);assert.equal(walletReservations('player').length,1);
});
test('shared wallet source is invalidated once for verified resolution',async t=>{
 const f=setup(t,{shared:true});await f.context.ready();await tick();f.context.openAccountDialog();f.context.openAccountDetails();await tick();
 const before=f.reads.activity;
 await f.context.checkAccountTransfer();await tick();await tick();
 assert.equal(f.reads.activity,before+1);assert.equal(f.context.getState().balance.arkadeSats,1000);
 await f.context.checkAccountTransfer();await tick();assert.equal(f.reads.activity,before+1);
});
