import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleUnreservedCoins, migrateWalletReservations, walletReservations } from '../src/core/wallet-reservations.ts';
import {writeSendRecord,readSendRecords,completeSend} from '../src/core/sending.ts';

const a={txid:'a'.repeat(64),vout:0,value:5000};
const b={txid:'b'.repeat(64),vout:0,value:1000};
test('reservations exclude entire inputs while independent funds remain eligible',()=>{
 assert.deepEqual(eligibleUnreservedCoins([a,b],[{id:'transfer',inputs:[a]}]),[b]);
 assert.deepEqual(eligibleUnreservedCoins([a,b],[]),[a,b]);
});
test('unknown reservations fail closed instead of treating missing inputs as empty',()=>{
 assert.throws(()=>eligibleUnreservedCoins([a,b],[{id:'legacy-mint'}]),/inputs.*verified/);
});
test('multiple operations reserve the union, and resolving one releases only its inputs',()=>{
 assert.deepEqual(eligibleUnreservedCoins([a,b],[{id:'a',inputs:[a]},{id:'b',inputs:[b]}]),[]);
 assert.deepEqual(eligibleUnreservedCoins([a,b],[{id:'b',inputs:[b]}]),[a]);
});

test('multi-send migration preserves original records and late completion targets only its operation',()=>{
 const data=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 const record=(id,coin)=>({version:1,id,profileId:'p',status:'pending',transactionId:(id==='first'?'c':'d').repeat(64),quote:{id,profileId:'p',recipient:'tark1test',amountSats:500,feeSats:0,totalSats:500,maxSats:coin.value,expiresAt:2000,fingerprint:'e'.repeat(64)},inputs:[{txid:coin.txid,vout:coin.vout}],recipientScript:'5120'+'f'.repeat(64)});
 writeSendRecord(record('first',a));const original=data.get('bis-signet-send-operation-v1:p');
 writeSendRecord(record('second',b));migrateWalletReservations('p');
 assert.equal(data.get('bis-signet-send-operation-v1:p'),original);
 assert.equal(readSendRecords('p').length,2);assert.equal(walletReservations('p').length,2);
 completeSend('first','c'.repeat(64),'p');assert.equal(readSendRecords('p')[1].status,'pending');
 assert.deepEqual(eligibleUnreservedCoins([a,b],walletReservations('p')),[a]);
 assert.deepEqual(walletReservations('other'),[]);
 data.set('bis-signet-wallet-operations-v2:p','broken');assert.throws(()=>walletReservations('p'),/recovery data/);
 data.delete('bis-signet-wallet-operations-v2:p');
 localStorage.setItem=()=>{throw Error('write failed');};assert.throws(()=>migrateWalletReservations('p'));
 assert.equal(readSendRecords('p').length,2);
});
