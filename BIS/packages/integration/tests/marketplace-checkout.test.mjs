import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceLocalMarketplaceCheckout, beginLocalMarketplaceCheckout, confirmLocalMarketplaceCheckoutLeg, readLocalMarketplaceCheckout, readLocalMarketplaceCheckouts} from '../src/core/marketplace-checkout.ts';

const player={profileId:'player-profile',address:'tark1playerdestination'};
const game={profileId:'game-profile',address:'tark1gamedestination'};
const request={id:'00000000-0000-4000-8000-000000000001',direction:'buy',player,game,assetId:'a'.repeat(64)+'0000',quantity:'1',priceSats:1100};

function memory() {
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
  return values;
}

test('a local purchase reserves an immutable exact item before the first leg and reaches completion only after both legs',async()=>{
  memory();
  const pending=beginLocalMarketplaceCheckout(request);
  assert.equal(pending.phase,'payment');
  assert.throws(()=>beginLocalMarketplaceCheckout({...request,quantity:'2'}));
  const calls=[];
  const complete=await advanceLocalMarketplaceCheckout(pending,{
    pay:async({recipient,amountSats})=>{calls.push(`pay:${recipient}:${amountSats}`);return {status:'succeeded',transactionId:'b'.repeat(64)};},
    deliver:async({recipient,assetId,quantity})=>{calls.push(`deliver:${recipient}:${assetId}:${quantity}`);return {status:'delivered',transactionId:'c'.repeat(64)};},
  });
  assert.equal(complete.status,'completed');
  assert.deepEqual(calls,[`pay:${game.address}:1100`,`deliver:${player.address}:${request.assetId}:1`]);
  assert.equal(readLocalMarketplaceCheckout(request.id)?.status,'completed');
});

test('a pending first leg never runs the second leg or submits a duplicate',async()=>{
  memory();
  const pending=beginLocalMarketplaceCheckout(request);let deliveries=0;
  const next=await advanceLocalMarketplaceCheckout(pending,{pay:async()=>({status:'pending'}),deliver:async()=>{deliveries++;return {status:'delivered',transactionId:'c'.repeat(64)};}});
  assert.equal(next.phase,'payment-submitted');assert.equal(next.status,'pending');assert.equal(deliveries,0);
});

test('a pending checkout reserves only its seller-owned exact item across reloads',()=>{
  memory();
  const first=beginLocalMarketplaceCheckout(request);
  assert.equal(readLocalMarketplaceCheckouts().length,1);
  assert.throws(()=>beginLocalMarketplaceCheckout({...request,id:'00000000-0000-4000-8000-000000000002'}),/already reserved/);
  assert.doesNotThrow(()=>beginLocalMarketplaceCheckout({...request,id:'00000000-0000-4000-8000-000000000003',assetId:'d'.repeat(64)+'0000'}));
  assert.equal(readLocalMarketplaceCheckout(first.request.id)?.phase,'payment');
});

test('a sell-back delivers before it pays and never completes without transaction evidence',async()=>{
  memory();
  const sell=beginLocalMarketplaceCheckout({...request,id:'00000000-0000-4000-8000-000000000004',direction:'sell'});
  const calls=[];
  const pending=await advanceLocalMarketplaceCheckout(sell,{deliver:async({recipient})=>{calls.push(`deliver:${recipient}`);return {status:'delivered',transactionId:'c'.repeat(64)};},pay:async({recipient,amountSats})=>{calls.push(`pay:${recipient}:${amountSats}`);return {status:'succeeded',transactionId:'b'.repeat(64)};}});
  assert.equal(pending.status,'completed');
  assert.deepEqual(calls,[`deliver:${game.address}`,`pay:${player.address}:1100`]);
  const incomplete=beginLocalMarketplaceCheckout({...request,id:'00000000-0000-4000-8000-000000000005'});
  const unknown=await advanceLocalMarketplaceCheckout(incomplete,{pay:async()=>({status:'succeeded'}),deliver:async()=>({status:'delivered',transactionId:'c'.repeat(64)})});
  assert.equal(unknown.phase,'payment-submitted');
  assert.equal(unknown.status,'pending');
});

test('a confirmed purchase payment with interrupted delivery and an interrupted sell delivery stay pending',async()=>{
  memory();
  const buy=beginLocalMarketplaceCheckout(request);let buyDeliveries=0;
  const buyPending=await advanceLocalMarketplaceCheckout(buy,{pay:async()=>({status:'succeeded',transactionId:'b'.repeat(64)}),deliver:async()=>{buyDeliveries++;return {status:'pending'};}});
  assert.equal(buyPending.phase,'delivery-submitted');
  assert.equal(buyPending.status,'pending');
  assert.equal(buyDeliveries,1);
  const sell=beginLocalMarketplaceCheckout({...request,id:'00000000-0000-4000-8000-000000000006',direction:'sell',assetId:'f'.repeat(64)+'0000'});let payments=0;
  const sellPending=await advanceLocalMarketplaceCheckout(sell,{deliver:async()=>({status:'pending'}),pay:async()=>{payments++;return {status:'succeeded',transactionId:'b'.repeat(64)};}});
  assert.equal(sellPending.phase,'delivery-submitted');
  assert.equal(sellPending.status,'pending');
  assert.equal(payments,0);
});

test('unreadable checkout recovery data fails closed',()=>{
  const values=memory();
  values.set('bis-local-marketplace-checkout-v1:00000000-0000-4000-8000-000000000001','not-json');
  assert.throws(()=>readLocalMarketplaceCheckouts(),/recovery data is invalid/);
});

test('reconciliation advances a submitted leg without sending it again',async()=>{
  memory();
  const pending=beginLocalMarketplaceCheckout(request);
  const submitted=await advanceLocalMarketplaceCheckout(pending,{pay:async()=>({status:'pending'}),deliver:async()=>{throw Error('must not deliver yet');}});
  const confirmed=confirmLocalMarketplaceCheckoutLeg(submitted,'payment','b'.repeat(64));
  assert.equal(confirmed.phase,'delivery');
  assert.equal(confirmed.paymentTransactionId,'b'.repeat(64));
});
