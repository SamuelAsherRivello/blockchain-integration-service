import test from 'node:test';
import assert from 'node:assert/strict';
import { createBisAssetCollection } from '../src/core/asset-collection.ts';

const asset = {name:'Achievement: Level 1',ticker:'LVL1',amount:'1',decimals:0,iconUrl:'https://example.com/v2.png'};
const holding = {...asset,assetId:'asset-1',quantity:'1',iconUrl:'https://example.com/v1.png'};
function fixture(options = {}) {
  let state={hasProfile:true,phase:'active',profileId:'p'}, holdings=[],pending=null,result,readFailure=false,release;
  const listeners=new Set(),calls=[],toasts=[];
  const context={ready:async()=>{},getState:()=>state,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);},showToast:(...args)=>toasts.push(args),
    listAssets:async()=>{if(readFailure)throw Error();return {status:'success',profileId:state.profileId,assets:holdings};},
    getPendingAssetMint:async()=>({status:'success',profileId:state.profileId,request:pending}),
    mintAsset:async r=>{calls.push(r);if(result==='wait')await new Promise(resolve=>release=resolve);if(result==='throw')throw Error();return result && result!=='wait'?result:{status:'minted',profileId:'p',operationId:r.operationId,asset:holding};}};
  const controller=createBisAssetCollection(context,{asset,successMessage:'Level 1 Trophy collected!',...options});
  return {controller,calls,toasts,listeners,context,setHoldings:v=>holdings=v,setPending:v=>pending=v,setResult:v=>result=v,failRead:()=>readFailure=true,release:()=>release(),replace:s=>{state=s;for(const l of listeners)l();}};
}
test('guests and existing Admin trophies cannot mint; icon version does not matter',async()=>{
  const f=fixture();f.setHoldings([holding]);await f.controller.refresh();assert.equal(f.controller.getState().status,'owned');await f.controller.collect();assert.equal(f.calls.length,0);
  f.replace({hasProfile:false,phase:'idle'});await f.controller.refresh();assert.equal(f.controller.getState().status,'guest');f.controller.dispose();
});
test('fresh ownership permits recollection and preflight catches a newly acquired trophy',async()=>{
  const f=fixture();f.setHoldings([holding]);await f.controller.refresh();f.setHoldings([]);await f.controller.refresh();assert.equal(f.controller.getState().canCollect,true);
  f.setHoldings([holding]);await f.controller.collect();assert.equal(f.calls.length,0);assert.equal(f.controller.getState().status,'owned');f.controller.dispose();
});
test('successful mint delivers one image toast, duplicate clicks are suppressed',async()=>{
  const f=fixture();await f.controller.refresh();f.setResult('wait');const first=f.controller.collect();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.controller.getState().busy,true);
  await f.controller.collect();f.release();await first;assert.equal(f.calls.length,1);assert.equal(f.controller.getState().status,'owned');assert.deepEqual(f.toasts,[['Level 1 Trophy collected!',{imageUrl:holding.iconUrl,messageType:'success'}]]);f.controller.dispose();
});
test('pending same trophy reconciles exact request and unrelated pending blocks collection',async()=>{
  const f=fixture();const prior={...asset,operationId:'original',iconUrl:'https://example.com/old.png'};f.setPending(prior);await f.controller.refresh();assert.equal(f.controller.getState().status,'uncertain');await f.controller.check();assert.deepEqual(f.calls,[prior]);f.controller.dispose();
  const g=fixture();g.setPending({...prior,ticker:'OTHER'});await g.controller.refresh();assert.equal(g.controller.getState().status,'blocked');await g.controller.check();assert.equal(g.calls.length,0);g.controller.dispose();
});
test('uncertain result retains operation ID; reconciliation never invents another',async()=>{
  const f=fixture();await f.controller.refresh();f.setResult({status:'error',code:'outcome-unknown',message:'Pending'});await f.controller.collect();const id=f.calls[0].operationId;
  assert.equal(f.controller.getState().status,'uncertain');f.setResult(undefined);await f.controller.check();assert.equal(f.calls[1].operationId,id);assert.equal(f.toasts.length,1);f.controller.dispose();
});
test('read failure cannot enable mint; definitive rejection requires acknowledgment',async()=>{
  const f=fixture();f.failRead();await f.controller.refresh();assert.equal(f.controller.getState().canCollect,false);assert.equal(f.calls.length,0);f.controller.dispose();
  const g=fixture();await g.controller.refresh();g.setResult({status:'error',code:'insufficient-funds',message:'Insufficient funds'});await g.controller.collect();assert.equal(g.controller.getState().needsAcknowledgment,true);assert.equal(g.toasts.length,0);await g.controller.acknowledge();assert.equal(g.controller.getState().canCollect,true);g.controller.dispose();
});
test('account change or disposal suppresses a late success',async()=>{
  for(const end of ['replace','dispose']){const f=fixture();await f.controller.refresh();f.setResult('wait');const work=f.controller.collect();await new Promise(r=>setTimeout(r,0));
    if(end==='replace')f.replace({hasProfile:true,phase:'active',profileId:'other'});else f.controller.dispose();f.release();await work;assert.equal(f.toasts.length,0);f.controller.dispose();assert.equal(f.listeners.size,0);}
});
test('timeout restores navigation but retains uncertainty and ignores late completion',async()=>{
  const f=fixture({timeoutMs:15});await f.controller.refresh();f.setResult('wait');await f.controller.collect();assert.equal(f.controller.getState().busy,false);assert.equal(f.controller.getState().status,'uncertain');f.release();await new Promise(r=>setTimeout(r,0));assert.equal(f.toasts.length,0);f.controller.dispose();
});
