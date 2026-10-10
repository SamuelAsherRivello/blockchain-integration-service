import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutSession} from '../../src/client/marketplace-layer/checkout-session.ts';
import {advanceLocalMarketplaceCheckout,beginLocalMarketplaceCheckout,confirmLocalMarketplaceCheckoutLeg,readLocalMarketplaceCheckout,readLocalMarketplaceCheckouts} from '../../../integration/src/client/state-layer-core/marketplace-checkout.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const intent={direction:'buy',assetId:'a'.repeat(68),quantity:'1',priceSats:1000};
function fixture(){
 const data=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 let p={profileId:'player',phase:'active',network:'signet'},g={profileId:'game',network:'signet',selectionVersion:1,addresses:{arkadeAddress:'tark1gamedestination'}};
 const listeners=new Set(),notify=()=>{for(const l of listeners)l();},subscribe=l=>{listeners.add(l);return()=>listeners.delete(l);};
 const player={getState:()=>p,subscribe,getSendSpendable:async()=>2000,getPaymentRecipient:async()=>({profileId:p.profileId,address:'tark1playerdestination'})};
 const game={getState:()=>g,subscribe,getPlayerPaymentBalance:()=>2000};
 const session=createCheckoutSession(player,game,{begin:beginLocalMarketplaceCheckout,confirm:confirmLocalMarketplaceCheckoutLeg,read:readLocalMarketplaceCheckout});
 const change=kind=>{
  if(kind==='player')p={...p,profileId:'other'};
  if(kind==='game')g={...g,profileId:'other',selectionVersion:2};
  if(kind==='network')p={...p,network:'mutinynet'};
  if(kind==='relogin'){p={...p,phase:'idle'};notify();p={...p,phase:'active'};}
  if(kind==='dispose')session.dispose();
  notify();
 };
 return {session,player,game,change,data,listeners};
}
for(const at of ['balance','recipient'])for(const kind of ['player','game','network','relogin','dispose'])test(`checkout ${at} completion cannot cross ${kind}`,async()=>{
 const f=fixture(),gate=deferred(),scope=f.session.capture();
 if(at==='balance')f.player.getSendSpendable=()=>gate.promise;
 else f.player.getPaymentRecipient=()=>gate.promise;
 const prepared=f.session.prepare(intent,scope);await tick();f.change(kind);gate.resolve(at==='balance'?2000:{profileId:'player',address:'tark1playerdestination'});
 await assert.rejects(prepared,/session changed/);assert.equal(readLocalMarketplaceCheckouts().length,0);f.session.dispose();
});
test('intent is immutable, duplicate item preparation is blocked, disjoint items can prepare',async()=>{
 const f=fixture(),scope=f.session.capture(),gate=deferred();f.player.getSendSpendable=()=>gate.promise;
 const draft={...intent};const first=f.session.prepare(draft,scope);draft.assetId='b'.repeat(68);draft.priceSats=9999;
 await assert.rejects(f.session.prepare(intent,scope),/already preparing/);
 const second=f.session.prepare({...intent,assetId:'c'.repeat(68)},scope);gate.resolve(2000);
 const [a,c]=await Promise.all([first,second]);assert.equal(a.request.assetId,intent.assetId);assert.equal(a.request.priceSats,1000);assert.equal(c.request.assetId,'c'.repeat(68));f.session.dispose();
});
for(const direction of ['buy','sell'])test(`submitted ${direction} first leg cannot advance after replacement or recreate a cleared journal`,async()=>{
 const f=fixture(),scope=f.session.capture(),record=await f.session.prepare({...intent,direction},scope),gate=deferred();let nextLeg=0;
 const active=advanceLocalMarketplaceCheckout(record,{isCurrent:()=>f.session.current(scope),pay:async()=>{if(direction==='sell')nextLeg++;return gate.promise;},deliver:async()=>{if(direction==='buy')nextLeg++;return gate.promise;}});
 f.change('game');f.data.clear();gate.resolve(direction==='buy'?{status:'succeeded',transactionId:'b'.repeat(64)}:{status:'delivered',transactionId:'c'.repeat(64)});
 await active;assert.equal(nextLeg,0);assert.equal(f.data.size,0);f.session.dispose();
});
for(const kind of ['player','game','network','relogin','dispose','cancel','logout'])test(`old checkout recovery cannot publish or recreate a journal after ${kind}`,async()=>{
 const f=fixture(),scope=f.session.capture(),record=await f.session.prepare(intent,scope);
 const pending=await advanceLocalMarketplaceCheckout(record,{pay:async()=>({status:'pending',transactionId:'b'.repeat(64)}),deliver:async()=>assert.fail()});
 const gate=deferred();let alive=true;
 const recovering=f.session.recover(pending,scope,()=>gate.promise,()=>alive);await tick();
 if(kind==='cancel')alive=false;else if(kind==='logout')f.data.clear();else f.change(kind);
 gate.resolve({status:'succeeded',transactionId:'b'.repeat(64),amountSats:1000,recipient:'tark1gamedestination'});
 assert.equal(await recovering,undefined);if(kind==='logout')assert.equal(f.data.size,0);else assert.equal(readLocalMarketplaceCheckout(record.request.id).phase,'payment-submitted');f.session.dispose();
});
test('recovery requires matching current addresses, network, and exact payment receipt',async()=>{
 const f=fixture(),scope=f.session.capture(),record=await f.session.prepare(intent,scope);
 const pending=await advanceLocalMarketplaceCheckout(record,{pay:async()=>({status:'pending',transactionId:'b'.repeat(64)}),deliver:async()=>assert.fail()});
 const evidence={status:'succeeded',transactionId:'b'.repeat(64),amountSats:1000,recipient:'tark1gamedestination'};
 assert.equal(await f.session.recover(pending,scope,async()=>({...evidence,transactionId:'c'.repeat(64)})),undefined);
 assert.equal(await f.session.recover(pending,scope,async()=>({...evidence,amountSats:999})),undefined);
 f.player.getPaymentRecipient=async()=>({profileId:'player',address:'tark1otheroperator'});
 await assert.rejects(f.session.recover(pending,scope,async()=>evidence),/network/);
 f.player.getPaymentRecipient=async()=>({profileId:'player',address:record.request.player.address});
 const next=await f.session.recover(pending,scope,async()=>evidence);assert.equal(next.phase,'delivery');
 f.session.dispose();assert.equal(f.listeners.size,0);
});
