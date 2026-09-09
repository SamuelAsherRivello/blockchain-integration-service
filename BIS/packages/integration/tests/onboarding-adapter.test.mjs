import test from 'node:test';import assert from 'node:assert/strict';
import {ArkAddress,CSVMultisigTapscript} from '@arkade-os/sdk';
import {createOnboardingAdapter,readOnboardingFacts} from '../src/arkade/onboarding.ts';
import {readOnboardingRecord,writeOnboardingRecord} from '../src/core/onboarding-record.ts';
import {scope,coin,receipt,finalReceipt,draft,storage} from './onboarding-fixture.mjs';
import {testLocks} from './locks-fixture.mjs';
function fixture(t){
 storage();Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
 const own=new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark'),script=Buffer.from(own.pkScript).toString('hex');
 const info={network:'signet',sessionDuration:60n,fees:{txFeeRate:'0',intentFee:{}},vtxoMinAmount:330n,utxoMinAmount:330n,vtxoMaxAmount:-1n,utxoMaxAmount:-1n};
 let coins=[{...coin,status:{confirmed:true,block_height:1}}],receipts=[],txs=[],consumed=[],registered=0,deletes=0,disposed=0,params;
 const provider={getInfo:async()=>info,registerIntent:async()=>{registered++;return 'intent';},deleteIntent:async()=>{deletes++;},getEventStream:async function*(){},confirmRegistration:async()=>{},submitTreeNonces:async()=>{},submitTreeSignatures:async()=>{},submitSignedForfeitTxs:async()=>{}};
 const wallet={dustAmount:330n,boardingTapscript:{exitScript:'00',pkScript:own.pkScript},getAddress:async()=>own.encode(),getBoardingAddress:async()=> 'tb1-fixture',getProviderConnectionState:()=>({mode:'online',source:'live'}),getBoardingUtxos:async()=>coins,getSpendableVtxos:async()=>receipts,indexerProvider:{getVtxos:async()=>({vtxos:consumed})},onchainProvider:{getChainTip:async()=>({height:2}),getTransactions:async()=>txs,getRawTransaction:async()=>{throw Error('unknown ancestry');}},dispose:async()=>{disposed++;},settle:async(p)=>{params=p;await provider.registerIntent({});return 'e'.repeat(64);}};
 const r=draft();r.plan.bitcoinScript=r.plan.arkadeScript=script;for(const leg of [r.boarding,r.returning])for(const o of leg.outputs)o.script=script;
 const adapter=createOnboardingAdapter({profileId:scope.profileId,phrase:'unused-test-placeholder'},()=>true,{provider:()=>provider,readonly:async()=>wallet,signing:async()=>wallet});
 const save=async change=>{const current=readOnboardingRecord(scope),next=change(current);return writeOnboardingRecord(scope,{...next,revision:current.revision+1},current.revision);};
 return {r,adapter,provider,wallet,info,save,script,get registered(){return registered;},get deletes(){return deletes;},get disposed(){return disposed;},get params(){return params;},set coins(v){coins=v;},set receipts(v){receipts=v;},set txs(v){txs=v;},set consumed(v){consumed=v;}};
}
test('adapter submits all frozen Bitcoin inputs with one Arkade output and prevents replay',async t=>{
 const f=fixture(t);writeOnboardingRecord(scope,f.r,0);await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);
 assert.equal(f.registered,1);assert.deepEqual(f.params.inputs.map(({txid,vout,value})=>({txid,vout,value})),[coin]);assert.equal(f.params.outputs.length,1);assert.equal(f.params.outputs[0].amount,12001n);assert.match(f.params.outputs[0].address,/^tark/);
 await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);assert.equal(f.registered,1);assert.equal(f.disposed,2);
});
test('lost registration acknowledgement is sanitized and never deletes or registers again',async t=>{
 const f=fixture(t);let attempts=0;f.provider.registerIntent=async()=>{attempts++;throw Error('PRIVATE_SENTINEL');};writeOnboardingRecord(scope,f.r,0);
 await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);let r=readOnboardingRecord(scope);assert.equal(r.boarding.phase,'submitting');assert.equal(r.progress.failure,'registration-unknown');assert.ok(r.progress.retryAt>Date.now());assert.ok(!JSON.stringify(r).includes('PRIVATE_SENTINEL'));
 await f.adapter.submit(r,'boarding',new AbortController().signal,f.save);assert.equal(attempts,1);assert.equal(f.deletes,0);
});
test('changed frozen inputs retire only an unsent draft; nonzero fees prevent mutation',async t=>{
 const f=fixture(t);writeOnboardingRecord(scope,f.r,0);f.coins=[];await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);assert.equal(readOnboardingRecord(scope).status,'not-submitted');assert.equal(f.registered,0);
});
test('policy revalidation stops signing before registration',async t=>{
 const f=fixture(t);writeOnboardingRecord(scope,f.r,0);f.info.fees.txFeeRate='1';await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);assert.equal(f.registered,0);assert.equal(readOnboardingRecord(scope).boarding.phase,'prepared');
});
test('first-leg receipt needs every frozen input, own script, exact amount and no assets',async t=>{
 const f=fixture(t),signal=new AbortController().signal;f.txs=[{txid:'e'.repeat(64),vin:[coin],vout:[],status:{confirmed:false}}];
 for(const wrong of [{...receipt,value:12000},{...receipt,script:'ffff'},{...receipt,assets:[{assetId:'asset',amount:1n}]}]){f.receipts=[{...receipt,script:f.script,commitmentTxIds:['e'.repeat(64)],...wrong}];assert.equal((await readOnboardingFacts(f.wallet,f.provider,scope,f.r,signal)).reconciled,undefined);}
 f.receipts=[{...receipt,script:f.script,commitmentTxIds:['e'.repeat(64)]}];const facts=await readOnboardingFacts(f.wallet,f.provider,scope,f.r,signal);assert.equal(facts.reconciled.boarding.phase,'receipt-verified');assert.equal(facts.reconciled.status,'pending');
});
test('final spendability completes before block confirmation only with exact consumed receipts and return',async t=>{
 const f=fixture(t);f.r.boarding={...f.r.boarding,phase:'receipt-verified',commitmentTxid:'e'.repeat(64),receipts:[receipt]};f.r.returning={...f.r.returning,phase:'registered',attemptId:'return',intentId:'intent',inputs:[receipt]};
 f.receipts=[{...finalReceipt,script:f.script,commitmentTxIds:['f'.repeat(64)]}];f.consumed=[{...receipt,isSpent:true,settledBy:'f'.repeat(64)}];f.txs=[{txid:'f'.repeat(64),vin:[],vout:[{scriptpubkey_address:'tb1-fixture',value:'6001'}],status:{confirmed:false}}];
 const facts=await readOnboardingFacts(f.wallet,f.provider,scope,f.r,new AbortController().signal);assert.equal(facts.reconciled.status,'complete');assert.equal(facts.transactions[0].confirmed,false);assert.equal(facts.transactions[0].kind,'return');assert.deepEqual(facts.independent.filter(c=>c.txid===finalReceipt.txid),[]);
 f.consumed=[{...receipt,isSpent:false,settledBy:'f'.repeat(64)}];assert.equal((await readOnboardingFacts(f.wallet,f.provider,scope,f.r,new AbortController().signal)).reconciled,undefined);
});
test('incoming confirmations are per transaction and no foreign outputs are shown',async t=>{
 const f=fixture(t);f.txs=[{txid:'1'.repeat(64),status:{confirmed:true},vout:[{scriptpubkey_address:'tb1-fixture',value:'1234'}]},{txid:'2'.repeat(64),status:{confirmed:false},vout:[{scriptpubkey_address:'tb1-fixture',value:'777'}]},{txid:'3'.repeat(64),status:{confirmed:true},vout:[{scriptpubkey_address:'foreign',value:'9999'}]}];
 const facts=await readOnboardingFacts(f.wallet,f.provider,scope,undefined,new AbortController().signal);assert.deepEqual(facts.transactions.map(t=>[t.confirmed,t.value]),[[true,1234],[false,777]]);assert.equal(facts.snapshot.policy.arkadeMaximum,0);
});
test('a delayed SDK disposal holds the signer lease and prevents another leg from opening',async t=>{
 const f=fixture(t);writeOnboardingRecord(scope,f.r,0);let release,disposing=false;const gate=new Promise(r=>release=r);f.wallet.dispose=async()=>{disposing=true;await gate;};
 const first=f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);
 for(let i=0;i<50&&!disposing;i++)await new Promise(r=>setTimeout(r,1));assert.ok(disposing);
 await f.save(r=>({...r,boarding:{...r.boarding,phase:'receipt-verified',receipts:[receipt]},returning:{...r.returning,phase:'prepared',attemptId:'return',inputs:[receipt]}}));
 await f.adapter.submit(readOnboardingRecord(scope),'returning',new AbortController().signal,f.save);assert.equal(f.registered,1);
 release();await first;
});
test('duplicate input rejection retains its category on the leg without allowing cancellation',async t=>{
 const f=fixture(t);f.provider.registerIntent=async()=>{throw Error('duplicated input with private operator payload');};writeOnboardingRecord(scope,f.r,0);await f.adapter.submit(f.r,'boarding',new AbortController().signal,f.save);
 const r=readOnboardingRecord(scope);assert.equal(r.boarding.failureCode,'duplicate-input');assert.equal(r.boarding.phase,'submitting');assert.equal(f.deletes,0);assert.ok(!JSON.stringify(r).includes('private operator'));
});
