import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMintDestination} from '../src/admin/mint-destination.ts';
import {createBisAssetCollection} from '../../integration/src/core/asset-collection.ts';

const request = {operationId:'mint-one', name:'an asset', ticker:'ASSET', amount:'1', decimals:0};
function wallet(profileId) {
  const calls = [];
  const state = {profileId};
  return {calls, state, getState:()=>state, subscribe:()=>()=>{},
    getPendingAssetMint:async()=>({status:'success', profileId, request:null}),
    getMintAvailability:async()=>({canMint:true}),
    mintAsset:async r=>{calls.push(r);return {status:'minted', profileId, operationId:r.operationId, asset:{assetId:'asset-one',amount:'1'}};}};
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
