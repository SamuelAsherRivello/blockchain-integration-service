import test from 'node:test';
import assert from 'node:assert/strict';
import {assetBaseUnits,validateMint,checkMintRecord,writeAssetRecord,readAssetRecords} from '../src/core/assets.ts';
import {readFreshAssets} from '../src/arkade/assets.ts';
import {createContext} from '../src/core/context.ts';
const request={operationId:'op-1',name:'An asset',ticker:'AST',amount:'1',decimals:0};
const records=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(_name,_options,fn)=>fn({})}});
test('exact quantities and validation reject lossy or unsupported input',()=>{
  assert.equal(assetBaseUnits('1.000000000000000001',18),1000000000000000001n);
  assert.equal(assetBaseUnits('18446744073709551615',0),18446744073709551615n);
  for(const [amount,decimals] of [['0',0],['-1',0],['1e2',0],['1.1',0],['18446744073709551616',0],['1',19]]) assert.throws(()=>assetBaseUnits(amount,decimals));
  for(const patch of [{name:''},{ticker:' '},{iconUrl:'javascript:alert(1)'},{iconUrl:'https://user:pass@example.com'},{controlAssetId:'x'}])assert.throws(()=>validateMint({...request,...patch}));
  assert.equal(validateMint({...request,iconUrl:'https://example.com/icon.png'}).iconUrl,'https://example.com/icon.png');
});
test('operation IDs bind requests, block unknown mints, allow deliberate same-name mint',()=>{
  records.clear();writeAssetRecord('p',{request,status:'pending'});
  assert.equal(checkMintRecord('p',request).status,'pending');
  assert.throws(()=>checkMintRecord('p',{...request,amount:'2'}),{code:'invalid-input'});
  assert.throws(()=>checkMintRecord('p',{...request,operationId:'op-2'}),{code:'outcome-unknown'});
  writeAssetRecord('p',{request,status:'succeeded',asset:{assetId:'asset-1',quantity:'1'}});
  assert.equal(checkMintRecord('p',{...request,operationId:'op-2'}),undefined);
  assert.equal(readAssetRecords('p').length,1);
  assert.equal(checkMintRecord('other',request),undefined);
});
test('corrupt and unavailable storage fail closed',()=>{
  records.set('bis-signet-mints-v1:bad','broken');assert.throws(()=>readAssetRecords('bad'),{code:'outcome-unknown'});
  const original=localStorage.setItem;localStorage.setItem=()=>{throw Error('private');};
  try {assert.throws(()=>writeAssetRecord('p2',{request,status:'pending'}),{code:'unavailable'});}finally{localStorage.setItem=original;}
});
test('listing includes non-BIS and metadata-free assets with exact bigint quantities',async()=>{
  const wallet={getBalance:async()=>({assets:[{assetId:'b',amount:9007199254740993n},{assetId:'a',amount:1n},{assetId:'zero',amount:0n}]}),getProviderConnectionState:()=>({mode:'online',source:'live'}),assetManager:{getAssetDetails:async id=>({assetId:id,metadata:id==='b'?{name:'Other token',icon:'https://example.com/icon'}:undefined})}};
  const result=await readFreshAssets(wallet);assert.equal(result.length,2);assert.equal(result[0].asset.assetId,'a');assert.equal(result[1].asset.quantity,'9007199254740993');assert.doesNotThrow(()=>JSON.stringify(result));
  wallet.assetManager.getAssetDetails=async()=>{throw Error('private');};await assert.rejects(readFreshAssets(wallet));
  wallet.getProviderConnectionState=()=>({mode:'offline',source:'cache'});await assert.rejects(readFreshAssets(wallet),{code:'unavailable'});
  wallet.getProviderConnectionState=()=>({mode:'online',source:'live'});wallet.getBalance=async()=>({assets:[]});assert.deepEqual(await readFreshAssets(wallet),[]);
});
function setup(account={phrase:'test-only',profileId:'profile-a'}, assets={list:async()=>[],mint:async(_a,r)=>({status:'minted',profileId:'profile-a',operationId:r.operationId,asset:{assetId:'a',quantity:'1'}})}){
 let generation=0;const listeners=new Set();
 const storage={load:async()=>({account,generation}),save:async()=>{},reset:async()=>{},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}};
 const context=createContext(storage,undefined,async()=>account?.profileId,undefined,undefined,undefined,undefined,undefined,undefined,assets);
 return {context,replace(){account={phrase:'test-only',profileId:'profile-b'};generation++;for(const l of listeners)l();}};
}
test('headless APIs leave UI state unchanged and sanitize failures',async()=>{
 const {context}=setup();await context.ready();const before=context.getState();assert.equal((await context.listAssets()).status,'success');assert.equal((await context.mintAsset(request)).status,'minted');assert.equal(context.getState(),before);context.dispose();assert.equal((await context.listAssets()).code,'disposed');
 const {context:empty}=setup(null);await empty.ready();assert.equal((await empty.mintAsset(request)).code,'account-required');assert.equal((await empty.listAssets()).code,'account-required');empty.dispose();
 const {context:bad}=setup(undefined,{list:async()=>{throw Error('secret source error');},mint:async()=>{throw Error('secret source error');}});await bad.ready();assert.equal((await bad.listAssets()).code,'unavailable');assert.ok(!JSON.stringify(await bad.mintAsset(request)).includes('secret'));bad.dispose();
});
test('account change suppresses late asset response',async()=>{
 let resolve;const p=new Promise(r=>resolve=r);const s=setup(undefined,{list:()=>p,mint:async()=>{throw Error();}});await s.context.ready();const work=s.context.listAssets();await new Promise(r=>setImmediate(r));s.replace();resolve([{assetId:'a',quantity:'1'}]);assert.equal((await work).code,'account-changed');s.context.dispose();
});
test('lack of locks refuses mint',async()=>{
 const lock=navigator.locks;Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
 try{const {context}=setup();await context.ready();assert.equal((await context.mintAsset(request)).code,'unsupported-environment');context.dispose();}finally{Object.defineProperty(navigator,'locks',{configurable:true,value:lock});}
});
