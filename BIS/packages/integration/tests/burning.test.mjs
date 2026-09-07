import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetManager,ArkAddress,Extension,Wallet,MnemonicIdentity,RestArkProvider} from '@arkade-os/sdk';
import {burnWalletAsset} from '../src/arkade/assets.ts';
import {readBurnRecord,assertNoPendingBurn,validateBurn} from '../src/core/burning.ts';
import {pendingLogoutOperations} from '../src/core/logout-cleanup.ts';
import {createContext} from '../src/core/context.ts';
const assetId='a'.repeat(64)+'0000',otherId='b'.repeat(64)+'0000',txid='c'.repeat(64);
const request={operationId:'burn-1',assetId,quantity:'9007199254740993'};
const account={phrase:'fixture-no-secret',profileId:'burn-test'};
function fixture(t) {
  const memory=new Map();
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const state={submits:0,fail:false,storageFail:false,current:true,amount:BigInt(request.quantity),packets:[],calls:0};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(state.storageFail)throw Error('denied');memory.set(k,v);}}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');});
  t.mock.method(globalThis,'fetch',async()=>{throw Error('unexpected network');});
  t.mock.method(MnemonicIdentity,'fromMnemonic',()=>({}));
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet'}));
  t.mock.method(RestArkProvider.prototype,'submitTx',async()=>{
    assert.equal(readBurnRecord(account.profileId,request.operationId)?.status,'pending');state.submits++;
    if(state.submitGate)await state.submitGate;
    if(state.fail)throw Error('private lost response');return{arkTxid:txid};
  });
  const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
  const address=new ArkAddress(point,point,'tark').encode();
  t.mock.method(Wallet,'create',async options=>{
    state.calls++;assert.equal(options.settlementConfig,false);await options.arkProvider.getInfo();
    const wallet={...options,dustAmount:330n,getBalance:async()=>({assets:[{assetId,amount:state.amount}]}),getProviderConnectionState:()=>({mode:'online',source:'live'}),getAddress:async()=>address,
      getSpendableVtxos:async()=>[{txid:'d'.repeat(64),vout:0,value:1000,assets:[{assetId,amount:state.amount},{assetId:otherId,amount:7n}]}],dispose:async()=>{},
      buildAndSubmitOffchainTx:async(inputs,outputs)=>{state.packets.push(Extension.fromBytes(outputs.find(output=>Extension.isExtension(output.script)).script).getAssetPacket());const result=await options.arkProvider.submitTx('fixture',[]);return result;},
    };
    wallet.assetManager=new AssetManager(wallet);wallet.assetManager.getAssetDetails=async id=>({assetId:id});return wallet;
  });
  return {state,memory,burn:(signal=new AbortController().signal)=>burnWalletAsset(account,request,signal,()=>state.current)};
}
test('SDK burn preserves other asset outputs and exact amount; completed retries do not submit',async t=>{
  const f=fixture(t);assert.equal((await f.burn()).transactionId,txid);assert.equal(f.state.submits,1);
  const groups=f.state.packets[0].groups;
  assert.equal(groups.length,2);assert.equal(groups[0].outputs.length,0);assert.equal(groups[0].inputs[0].amount,BigInt(request.quantity));assert.equal(groups[1].outputs[0].amount,7n);
  assert.equal((await f.burn()).status,'burned');assert.equal(f.state.submits,1);assert.equal(pendingLogoutOperations().count,0);
});
test('changed holding, missing storage and account change prevent submission',async t=>{
  const f=fixture(t);f.state.amount=1n;await assert.rejects(f.burn(),{code:'invalid-input'});assert.equal(f.state.submits,0);
  f.state.amount=BigInt(request.quantity);f.state.storageFail=true;await assert.rejects(f.burn(),{code:'unavailable'});assert.equal(f.state.submits,0);
  f.state.storageFail=false;f.state.current=false;await assert.rejects(f.burn(),{code:'account-changed'});assert.equal(f.state.submits,0);
});
test('lost response stays pending, blocks other spends and is counted for logout',async t=>{
  const f=fixture(t);f.state.fail=true;await assert.rejects(f.burn(),{code:'outcome-unknown'});assert.equal(f.state.submits,1);
  await assert.rejects(f.burn(),{code:'outcome-unknown'});assert.equal(f.state.submits,1);assert.throws(()=>assertNoPendingBurn(account.profileId),{code:'outcome-unknown'});assert.equal(pendingLogoutOperations().count,1);
});
test('request validation rejects malformed or inexact quantities',()=>{
  for(const quantity of [1,'0','-1','1.2','1e3','18446744073709551616'])assert.throws(()=>validateBurn({...request,quantity}),{code:'invalid-input'});
  assert.throws(()=>validateBurn({...request,operationId:undefined}),{code:'invalid-input'});
});
test('abort after submission retains uncertain journal despite a late SDK response',async t=>{
  const f=fixture(t),controller=new AbortController();let release;
  f.state.submitGate=new Promise(resolve=>{release=resolve;});const work=f.burn(controller.signal);
  while(!f.state.submits)await new Promise(setImmediate);
  controller.abort();await assert.rejects(work,{code:'outcome-unknown'});release();await new Promise(setImmediate);
  assert.equal(readBurnRecord(account.profileId,request.operationId)?.status,'pending');
  await assert.rejects(f.burn(),{code:'outcome-unknown'});assert.equal(f.state.submits,1);
});
test('public burn uses shared wallet lock and sanitizes failures',async t=>{
  fixture(t);let calls=0,finish;const names=[],held=new Set();
  const original=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name,options,fn)=>{
    names.push(name);if(held.has(name)&&options.ifAvailable)return fn(null);
    held.add(name);try{return await fn({});}finally{held.delete(name);}
  }}});
  t.after(()=>{if(original)Object.defineProperty(navigator,'locks',original);else Reflect.deleteProperty(navigator,'locks');});
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,async()=>{
    calls++;await new Promise(resolve=>{finish=resolve;});throw Error('private provider failure');
  });
  t.after(()=>c.dispose());await c.ready();
  const first=c.burnAsset(request);while(!finish)await new Promise(setImmediate);
  const duplicate=await c.burnAsset(request);assert.equal(duplicate.status,'error');assert.equal(calls,1);
  finish();const result=await first;assert.equal(result.code,'unavailable');assert.ok(!result.message.includes('private'));
  assert.ok(names.includes(`bis-signet-wallet-mutation:${account.profileId}`));
});
