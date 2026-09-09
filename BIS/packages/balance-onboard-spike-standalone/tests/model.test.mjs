import {test} from 'node:test';
import assert from 'node:assert/strict';
import {half,canSubmit,verifiedReceipt,capturedFunding,fundingEligible} from '../src/model.js';
test('funding snapshot ignores later deposits, waits for confirmation and rejects disappeared or changed inputs',()=>{
 const inputs=[{txid:'first',vout:0,value:10001}];
 const coin={...inputs[0],status:{confirmed:false}};
 assert.equal(capturedFunding(inputs,[coin]).confirmed,0);
 const ready=capturedFunding(inputs,[{...coin,status:{confirmed:true}},{txid:'later',vout:0,value:99999,status:{confirmed:true}}]);
 assert.equal(ready.confirmed,1);assert.equal(half(ready.selected).target,5000);
 assert.throws(()=>capturedFunding(inputs,[]));assert.throws(()=>capturedFunding(inputs,[{...coin,value:20000}]));
});
test('half rounds down and rejects invalid funding',()=>{assert.deepEqual(half([{value:10001}]),{total:10001,target:5000});assert.throws(()=>half([{value:-1}]));});
test('only a fresh user click with confirmed funding can submit; legacy waiting is not authorization',()=>{for(const phase of ['waiting','submitting','registered','uncertain','success'])assert.equal(canSubmit({phase},true),false);assert.equal(canSubmit({phase:'idle'},false),false);assert.equal(canSubmit({phase:'idle'},true),true);});
test('onboarding unlocks only after all incoming outputs are confirmed and unexpired',()=>{
 assert.equal(fundingEligible([],()=>false),false);
 assert.equal(fundingEligible([{status:{confirmed:false}}],()=>false),false);
 assert.equal(fundingEligible([{status:{confirmed:true}}],()=>true),false);
 assert.equal(fundingEligible([{status:{confirmed:true}}],()=>false),true);
});
test('success requires confirmed input spend, exact Bitcoin change and linked receipt',()=>{
 const s={inputs:[{txid:'fund',vout:0}],target:5000,change:5000};
 const tx={txid:'commit',status:{confirmed:true},vin:[{txid:'fund',vout:0}],vout:[{scriptpubkey_address:'own',value:5000}]};
 const v=[{value:5000,commitmentTxIds:['commit']}];
 assert.equal(verifiedReceipt(s,[tx],v,'own'),'commit');
 assert.equal(verifiedReceipt(s,[{...tx,vout:[{scriptpubkey_address:'own',value:'5000'}]}],v,'own'),'commit');
 assert.equal(verifiedReceipt(s,[{...tx,vin:undefined}],v,'own'),undefined);
 assert.equal(verifiedReceipt(s,[{...tx,status:{confirmed:false}}],v,'own'),undefined);
 assert.equal(verifiedReceipt(s,[tx],[{value:5000,commitmentTxIds:['other']}],'own'),undefined);
 assert.equal(verifiedReceipt({...s,change:4999},[tx],v,'own'),undefined);
 assert.equal(verifiedReceipt({...s,inputs:[{txid:'other',vout:0}]},[tx],v,'own'),undefined);
});
