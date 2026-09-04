import test from 'node:test';
import assert from 'node:assert/strict';
import { sendAmounts, assertSendQuote, readSendRecord, writeSendRecord, assertNoPendingSend, completeSend } from '../src/core/sending.ts';
import {withSendActivity} from '../src/core/activity.ts';
const tx='a'.repeat(64);
const quote=()=>({id:'quote',profileId:'profile',recipient:'tark1test',amountSats:500,feeSats:0,totalSats:500,maxSats:1000,expiresAt:2000,fingerprint:'b'.repeat(64)});
const record=()=>({version:1,id:'operation',profileId:'profile',status:'pending',transactionId:tx,quote:quote(),inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)});
let values;
test.beforeEach(()=>{values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});});
test('amounts preserve exact recipient and reject dust change, fractions and unsafe totals',()=>{
 assert.deepEqual(sendAmounts(1000,500,330),{amountSats:500,changeSats:500,maxSats:1000});
 assert.equal(sendAmounts(1000,undefined,330).amountSats,1000);
 for(const n of [0,-1,1.2,1001,999,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>sendAmounts(1000,n,330));
 assert.throws(()=>sendAmounts(0,undefined,330));
});
test('quote binds all reviewed terms and expires',()=>{
 const q=quote();assert.doesNotThrow(()=>assertSendQuote(q,{...q,id:'fresh',expiresAt:3000},1000));
 for(const [key,value] of Object.entries({profileId:'other',recipient:'other',amountSats:501,feeSats:1,totalSats:501,maxSats:999,fingerprint:tx}))assert.throws(()=>assertSendQuote(q,{...q,[key]:value},1000));
 assert.throws(()=>assertSendQuote(q,q,2000));
});
test('pending journal survives reload, blocks mutations and releases only matching success',()=>{
 writeSendRecord(record());assert.equal(readSendRecord('profile').transactionId,tx);assert.throws(()=>assertNoPendingSend('profile'));
 assert.throws(()=>completeSend('other',tx,'profile'));assert.throws(()=>completeSend('operation','e'.repeat(64),'profile'));
 completeSend('operation',tx,'profile');assert.equal(readSendRecord('profile').status,'succeeded');assert.doesNotThrow(()=>assertNoPendingSend('profile'));
});
test('corrupt and unpersisted records fail closed',()=>{
 assert.throws(()=>writeSendRecord({...record(),transactionId:'bad'}));
 writeSendRecord(record());const key=[...values.keys()][0];values.set(key,'{bad');assert.throws(()=>assertNoPendingSend('profile'));
 values.clear();localStorage.setItem=()=>{};assert.throws(()=>writeSendRecord(record()));
});
test('journal rejects inconsistent monetary terms and extra secret-bearing fields',()=>{
 for(const bad of [{...record(),quote:{...quote(),totalSats:999}},{...record(),inputs:[]},{...record(),proof:'private'}])assert.throws(()=>writeSendRecord(bad));
});
test('Activity labels local send evidence and deduplicates real SDK history',()=>{
 const r=record();const rows=withSendActivity([],r,'profile');assert.equal(rows[0].status,'Pending — outcome unknown');assert.equal(rows[0].createdAt,undefined);assert.equal(rows[0].kind,'Local send operation');
 assert.equal(withSendActivity(rows,r,'profile').length,1);assert.equal(withSendActivity([],r,'other').length,0);
});
