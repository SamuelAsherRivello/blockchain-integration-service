import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMintDestination} from '../../src/client/admin-layer/mint-destination.ts';
import {createBisAssetCollection} from '../../../integration/src/client/state-layer-core/asset-collection.ts';

const request = {operationId:'mint-one', name:'an asset', ticker:'ASSET', amount:'1', decimals:0};
test('mint destination rejects network mismatch and suppresses a same-profile network switch',async()=>{
  const source=wallet('game'),recipient=wallet('player');
  source.state.network='mutinynet';recipient.state.network='signet';
  await assert.rejects(prepareMintDestination('player',source,recipient,()=>true,()=>{}),/must match/);
  recipient.state.network='mutinynet';
  const target=await prepareMintDestination('game',source,source,()=>true,()=>{});
  source.state.network='signet';
  assert.equal(target.isCurrent(),false);
  assert.equal((await target.mint(request)).code,'account-changed');
  assert.equal(source.calls.length,0);
});
function wallet(profileId) {
  const calls = [];
  const state = {profileId};
  return {calls, state, getState:()=>state, subscribe:()=>()=>{},
    getPendingAssetMint:async()=>({status:'success', profileId, request:null}),
    getMintAvailability:async()=>({canMint:true}),
    mintAsset:async r=>{calls.push(r);return {status:'minted', profileId, operationId:r.operationId, asset:{assetId:'asset-one',amount:'1'}};}};
}
function gameWallet(profileId='game-profile') {
  const selected=wallet(profileId);
  selected.getState=()=>({profileId});
  selected.deliveries=[];
  selected.deliverAsset=async request=>{selected.deliveries.push(request);return {status:'delivered',profileId,operationId:request.operationId,assetId:request.assetId,quantity:request.quantity,recipient:request.recipient,transactionId:'delivery'};};
  return selected;
}
test('each destination calls only its wallet and logs its original identity', async()=>{
  const player=wallet('player-profile'),game=wallet('game-profile');
  for(const destination of ['player','game']) {
    const selected=destination==='player'?player:game, other=destination==='player'?game:player;
    const logs=[],before=other.calls.length;
    const target=await prepareMintDestination(destination,selected,()=>true,r=>logs.push(r));
    await target.mint(request);
    assert.deepEqual(selected.calls.at(-1),request);
    assert.equal(other.calls.length,before);
    assert.equal(logs.length,2);
    for(const log of logs){assert.equal(log.destination,destination);assert.equal(log.profileId,selected.state.profileId);}
  }
});
test('player destination issues through Game Wallet and then delivers to Player Wallet', async()=>{
  const game=gameWallet(),player=wallet('player-profile');
  player.getState=()=>({profileId:'player-profile',addresses:{status:'ready',arkadeAddress:'tark1player'}});
  const target=await prepareMintDestination('player',game,player,()=>true,()=>{});
  const result=await target.mint(request);
  assert.equal(result.status,'minted');
  assert.equal(game.calls.length,1);
  assert.equal(player.calls.length,0);
});
test('player destination resolves a lazy Player Wallet receiving address before minting', async()=>{
  const game=gameWallet(),player=wallet('player-profile');
  player.getState=()=>({profileId:'player-profile',phase:'active'});
  player.getPaymentRecipient=async()=>({profileId:'player-profile',address:'tark1lazy-player'});
  const target=await prepareMintDestination('player',game,player,()=>true,()=>{});
  const result=await target.mint(request);
  assert.equal(result.status,'minted');
  assert.equal(game.calls.length,1);
  assert.equal(game.deliveries[0].recipient,'tark1lazy-player');
});
test('missing wallet and failed lookup prevent preparation; production reports insufficient funds',async()=>{
  await assert.rejects(prepareMintDestination('player',undefined,()=>true,()=>{}),/Log in/);
  await assert.rejects(prepareMintDestination('game',undefined,()=>true,()=>{}),/Import/);
  const selected=wallet('player');
  selected.getPendingAssetMint=async()=>({status:'error',message:'Lookup failed'});
  await assert.rejects(prepareMintDestination('player',selected,()=>true,()=>{}),/Lookup failed/);
  selected.getPendingAssetMint=async()=>({status:'success',profileId:'player',request:null});
  selected.getMintAvailability=async()=>({canMint:false,reason:'Awaiting Balance'});
  selected.mintAsset=async()=>({status:'error',code:'insufficient-funds',message:'Insufficient eligible funds.'});
  const target=await prepareMintDestination('player',selected,()=>true,()=>{});
  assert.equal((await target.mint(request)).code,'insufficient-funds');
  assert.equal(selected.calls.length,0);
});

test('production collection and Admin use the same mint method despite false or unavailable Admin balance',async()=>{
 for(const unavailable of [false,true]) {
  const selected=wallet('player');let checks=0;
  selected.getState=()=>({profileId:'player',hasProfile:true,phase:'active'});
  selected.listAssets=async()=>({status:'success',profileId:'player',assets:[]});
  selected.showToast=()=>{};
  selected.getMintAvailability=async()=>{checks++;if(unavailable)throw Error('Balance unavailable');return {canMint:false,reason:'Awaiting Balance'};};
  selected.mintAsset=async r=>{selected.calls.push(r);return {status:'minted',profileId:'player',operationId:r.operationId,asset:{assetId:'asset',quantity:'1',name:r.name,ticker:r.ticker,decimals:r.decimals}};};
  const collection=createBisAssetCollection(selected,{asset:request,successMessage:'Collected'});
  await collection.refresh();await collection.collect();
  assert.equal(collection.getState().status,'owned');
  const target=await prepareMintDestination('player',selected,()=>true,()=>{});
  assert.equal((await target.mint(request)).status,'minted');
  assert.equal(selected.calls.length,2);assert.equal(checks,0);
  collection.dispose();
 }
});
test('pending recovery skips new-mint funding and preserves the operation',async()=>{
  const selected=wallet('game');
  selected.getPendingAssetMint=async()=>({status:'success',profileId:'game',request});
  selected.getMintAvailability=async()=>{throw Error('No new funding');};
  const target=await prepareMintDestination('game',selected,()=>true,()=>{});
  assert.deepEqual(target.request,request);
  await target.mint(target.request);
  assert.deepEqual(selected.calls,[request]);
});
test('unresolved Player Wallet delivery does not block a new Game Wallet mint',async()=>{
  const selected=gameWallet('game');
  selected.getPendingAssetDelivery=async()=>({status:'success',profileId:'game',request:{operationId:'old-delivery',assetId:'a'.repeat(68),quantity:'1',recipient:'tark1old-player'},mintRequest:{operationId:'old-mint',name:'old',ticker:'OLD',amount:'1',decimals:0}});
  const target=await prepareMintDestination('game',selected,()=>true,()=>{});
  assert.equal(target.request,null);
  const result=await target.mint(request);
  assert.equal(result.status,'minted');
  assert.equal(selected.calls.length,1);
});
test('wallet replacement during lookup rejects stale preparation',async()=>{
  const selected=wallet('player');let release;
  selected.getPendingAssetMint=()=>new Promise(resolve=>{release=resolve;});
  const preparing=prepareMintDestination('player',selected,()=>true,()=>{});
  selected.state.profileId='replacement';
  release({status:'success',profileId:'player',request:null});
  await assert.rejects(preparing,/changed/);
});
test('duplicate submissions and late results cannot affect a replacement wallet',async()=>{
  const selected=wallet('player');let release;let calls=0;const logs=[];
  selected.mintAsset=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
  const target=await prepareMintDestination('player',selected,()=>true,r=>logs.push(r));
  const first=target.mint(request);
  assert.equal((await target.mint(request)).code,'busy');
  selected.state.profileId='replacement';
  release({status:'minted'});
  assert.equal((await first).code,'account-changed');
  assert.equal((await target.mint(request)).code,'account-changed');
  assert.equal(calls,1);assert.equal(logs.length,1);
});
test('thrown submission remains unknown instead of permitting edited replay',async()=>{
  const selected=wallet('game');selected.mintAsset=async()=>{throw Error('Connection lost');};
  const target=await prepareMintDestination('game',selected,()=>true,()=>{});
  assert.equal((await target.mint(request)).code,'outcome-unknown');
});

for(const network of ['signet','mutinynet'])test(`${network}: completed mint resumes only its original pending delivery across dialog restart`,async()=>{
 const source=gameWallet('game'),recipient=wallet('player');
 source.getState=()=>({profileId:'game',network});recipient.getState=()=>({profileId:'player',network,addresses:{status:'ready',arkadeAddress:'tark1original'}});
 const delivery={operationId:`${request.operationId}-delivery`,assetId:'a'.repeat(68),quantity:'1',recipient:'tark1original'};
 let completed=false,mints=0,sends=0,checks=[];
 source.getPendingAssetDelivery=async()=>({status:'success',profileId:'game',request:completed?null:delivery,...(!completed?{mintRequest:request}:{})});
 source.mintAsset=async input=>{assert.deepEqual(input,request);return {status:'already-minted',profileId:'game',operationId:request.operationId,asset:{assetId:delivery.assetId,quantity:'1'}};};
 source.deliverAsset=async()=>{sends++;throw Error('must never replace saved delivery');};
 source.checkAssetDelivery=async id=>{checks.push(id);return completed?{status:'already-delivered',profileId:'game',...delivery,transactionId:'b'.repeat(64)}:{status:'error',code:'outcome-unknown',message:'Receipt not confirmed.'};};
 const first=await prepareMintDestination('player',source,recipient,()=>true,()=>{});
 assert.deepEqual(first.request,request);assert.equal((await first.mint(first.request)).code,'outcome-unknown');
 const restarted=await prepareMintDestination('player',source,recipient,()=>true,()=>{});
 assert.deepEqual(restarted.request,request);
 assert.equal((await restarted.mint({...request,operationId:'replacement'})).code,'outcome-unknown');
 completed=true;assert.equal((await restarted.mint(restarted.request)).status,'already-minted');
 assert.deepEqual(checks,[delivery.operationId,delivery.operationId]);assert.equal(mints,0);assert.equal(sends,0);
});

test('lost delivery acknowledgement in the same dialog checks the saved delivery instead of resending',async()=>{
 const source=gameWallet('game'),recipient=wallet('player');
 recipient.getState=()=>({profileId:'player',addresses:{status:'ready',arkadeAddress:'tark1original'}});
 let saved,issued=0,checks=0,minted=false;
 source.getPendingAssetDelivery=async()=>({status:'success',profileId:'game',request:saved??null,...(saved?{mintRequest:request}:{})});
 source.mintAsset=async input=>{if(!minted){issued++;minted=true;}assert.deepEqual(input,request);return {status:'already-minted',profileId:'game',operationId:input.operationId,asset:{assetId:'a'.repeat(68),quantity:'1'}};};
 source.deliverAsset=async input=>{assert.equal(saved,undefined);saved=input;throw Error('synthetic acknowledgement lost');};
 source.checkAssetDelivery=async id=>{checks++;assert.equal(id,`${request.operationId}-delivery`);return {status:'error',code:'outcome-unknown',message:'Original outcome unknown.'};};
 const target=await prepareMintDestination('player',source,recipient,()=>true,()=>{});
 assert.equal((await target.mint(request)).code,'outcome-unknown');
 assert.equal((await target.mint(request)).code,'outcome-unknown');
 assert.equal(issued,1);assert.equal(checks,1);assert.equal(saved.operationId,`${request.operationId}-delivery`);
});

test('delivery recovery rejects missing mint provenance, changed original ID, recipient and source identity',async()=>{
 const source=gameWallet('game'),recipient=wallet('player');
 recipient.getState=()=>({profileId:'player',addresses:{status:'ready',arkadeAddress:'tark1original'}});
 const delivery={operationId:`${request.operationId}-delivery`,assetId:'a'.repeat(68),quantity:'1',recipient:'tark1original'};
 for(const change of [{mintRequest:undefined},{request:{...delivery,operationId:'replacement-delivery'}},{request:{...delivery,recipient:'tark1other'}},{profileId:'other'}]) {
  source.getPendingAssetDelivery=async()=>({status:'success',profileId:'game',request:delivery,mintRequest:request,...change});
  await assert.rejects(prepareMintDestination('player',source,recipient,()=>true,()=>{}),/recovery|changed/);
 }
 assert.equal(source.calls.length,0);assert.equal(source.deliveries.length,0);
});

test('unavailable delivery checker preserves original unknown outcome without another delivery',async()=>{
 const source=gameWallet('game'),recipient=wallet('player');
 recipient.getState=()=>({profileId:'player',addresses:{status:'ready',arkadeAddress:'tark1original'}});
 const delivery={operationId:`${request.operationId}-delivery`,assetId:'a'.repeat(68),quantity:'1',recipient:'tark1original'};
 source.getPendingAssetDelivery=async()=>({status:'success',profileId:'game',request:delivery,mintRequest:request});
 source.mintAsset=async()=>({status:'already-minted',profileId:'game',operationId:request.operationId,asset:{assetId:delivery.assetId,quantity:'1'}});
 const target=await prepareMintDestination('player',source,recipient,()=>true,()=>{});
 assert.equal((await target.mint(target.request)).code,'outcome-unknown');assert.equal(source.deliveries.length,0);
});
