import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentNotifications} from '../src/core/payment-notifications.ts';
const row=(id,status='Pending',extra={})=>({id,identifier:`ark:${id}`,direction:'Incoming',amountSats:1000,status,...extra});
test('receipt message types distinguish progress from verified success',()=>{
 const events=[],n=createPaymentNotifications((message,messageType)=>events.push({message,messageType}));
 n.observe([]);n.observe([row('type','Pending offchain')]);n.observe([row('type','Settled offchain')]);
 assert.deepEqual(events.map(e=>e.messageType),['info','success']);
 assert.equal(events[1].message,'Unknown user sent you 1000 sats (Confirmed)');
});
test('F3 settled receipt has an explicit confirmation and reports a new receipt only once',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m),()=> 'ABCD0123456789');
 n.observe([]);
 assert.equal(n.observe([row('f3','Pending offchain')]).newArkadeReceipt,true);
 assert.equal(n.observe([row('f3','Pending offchain')]).newArkadeReceipt,false);
 assert.equal(n.observe([row('changed','Settled offchain',{identifier:'ark:f3 commitment:extra'})]).newArkadeReceipt,false);
 assert.deepEqual(messages,['User ABCD....56789 sent you 1000 sats (Pending)','User ABCD....56789 sent you 1000 sats (Confirmed)']);
});
test('Arkade final toast explicitly says Confirmed',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));
 n.observe([]);n.observe([row('f3','Pending offchain')]);n.observe([row('f3','Settled offchain')]);
 assert.equal(messages[1],'Unknown user sent you 1000 sats (Confirmed)');
});
test('spendable preconfirmed receipt produces pending then confirmed without claiming settlement',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));
 n.observe([]);n.observe([row('f3','Pending offchain',{receiptVerified:true})]);
 n.observe([row('f3','Pending offchain',{receiptVerified:true})]);
 assert.deepEqual(messages,['Unknown user sent you 1000 sats (Pending)','Unknown user sent you 1000 sats (Confirmed)']);
 const historical=[];const baseline=createPaymentNotifications(m=>historical.push(m));
 baseline.observe([row('f3','Pending offchain',{receiptVerified:true})]);
 assert.deepEqual(historical,[]);
});
test('silent baseline, pending and final once, no downgrade replay',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));
 n.observe([row('old')]); n.observe([row('old'),row('new')]);
 n.observe([row('old','Confirmed'),row('new','Settled offchain')]);
 n.observe([row('old'),row('new')]); n.observe([row('old','Confirmed'),row('new','Settled offchain')]);
 assert.deepEqual(messages,['Unknown user sent you 1000 sats (Pending)','Unknown user sent you 1000 sats','Unknown user sent you 1000 sats (Confirmed)']);
});
test('known sender, final-only arrival, change and asset-only excluded',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m),()=> 'ABCD0123456789');
 n.observe([]);n.observe([row('new','Settled offchain'),row('out','Confirmed',{direction:'Outgoing'}),row('asset','Confirmed',{amountSats:0})]);
 assert.deepEqual(messages,['User ABCD....56789 sent you 1000 sats (Confirmed)']);
});
test('transfer identity survives row replacement and uncertain amounts stay silent',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));n.observe([]);
 n.observe([row('before','Pending — registered, awaiting verification',{transfer:{operationId:'op',direction:'to-arkade',status:'pending'}})]);
 n.observe([row('after','Transfer verified',{transfer:{operationId:'op',direction:'to-arkade',status:'succeeded'}}),row('unknown','Confirmed',{satsUnknown:true})]);
 assert.deepEqual(messages,['Transferred 1000 sats from Bitcoin to Arkade (Pending)','Transferred 1000 sats from Bitcoin to Arkade']);
});
test('changing history row metadata does not replay a receipt and Bitcoin needs confirmation evidence',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));n.observe([]);
 n.observe([row('a','Settled offchain',{identifier:'ark:stable'})]);
 n.observe([row('b','Settled offchain',{identifier:'ark:stable commitment:added'})]);
 n.observe([row('btc','Confirmed',{bitcoin:{txid:'btc'}})]);
 assert.equal(messages.length,1);
 n.observe([row('btc','Confirmed',{bitcoin:{txid:'btc',confirmations:1}})]);
 assert.equal(messages.length,2);
});
