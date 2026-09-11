import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamePlayerPayments, paymentSender} from '../src/core/game-player-payment.ts';
import {readSendRecord,writeSendRecord} from '../src/core/sending.ts';
import {clearBrowserPreferences} from '../src/core/logout-cleanup.ts';
const sender={profileId:'sender',phrase:'fixture-only'}, recipient={profileId:'player',address:'tark1fixture'};
const txid='a'.repeat(64);
function fixture() {
 const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_name,_options,fn)=>fn({})}}});
 let submits=0;
 const quote={id:'q',profileId:'sender',recipient:recipient.address,amountSats:1000,feeSats:0,totalSats:1000,maxSats:2000,expiresAt:Date.now()+60000,fingerprint:'b'.repeat(64)};
 const adapter={quote:async(a,r,n,_s,preserve)=>{assert.equal(a,sender);assert.equal(r,recipient.address);assert.equal(n,1000);assert.equal(preserve,true);return quote;},submit:async(a,q,current,journal,preserve)=>{assert.equal(preserve,true);assert.equal(current(),true);submits++;const record={version:1,id:'send',profileId:a.profileId,status:'pending',transactionId:txid,quote:q,inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)};journal.write(record);return record;},reconcile:async()=>readSendRecord('sender')};
 return {map,adapter,pay:createGamePlayerPayments(adapter),submits:()=>submits};
}
test('F2 journals before completion, blocks retries and retains recovery on player cleanup',async()=>{
 const f=fixture();const result=await f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>true);
 assert.equal(result.status,'pending');assert.equal(f.submits(),1);
 assert.equal(paymentSender({identifier:`ark:${txid}`,amountSats:1000},'player'),'sender');
 assert.equal(paymentSender({identifier:`ark:${txid}`,amountSats:999},'player'),undefined);
 assert.equal(paymentSender({identifier:`ark:${txid}`,amountSats:1000},'other'),undefined);
 await assert.rejects(f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>true));
 clearBrowserPreferences(globalThis.localStorage);assert.equal(readSendRecord('sender').status,'pending');
 assert.equal((await createGamePlayerPayments(f.adapter).check(sender,new AbortController().signal)).status,'pending');
});
test('no submission after account changes or quote failure',async()=>{
 const f=fixture();let current=true;f.adapter.quote=async()=>{current=false;throw Error('Insufficient funds');};
 await assert.rejects(f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>current));assert.equal(f.submits(),0);
 await assert.rejects(f.pay.pay(sender,{...recipient,profileId:'sender'},1000,new AbortController().signal,()=>true));
});
test('identity change after a successful quote prevents submission',async()=>{
 const f=fixture();let current=true;const quote=f.adapter.quote;
 f.adapter.quote=async(...args)=>{const result=await quote(...args);current=false;return result;};
 await assert.rejects(f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>current));
 assert.equal(f.submits(),0);
});

test('historical 1000-sat payment remains recognized and blocks a new payment',async()=>{
 const f=fixture();await f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>true);
 const record=readSendRecord('sender');
 writeSendRecord({...record,quote:{...record.quote,amountSats:1000,totalSats:1000}});
 f.map.set('bis-game-player-payment:'+txid,JSON.stringify({senderId:'sender',playerId:'player',amountSats:1000}));
 assert.equal(paymentSender({identifier:`ark:${txid}`,amountSats:1000},'player'),'sender');
 await assert.rejects(f.pay.pay(sender,recipient,1000,new AbortController().signal,()=>true));
 assert.equal(f.submits(),1);
});
