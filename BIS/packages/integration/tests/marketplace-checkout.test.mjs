import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceLocalMarketplaceCheckout, beginLocalMarketplaceCheckout, confirmLocalMarketplaceCheckoutLeg, readLocalMarketplaceCheckout} from '../src/core/marketplace-checkout.ts';

const player={profileId:'player-profile',address:'tark1playerdestination'};
const game={profileId:'game-profile',address:'tark1gamedestination'};
const request={id:'00000000-0000-4000-8000-000000000001',direction:'buy',player,game,assetId:'a'.repeat(64)+'0000',quantity:'1',priceSats:1100};

function memory() {
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
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

test('reconciliation advances a submitted leg without sending it again',async()=>{
  memory();
  const pending=beginLocalMarketplaceCheckout(request);
  const submitted=await advanceLocalMarketplaceCheckout(pending,{pay:async()=>({status:'pending'}),deliver:async()=>{throw Error('must not deliver yet');}});
  const confirmed=confirmLocalMarketplaceCheckoutLeg(submitted,'payment','b'.repeat(64));
  assert.equal(confirmed.phase,'delivery');
  assert.equal(confirmed.paymentTransactionId,'b'.repeat(64));
});
