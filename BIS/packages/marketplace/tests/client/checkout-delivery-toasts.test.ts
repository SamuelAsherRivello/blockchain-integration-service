import test from 'node:test';
import assert from 'node:assert/strict';
import { publishMarketplaceDeliveryToast } from '../../src/client/marketplace-layer/checkout-delivery-toasts.ts';
import { createPaymentNotifications } from '../../../integration/src/client/state-layer-core/payment-notifications.ts';

const transactionId='c'.repeat(64);
const item={assetId:'a'.repeat(64)+'0000',quantity:'1',name:'Shield II',ticker:'SHIELD2',priceSats:2200,iconUrl:'https://example.com/shield-2.png',family:'Shield',tier:'II',description:'',attributeDeltas:[]};
const request={id:'00000000-0000-4000-8000-000000000001',direction:'buy',player:{profileId:'player',address:'tark1playerdestination'},game:{profileId:'game',address:'tark1gamedestination'},assetId:item.assetId,quantity:'1',priceSats:2200};
function record(patch={}) {return {version:1,request,status:'pending',phase:'delivery-submitted',deliveryTransactionId:transactionId,...patch} as const;}
function memory(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}

test('pending Player Wallet delivery toast is evidence-backed, icon-bearing, and durable across a reload',()=>{
  const store=memory(),events:unknown[]=[];
  const input={record:record(),item,playerProfileId:'player',network:'signet',storage:store,show:(message:string,options:unknown)=>events.push({message,options})};
  assert.equal(publishMarketplaceDeliveryToast(input),true);
  assert.equal(publishMarketplaceDeliveryToast(input),false);
  assert.deepEqual(events,[{message:'Item transfer pending — Shield II is being transferred.',options:{messageType:'info',imageUrl:item.iconUrl}}]);
});

test('confirmed Player Wallet receipt and send use direction-aware wording',()=>{
  const events:unknown[]=[];
  const show=(message:string,options:unknown)=>events.push({message,options});
  assert.equal(publishMarketplaceDeliveryToast({record:record({status:'completed',phase:'completed'}),item,playerProfileId:'player',network:'signet',storage:memory(),show}),true);
  assert.equal(publishMarketplaceDeliveryToast({record:record({request:{...request,direction:'sell'},status:'completed',phase:'completed'}),item,playerProfileId:'player',network:'signet',storage:memory(),show}),true);
  assert.deepEqual(events,[
    {message:'Item transfer confirmed — Shield II is now in your Player Wallet.',options:{messageType:'success',imageUrl:item.iconUrl}},
    {message:'Item transfer confirmed — Shield II was sent from your Player Wallet.',options:{messageType:'success',imageUrl:item.iconUrl}},
  ]);
});

test('prepared, mismatched-player, and missing-artwork inputs do not fabricate a delivery receipt',()=>{
  const events:unknown[]=[];const show=(message:string,options:unknown)=>events.push({message,options});
  assert.equal(publishMarketplaceDeliveryToast({record:record({deliveryTransactionId:undefined}),item,playerProfileId:'player',network:'signet',storage:memory(),show}),false);
  assert.equal(publishMarketplaceDeliveryToast({record:record(),item,playerProfileId:'other',network:'signet',storage:memory(),show}),false);
  assert.equal(publishMarketplaceDeliveryToast({record:record(),item:{...item,iconUrl:''},playerProfileId:'player',network:'signet',storage:memory(),show}),true);
  assert.deepEqual(events,[{message:'Item transfer pending — Shield II is being transferred.',options:{messageType:'info'}}]);
});

test('a carrier-value receipt remains a generic payment notification beside the item transfer toast',()=>{
  const messages:string[]=[];
  const payments=createPaymentNotifications(message=>messages.push(message));
  payments.observe([]);
  payments.observe([{id:'carrier',identifier:`ark:${transactionId}`,direction:'Incoming',amountSats:330,status:'Pending offchain',receiptVerified:true}]);
  const store=memory();
  assert.equal(publishMarketplaceDeliveryToast({record:record(),item,playerProfileId:'player',network:'signet',storage:store,show:message=>messages.push(message)}),true);
  assert.deepEqual(messages,['Unknown user sent you 330 sats (Pending)','Unknown user sent you 330 sats (Confirmed)','Item transfer pending — Shield II is being transferred.']);
});
