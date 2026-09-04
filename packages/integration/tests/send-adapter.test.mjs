import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction,ArkAddress,Wallet,ReadonlyWallet,RestArkProvider} from '@arkade-os/sdk';
import {inspectSendTransaction,sendRecipient,quoteSend,submitSend} from '../src/arkade/sending.ts';
import {readSendRecord} from '../src/core/sending.ts';
const bytes=n=>new Uint8Array(32).fill(n);
const publicPoints=['79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'];
const script=n=>Uint8Array.from(Buffer.from('5120'+publicPoints[n%2],'hex'));
const hex=b=>Buffer.from(b).toString('hex'),encoded=tx=>Buffer.from(tx.toPSBT()).toString('base64');
function fixture(){
 const coin={txid:'a'.repeat(64),vout:0,value:1000};const cp=new Transaction({version:3});cp.addInput({txid:coin.txid,index:0,witnessUtxo:{script:script(1),amount:1000n}});cp.addOutput({script:script(2),amount:1000n});cp.addOutput({script:Uint8Array.from([0x51,0x02,0x4e,0x73]),amount:0n});
 const tx=new Transaction({version:3});tx.addInput({txid:cp.id,index:0,witnessUtxo:{script:script(2),amount:1000n}});tx.addOutput({script:script(3),amount:500n});tx.addOutput({script:script(4),amount:500n});tx.addOutput({script:Uint8Array.from([0x51,0x02,0x4e,0x73]),amount:0n});
 const quote={id:'q',profileId:'p',recipient:'tark1test',amountSats:500,feeSats:0,totalSats:500,maxSats:1000,expiresAt:Date.now()+1000,fingerprint:'b'.repeat(64)};
 return {tx,cp,coin,quote,check:(t=tx,q=quote,c=coin)=>inspectSendTransaction(encoded(t),[encoded(cp)],q,[c],hex(script(3)),hex(script(4)))};
}
test('submission boundary verifies recipient, owned change and checkpoint-linked inputs',()=>{const f=fixture();assert.equal(f.check(),f.tx.id);assert.throws(()=>f.check(f.tx,{...f.quote,amountSats:501}));assert.throws(()=>f.check(f.tx,f.quote,{...f.coin,txid:'b'.repeat(64)}));});
test('submission rejects extra outputs and inconsistent totals',()=>{const f=fixture();f.tx.addOutput({script:script(5),amount:1n});assert.throws(()=>f.check());const g=fixture();assert.throws(()=>g.check(g.tx,{...g.quote,feeSats:1}));});
test('address validation rejects self, foreign operator, mainnet, malformed and invoice',()=>{
 const own=new ArkAddress(bytes(1),bytes(2),'tark').encode(),recipient=new ArkAddress(bytes(1),bytes(3),'tark').encode();assert.equal(sendRecipient(' '+recipient+' ',own).encode(),recipient);
 for(const invalid of [own,new ArkAddress(bytes(2),bytes(3),'tark').encode(),new ArkAddress(bytes(1),bytes(3),'ark').encode(),'tb1test','lnbctest','junk'])assert.throws(()=>sendRecipient(invalid,own));
});
test('adapter persists before network, preserves a lost response, and blocks late submission',async t=>{
 const f=fixture(),values=new Map();let network=0,fail=false,allowed=true;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}}});
 const publicKey=Uint8Array.from(Buffer.from(publicPoints[0],'hex'));
 const own=new ArkAddress(publicKey,publicKey,'tark').encode(),recipient=new ArkAddress(publicKey,Uint8Array.from(Buffer.from(publicPoints[1],'hex')),'tark').encode();
 const info={network:'signet',fees:{txFeeRate:'0',intentFee:{}},vtxoMinAmount:1n,vtxoMaxAmount:0n};
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
 t.mock.method(RestArkProvider.prototype,'submitTx',async()=>{network++;assert.equal(readSendRecord('p').transactionId,f.tx.id);throw Error('response lost');});
 const wallet={getAddress:async()=>own,getSpendableVtxos:async()=>[f.coin],getBalance:async()=>({available:1000,total:1000,boarding:{total:0}}),getProviderConnectionState:()=>({mode:'online',source:'live'}),dustAmount:330n,dispose:async()=>{}};
 t.mock.method(ReadonlyWallet,'create',async()=>wallet);
 t.mock.method(Wallet,'create',async options=>{assert.equal(options.settlementConfig,false);return {...wallet,send:async()=>{await options.arkProvider.submitTx(encoded(f.tx),[encoded(f.cp)]);return f.tx.id;}};});
 // Published BIP39 test vector; never a user account or funded identity.
 const account={profileId:'p',phrase:'abandon '.repeat(11)+'about'};
 const q=await quoteSend(account,recipient,500,new AbortController().signal);
 fail=true;await assert.rejects(submitSend(account,q,()=>allowed));assert.equal(network,0);
 fail=false;allowed=false;await assert.rejects(submitSend(account,q,()=>allowed));assert.equal(network,0);
 allowed=true;const pending=await submitSend(account,q,()=>allowed);assert.equal(pending.status,'pending');assert.equal(network,1);assert.equal(readSendRecord('p').status,'pending');
});
