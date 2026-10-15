import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeAllPlayerAssets} from '../../src/client/admin-layer/player-asset-upgrade.ts';

const data=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
const old='a'.repeat(68),newAsset='b'.repeat(68);
test('explicit batch delivers replacement before each old player holding is burned',async()=>{
  data.clear();const calls:string[]=[];
  const player={getState:()=>({profileId:'player',network:'signet',addresses:{status:'ready',arkadeAddress:'tark1player'}}),subscribe:()=>()=>{},getPendingAssetMint:async()=>({status:'success' as const,profileId:'player',request:null}),getPendingAssetDelivery:async()=>({status:'success' as const,profileId:'player',request:null}),getPaymentRecipient:async()=>({profileId:'player',address:'tark1player'}),mintAsset:async()=>({status:'error' as const}),listAssets:async()=>({status:'success' as const,profileId:'player',assets:[{assetId:old,quantity:'1',metadata:{bisSchemaVersion:'1',bisGameId:'game',bisAssetType:'item',bisCatalogId:'catalog'}}]}),burnAsset:async()=>{calls.push('burn');return {status:'burned' as const};}};
  const game={...player,getState:()=>({profileId:'game',network:'signet'}),getPendingAssetMint:async()=>({status:'success' as const,profileId:'game',request:null}),getPendingAssetDelivery:async()=>({status:'success' as const,profileId:'game',request:null}),mintAsset:async request=>{calls.push('mint');return {status:'minted' as const,profileId:'game',operationId:request.operationId,asset:{assetId:newAsset,quantity:'1'}};},deliverAsset:async()=>{calls.push('deliver');return {status:'delivered' as const,profileId:'game',operationId:'delivery',assetId:newAsset,quantity:'1',recipient:'tark1player',transactionId:'c'.repeat(64)};}};
  const result=await upgradeAllPlayerAssets({game,player,targetVersion:'0.0.2',migrator:()=>({name:'new',ticker:'NEW',amount:'1',decimals:0,metadata:{bisAssetFormatVersion:'0.0.2'}}),isCurrent:()=>true});
  assert.deepEqual(calls,['mint','deliver','burn']);assert.equal(result[0]?.status,'completed');
});
test('a failed item does not prevent an independent later holding from upgrading',async()=>{
  data.clear();const first='d'.repeat(68),second='e'.repeat(68),replacement='f'.repeat(68);let mintCount=0,burnCount=0;
  const player={getState:()=>({profileId:'player',network:'signet',addresses:{status:'ready',arkadeAddress:'tark1player'}}),subscribe:()=>()=>{},getPendingAssetMint:async()=>({status:'success' as const,profileId:'player',request:null}),getPendingAssetDelivery:async()=>({status:'success' as const,profileId:'player',request:null}),getPaymentRecipient:async()=>({profileId:'player',address:'tark1player'}),mintAsset:async()=>({status:'error' as const}),listAssets:async()=>({status:'success' as const,profileId:'player',assets:[first,second].map(assetId=>({assetId,quantity:'1',metadata:{bisSchemaVersion:'1',bisGameId:'game',bisAssetType:'item',bisCatalogId:assetId}}))}),burnAsset:async()=>{burnCount++;return {status:'burned' as const};}};
  const game={...player,getState:()=>({profileId:'game',network:'signet'}),getPendingAssetMint:async()=>({status:'success' as const,profileId:'game',request:null}),getPendingAssetDelivery:async()=>({status:'success' as const,profileId:'game',request:null}),mintAsset:async request=>++mintCount===1?{status:'error' as const,code:'unavailable',message:'temporary'}:{status:'minted' as const,profileId:'game',operationId:request.operationId,asset:{assetId:replacement,quantity:'1'}},deliverAsset:async()=>({status:'delivered' as const,profileId:'game',operationId:'delivery',assetId:replacement,quantity:'1',recipient:'tark1player',transactionId:'c'.repeat(64)})};
  const result=await upgradeAllPlayerAssets({game,player,targetVersion:'0.0.2',migrator:()=>({name:'new',ticker:'NEW',amount:'1',decimals:0,metadata:{bisAssetFormatVersion:'0.0.2'}}),isCurrent:()=>true});
  assert.deepEqual(result.map(item=>item.status),['pending','completed']);assert.equal(burnCount,1);
});
test('unavailable player or game scope cannot start an upgrade mutation',async()=>{
  let calls=0;
  const unavailable={getState:()=>({}),subscribe:()=>()=>{},getPendingAssetMint:async()=>{calls++;return {status:'success' as const,profileId:'x',request:null};},listAssets:async()=>{calls++;return {status:'success' as const,profileId:'x',assets:[]};},burnAsset:async()=>{calls++;return {status:'burned' as const};},mintAsset:async()=>{calls++;return {status:'error' as const}}};
  await assert.rejects(upgradeAllPlayerAssets({game:unavailable,player:unavailable,targetVersion:'0.0.2',migrator:()=>({name:'new',ticker:'NEW',amount:'1',decimals:0,metadata:{bisAssetFormatVersion:'0.0.2'}}),isCurrent:()=>true}));
  assert.equal(calls,0);
});
