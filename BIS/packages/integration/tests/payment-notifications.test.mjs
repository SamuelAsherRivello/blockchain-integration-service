import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentNotifications} from '../src/core/payment-notifications.ts';
const row=(id,status='Pending',extra={})=>({id,identifier:`ark:${id}`,direction:'Incoming',amountSats:1000,status,...extra});
test('silent baseline, pending and final once, no downgrade replay',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));
 n.observe([row('old')]); n.observe([row('old'),row('new')]);
 n.observe([row('old','Confirmed'),row('new','Settled offchain')]);
 n.observe([row('old'),row('new')]); n.observe([row('old','Confirmed'),row('new','Settled offchain')]);
 assert.deepEqual(messages,['Unknown User Sent You 1000 Sats (Pending)','Unknown User Sent You 1000 Sats','Unknown User Sent You 1000 Sats']);
});
test('known sender, final-only arrival, change and asset-only excluded',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m),()=> 'ABCD0123456789');
 n.observe([]);n.observe([row('new','Settled offchain'),row('out','Confirmed',{direction:'Outgoing'}),row('asset','Confirmed',{amountSats:0})]);
 assert.deepEqual(messages,['User ABCD....56789 Sent You 1000 Sats']);
});
test('transfer identity survives row replacement and uncertain amounts stay silent',()=>{
 const messages=[],n=createPaymentNotifications(m=>messages.push(m));n.observe([]);
 n.observe([row('before','Pending — registered, awaiting verification',{transfer:{operationId:'op',direction:'to-arkade',status:'pending'}})]);
 n.observe([row('after','Transfer verified',{transfer:{operationId:'op',direction:'to-arkade',status:'succeeded'}}),row('unknown','Confirmed',{satsUnknown:true})]);
 assert.deepEqual(messages,['Transferred 1000 Sats From Bitcoin To Arkade (Pending)','Transferred 1000 Sats From Bitcoin To Arkade']);
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
