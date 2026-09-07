import {testLocks} from './locks-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,getControls} from '../src/core/context.ts';
import {writeSendRecord,assertNoPendingSend} from '../src/core/sending.ts';
const q=()=>({id:crypto.randomUUID(),profileId:'p',recipient:'tark1test',amountSats:500,feeSats:0,totalSats:500,maxSats:1000,expiresAt:Date.now()+60000,fingerprint:'b'.repeat(64)});
let values,locked;
test.beforeEach(()=>{values=new Map();locked=false;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});});
function setup(overrides={}){
 let account={profileId:'p',phrase:'fixture-only'},generation=0,calls=0;const listeners=new Set();
 const storage={load:async()=>({account,generation}),save:async()=>{},reset:async()=>{assertNoPendingSend(account?.profileId);account=null;},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}};
 const sends={funds:async()=>1000,quote:async()=>q(),submit:async(_a,quote)=>{calls++;return {version:1,id:'op',profileId:'p',status:'succeeded',transactionId:'a'.repeat(64),quote,inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)};},reconcile:async()=>undefined,...overrides};
 const context=createContext(storage,undefined,async()=>account?.profileId,undefined,undefined,undefined,undefined,undefined,undefined,undefined,sends);
 return {context,calls:()=>calls,replace(){account={profileId:'other',phrase:'fixture-only'};generation++;for(const l of listeners)l();}};
}
test('only latest issued quote authorizes a single send',async()=>{
 const s=setup();await s.context.ready();const first=await s.context.quoteAccountSend('tark1test',500),second=await s.context.quoteAccountSend('tark1test',500);
 await assert.rejects(s.context.confirmAccountSend(first));await assert.rejects(s.context.confirmAccountSend({...second}));
 assert.equal((await s.context.confirmAccountSend(second)).status,'succeeded');await assert.rejects(s.context.confirmAccountSend(second));assert.equal(s.calls(),1);s.context.dispose();
});
test('account replacement and disposal invalidate review',async()=>{
 for(const action of ['replace','dispose']){const s=setup();await s.context.ready();const quote=await s.context.quoteAccountSend('tark1test',500);if(action==='replace')s.replace();else s.context.dispose();await assert.rejects(s.context.confirmAccountSend(quote));assert.equal(s.calls(),0);s.context.dispose();}
});
test('pending send blocks reset, transfer and mint without clearing data',async()=>{
 const s=setup();await s.context.ready();writeSendRecord({version:1,id:'op',profileId:'p',status:'pending',transactionId:'a'.repeat(64),quote:q(),inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)});
 await assert.rejects(s.context.quoteAccountTransfer(500));assert.equal((await s.context.mintAsset({operationId:'x',name:'x',ticker:'x',amount:'1',decimals:0})).status,'error');await assert.rejects(getControls(s.context).reset());assert.equal(values.size,1);s.context.dispose();
});
test('status preserves pending evidence on network failure and never submits',async()=>{
 const s=setup({reconcile:async()=>{throw Error('private');}});await s.context.ready();writeSendRecord({version:1,id:'op',profileId:'p',status:'pending',transactionId:'a'.repeat(64),quote:q(),inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)});
 const status=await s.context.checkAccountSend();assert.equal(status.status,'pending');assert.equal(status.verification,'unavailable');assert.equal(s.calls(),0);s.context.dispose();
});
