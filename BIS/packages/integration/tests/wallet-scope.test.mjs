import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoardingRecord,writeBoardingRecord,assertNoPendingBoarding,withWalletMutation,createBoardingAttempt} from '../src/core/boarding-record.ts';
import {readSendRecord,writeSendRecord,assertNoPendingSend} from '../src/core/sending.ts';
import {createContext} from '../src/core/context.ts';
import {createAccountStorage} from '../src/core/account-storage.ts';

const transfer = profileId => ({version:1,id:'transfer',profileId,status:'pending',phase:'registered',intentId:'intent',inputs:[{txid:'a'.repeat(64),vout:0}],bitcoinAddress:'tb1-test',quote:{profileId,direction:'to-arkade',amountSats:1000,feeSats:0,netSats:1000,maxSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:2000,fingerprint:'c'.repeat(64)}});
const send = profileId => ({version:1,id:'send',profileId,status:'pending',transactionId:'a'.repeat(64),quote:{id:'quote',profileId,recipient:'tark1test',amountSats:500,feeSats:0,totalSats:500,maxSats:1000,expiresAt:2000,fingerprint:'b'.repeat(64)},inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)});
let values;
test.beforeEach(()=>{values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});});

for(const [name,make,read,write,guard,key] of [
 ['transfer',transfer,readBoardingRecord,writeBoardingRecord,assertNoPendingBoarding,'bis-signet-boarding-operation-v1'],
 ['send',send,readSendRecord,writeSendRecord,assertNoPendingSend,'bis-signet-send-operation-v1'],
]) {
 test(`${name}: another wallet cannot block or overwrite this wallet`,()=>{
  write(make('a'));
  assert.equal(read('b'),undefined);
  assert.doesNotThrow(()=>guard('b'));
  assert.throws(()=>guard('a'));
  write(make('b'));
  assert.deepEqual(read('a'),make('a'));
  assert.deepEqual(read('b'),make('b'));
  assert.equal(read(undefined),undefined);
 });
 test(`${name}: legacy recovery belongs only to its original wallet`,()=>{
  const raw=JSON.stringify(make('a'));values.set(key,raw);
  assert.equal(read('b'),undefined);
  assert.doesNotThrow(()=>guard('b'));
  write(make('b'));
  assert.deepEqual(read('a'),make('a'));
  assert.equal(values.get(key),raw);
 });
 test(`${name}: corrupt foreign records do not block this wallet`,()=>{
  write(make('a'));const ownKey=[...values.keys()][0];values.set(ownKey,'{bad');
  assert.equal(read('b'),undefined);
  assert.throws(()=>read('a'));
 });
}

function setup() {
 let account={profileId:'b',phrase:'fixture-only'},generation=0;
 const listeners=new Set();
 const storage={load:async()=>({account,generation}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
 const transfers={quote:async a=>transfer(a.profileId).quote,reconcile:async a=>readBoardingRecord(a.profileId)};
 const sends={funds:async()=>1000,quote:async a=>({...send(a.profileId).quote,expiresAt:Date.now()+60000}),reconcile:async a=>readSendRecord(a.profileId)};
 const context=createContext(storage,undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,transfers,undefined,sends);
 return {context,async switchTo(profileId){account={profileId,phrase:'fixture-only'};generation++;for(const fn of listeners)fn();await context.ready();await new Promise(r=>setImmediate(r));}};
}

test('current wallet status and spending ignore foreign pending operations, then restore their owner',async()=>{
 writeBoardingRecord(transfer('a'));writeSendRecord(send('a'));
 const {context,switchTo}=setup();await context.ready();
 try {
  assert.equal((await context.checkAccountTransfer()).status,'idle');
  assert.equal((await context.checkAccountSend()).status,'idle');
  assert.equal(await context.getSendSpendable(),1000);
  assert.equal((await context.quoteAccountTransfer(500)).profileId,'b');
  const quote=await context.quoteAccountSend('tark1test',500);
  await switchTo('a');
  assert.equal((await context.checkAccountTransfer()).status,'pending');
  assert.equal((await context.checkAccountSend()).status,'pending');
  await assert.rejects(context.getSendSpendable(),/unresolved/);
  await assert.rejects(context.confirmAccountSend(quote),/Review a fresh/);
  await switchTo('b');
  assert.equal(await context.getSendSpendable(),1000);
 } finally {context.dispose();}
});

test('wallet locks serialize the same owner while allowing another owner',async()=>{
 let release;const wait=new Promise(r=>release=r);
 const first=withWalletMutation(async()=>{await wait;},'a');
 try {
  await assert.rejects(withWalletMutation(async()=>{},'a'),/Another wallet operation/);
  await withWalletMutation(async()=>{},'b');
 } finally {release();await first;}
});

test('late transfer callbacks stay attached to their original wallet',()=>{
 writeBoardingRecord({...transfer('a'),phase:'prepared'});
 const attempt=createBoardingAttempt('transfer',()=>true,2000,'a',()=>1000);
 attempt.beforeRegister();writeBoardingRecord(transfer('b'));
 attempt.committed('d'.repeat(64));attempt.close();
 assert.equal(readBoardingRecord('a').commitmentTxid,'d'.repeat(64));
 assert.deepEqual(readBoardingRecord('b'),transfer('b'));
});

test('account clearing checks only the loaded wallet, without altering foreign recovery',async()=>{
 writeBoardingRecord(transfer('a'));writeSendRecord(send('a'));
 const snapshot=[...values.entries()];
 const storage=createAccountStorage();
 storage.load=async()=>({generation:0,account:{profileId:'b'}});
 // No database is installed: reaching it proves neither foreign guard blocked.
 await assert.rejects(storage.reset(0),/Private storage unavailable/);
 storage.load=async()=>({generation:0,account:{profileId:'a'}});
 await assert.rejects(storage.reset(0),/unresolved/);
 assert.deepEqual([...values.entries()],snapshot);
});
