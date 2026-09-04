import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction,ArkAddress,Wallet,ReadonlyWallet,RestArkProvider,Extension,createAssetPacket} from '@arkade-os/sdk';
import {submitContinuation} from '../src/arkade/continuation.ts';
import {readContinuations} from '../src/core/continuation.ts';
const points=['79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'].map(h=>Uint8Array.from(Buffer.from(h,'hex')));
const own=new ArkAddress(points[0],points[0],'tark'),recipient=new ArkAddress(points[0],points[1],'tark');
const encoded=tx=>Buffer.from(tx.toPSBT()).toString('base64');
function fixture(t,{lose=false,affordable=true,current=true,storageFailure=false,withAssets=false,corruptAssets=false,missingAsset=false,wrongQuantity=false,coinValue}={}) {
 const memory=new Map();let reads=0,submits=0,disposed=0;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(storageFailure)throw Error('denied');memory.set(k,v);}}});
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({network:'signet'})}));
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},vtxoMinAmount:330n,vtxoMaxAmount:0n}));
 const coin={txid:'a'.repeat(64),vout:0,value:coinValue??(affordable?(withAssets?289715:2000):500),...(withAssets?{assets:[0,1,2].map(n=>({assetId:String(n+1).repeat(64)+'0000',amount:1n}))}:{})};
 const wallet={getSpendableVtxos:async()=>[coin],getBalance:async()=>({available:coin.value,total:coin.value,boarding:{total:0}}),getProviderConnectionState:()=>({mode:'online',source:'live'}),dustAmount:330n,dispose:async()=>{disposed++;}};
 t.mock.method(ReadonlyWallet,'create',async()=>{const destination=++reads<=2?recipient:own;return {...wallet,getAddress:async()=>destination.encode(),getBoardingAddress:async()=> 'tb1fixture'};});
 t.mock.method(RestArkProvider.prototype,'submitTx',async()=>{submits++;assert.equal(readContinuations('p')[0].status,'pending');assert.ok(readContinuations('p')[0].send.transactionId);if(lose)throw Error('response lost');return {};});
 t.mock.method(Wallet,'create',async options=>({...wallet,getAddress:async()=>own.encode(),send:async()=>{
   const anchor=Uint8Array.from([0x51,0x02,0x4e,0x73]);
   const cp=new Transaction({version:3});cp.addInput({txid:coin.txid,index:0,witnessUtxo:{script:own.pkScript,amount:BigInt(coin.value)}});cp.addOutput({script:own.pkScript,amount:BigInt(coin.value)});cp.addOutput({script:anchor,amount:0n});
   const tx=new Transaction({version:3});tx.addInput({txid:cp.id,index:0,witnessUtxo:{script:own.pkScript,amount:BigInt(coin.value)}});tx.addOutput({script:recipient.pkScript,amount:1000n});tx.addOutput({script:own.pkScript,amount:BigInt(coin.value-1000)});
   if(withAssets)tx.addOutput(Extension.create([createAssetPacket(new Map([[0,coin.assets]]),[{address:recipient.encode(),amount:1000,...(corruptAssets?{assets:coin.assets}:{})}],{address:own.encode(),amount:coin.value-1000,...(!corruptAssets?{assets:missingAsset?coin.assets.slice(1):wrongQuantity?coin.assets.map(a=>({...a,amount:2n})):coin.assets}:{})})]).txOut());
   tx.addOutput({script:anchor,amount:0n});
   await options.arkProvider.submitTx(encoded(tx),[encoded(cp)]);return tx.id;
 }}));
 const record={request:{operationId:'test',sats:1000,context:'run'},profileId:'p',status:'pending'};
 return {memory,submits:()=>submits,disposed:()=>disposed,run:()=>submitContinuation({profileId:'p',phrase:'abandon '.repeat(11)+'about'},record,new AbortController().signal,()=>current)};
}
test('generated recipient is never persisted as identity; exact 1000 sat payment persists before submit',async t=>{
 const f=fixture(t);const result=await f.run();assert.equal(result.status,'succeeded');assert.equal(result.mechanism,'sink-payment');assert.equal(result.sats,1000);assert.equal(result.feeSats,0);assert.equal(result.recipient,recipient.encode());assert.equal(f.submits(),1);assert.equal(f.memory.size,1);assert.ok(f.disposed()>=4);assert.doesNotMatch([...f.memory.values()].join(''),/phrase|mnemonic|abandon/);
});
test('lost response preserves a durable pending transaction',async t=>{const f=fixture(t,{lose:true});assert.equal((await f.run()).status,'pending');assert.equal(f.submits(),1);});
test('insufficient funds fails before network submission',async t=>{const f=fixture(t,{affordable:false});const r=await f.run();assert.equal(r.status,'failed');assert.match(r.message,/Insufficient eligible spendable funds: 500 sats available; 1,000 sats required/);assert.equal(f.submits(),0);});
test('account change before submission fails without spending',async t=>{const f=fixture(t,{current:false});assert.equal((await f.run()).status,'failed');assert.equal(f.submits(),0);});
test('storage failure prevents wallet creation and submission',async t=>{const f=fixture(t,{storageFailure:true});await assert.rejects(f.run());assert.equal(f.submits(),0);assert.equal(f.disposed(),0);});

test('B1 spends sats from the asset-bearing wallet output while preserving all three assets in change',async t=>{
 const f=fixture(t,{withAssets:true});const result=await f.run();assert.equal(result.status,'succeeded');assert.equal(f.submits(),1);
 const record=readContinuations('p')[0];assert.equal(record.send.change.sats,288715);assert.equal(record.send.change.assets.length,3);
});
test('B1 rejects prepared asset redirection to recipient before network submission',async t=>{
 const f=fixture(t,{withAssets:true,corruptAssets:true});assert.equal((await f.run()).status,'failed');assert.equal(f.submits(),0);
});

test('B1 rejects asset omission and changed quantities before submission',async t=>{
 for(const options of [{missingAsset:true},{wrongQuantity:true}])await t.test(JSON.stringify(options),async child=>{
  const f=fixture(child,{withAssets:true,...options});assert.equal((await f.run()).status,'failed');assert.equal(f.submits(),0);
 });
});
test('B1 keeps enough change to hold assets instead of spending the complete output',async t=>{
 const f=fixture(t,{withAssets:true,coinValue:1000});const result=await f.run();assert.equal(result.status,'failed');assert.match(result.message,/preserve your assets/);assert.equal(f.submits(),0);
});
