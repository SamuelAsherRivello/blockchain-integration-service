import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,getControls} from '../src/core/context.ts';
import {validateContinue,readContinuations,writeContinuation,continueResult} from '../src/core/continuation.ts';
import {reconcileContinuation} from '../src/arkade/continuation.ts';
import {writeSendRecord} from '../src/core/sending.ts';
import {pendingLogoutOperations,clearBrowserPreferences} from '../src/core/logout-cleanup.ts';
import {RestArkProvider,RestIndexerProvider} from '@arkade-os/sdk';
import {testLocks} from './locks-fixture.mjs';
const request={operationId:'continue-1',sats:1000,context:'run-1'};
const receipt=(status='pending')=>({version:1,id:'send-1',profileId:'p',status,transactionId:'a'.repeat(64),quote:{id:'q',profileId:'p',recipient:'tark1fixture',amountSats:1000,feeSats:0,totalSats:1000,maxSats:2000,expiresAt:Date.now()+60000,fingerprint:'b'.repeat(64)},inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)});
let memory;
test.beforeEach(()=>{
 memory=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
});
function setup({submit,reconcile=reconcileContinuation}={}){
 let account={profileId:'p',phrase:'fixture-only'},generation=0,calls=0,saves=0;const listeners=new Set();
 const storage={load:async()=>({account,generation}),save:async()=>{saves++;},reset:async()=>{account=null;},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}};
 const adapter={submit:async(a,r,signal,current)=>{calls++;if(submit)return submit(a,r,signal,current);const saved={...r,send:receipt('succeeded'),status:'succeeded'};writeContinuation(saved);return continueResult(saved);},reconcile};
 const context=createContext(storage,undefined,async()=>account?.profileId,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,adapter);
 return {context,calls:()=>calls,saves:()=>saves,replace(profileId='other'){account=profileId?{profileId,phrase:'fixture-only'}:null;generation++;for(const l of listeners)l();}};
}
test('whole-sat boundaries pass and every invalid amount rejects before adapter work',async()=>{
 const s=setup();await s.context.ready();
 for(const sats of [999,10001,1000.5,NaN,Infinity,-Infinity,'1000',null,undefined])await assert.rejects(s.context.requestContinue({...request,sats}));
 assert.equal(s.calls(),0);
 validateContinue({...request,sats:1000});validateContinue({...request,sats:10000});s.context.dispose();
});
test('same identity is durable and idempotent; changed amount/context fails; generic sends cannot overwrite it',async()=>{
 const s=setup();await s.context.ready();assert.equal((await s.context.requestContinue(request)).status,'succeeded');
 assert.equal((await s.context.requestContinue(request)).context,'run-1');assert.equal(s.calls(),1);assert.equal(s.saves(),0);
 for(const changed of [{sats:2000},{context:'run-2'}])await assert.rejects(s.context.requestContinue({...request,...changed}));
 writeSendRecord({...receipt('succeeded'),id:'ordinary-send'});clearBrowserPreferences(localStorage);
 assert.equal(readContinuations('p')[0].send.id,'send-1');s.context.dispose();
 const reloaded=setup();await reloaded.context.ready();assert.equal((await reloaded.context.requestContinue(request)).status,'succeeded');assert.equal(reloaded.calls(),0);reloaded.context.dispose();
});
test('lost response remains pending; spending, reset and logout cannot discard it',async t=>{
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>{throw Error('offline');});
 const s=setup({submit:async(a,r)=>{const saved={...r,send:receipt()};writeContinuation(saved);return continueResult(saved);}});await s.context.ready();
 assert.equal((await s.context.requestContinue(request)).status,'pending');assert.equal((await s.context.requestContinue(request)).status,'pending');assert.equal(s.calls(),1);
 await assert.rejects(s.context.quoteAccountSend('tark1fixture',1000));await assert.rejects(getControls(s.context).reset());assert.throws(()=>pendingLogoutOperations());
 assert.equal((await s.context.getContinueStatus())[0].context,'run-1');s.context.dispose();
});
test('only exact finalized output reconciles; absent or wrong output does not imply failure',async t=>{
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet'}));let output;
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:output?[output]:[]}));
 const record={request,profileId:'p',status:'pending',send:receipt()};writeContinuation(record);
 const account={profileId:'p',phrase:'fixture-only'},signal=new AbortController().signal;
 assert.equal((await reconcileContinuation(account,record,signal)).status,'pending');
 output={txid:record.send.transactionId,vout:0,value:999,script:record.send.recipientScript};assert.equal((await reconcileContinuation(account,record,signal)).status,'pending');
 output.value=1000;assert.equal((await reconcileContinuation(account,record,signal)).status,'succeeded');
});
test('interrupted preparation is confirmed not submitted and never retried',async()=>{
 writeContinuation({request,profileId:'p',status:'pending'});const s=setup();await s.context.ready();
 assert.equal((await s.context.requestContinue(request)).status,'failed');assert.equal(s.calls(),0);s.context.dispose();
});
test('no account blocks submission; late result retains original account and run',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const s=setup({submit:async(a,r)=>{await gate;return continueResult({...r,status:'succeeded',send:receipt('succeeded')});}});await s.context.ready();
 const pending=s.context.requestContinue(request);await new Promise(r=>setImmediate(r));s.replace();await s.context.ready();release();
 const result=await pending;assert.equal(result.profileId,'p');assert.equal(result.context,'run-1');assert.equal(s.context.getState().profileId,'other');
 s.replace(null);await s.context.ready();await assert.rejects(s.context.requestContinue({...request,operationId:'new'}));assert.equal(s.calls(),1);s.context.dispose();
});

test('asset-bearing pending payment reconciles only with exact owned asset change and asset-free recipient',async t=>{
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet'}));
 const send=receipt();send.change={script:'5120'+'e'.repeat(64),sats:1000,assets:[{assetId:'f'.repeat(64)+'0000',amount:'9007199254740993'}]};
 const record={request,profileId:'p',status:'pending',send};writeContinuation(record);
 const receiver={txid:send.transactionId,vout:0,value:1000,script:send.recipientScript};
 const change={txid:send.transactionId,vout:1,value:1000,script:send.change.script,assets:[{assetId:send.change.assets[0].assetId,amount:9007199254740993n}]};
 let outputs=[receiver];t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:outputs}));
 const check=()=>reconcileContinuation({profileId:'p',phrase:'fixture'},record,new AbortController().signal);
 assert.equal((await check()).status,'pending');
 outputs=[receiver,{...change,assets:[]}];assert.equal((await check()).status,'pending');
 outputs=[receiver,{...change,script:send.recipientScript}];assert.equal((await check()).status,'pending');
 outputs=[receiver,{...change,assets:[{...change.assets[0],amount:1n}]}];assert.equal((await check()).status,'pending');
 outputs=[{...receiver,assets:change.assets},change];assert.equal((await check()).status,'pending');
 outputs=[receiver,change];assert.equal((await check()).status,'succeeded');
});
