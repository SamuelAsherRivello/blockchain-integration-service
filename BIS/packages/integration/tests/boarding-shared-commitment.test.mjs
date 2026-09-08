import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedBoardingCommitment} from '../src/core/boarding-reconciliation.ts';
const commitment='c'.repeat(64);
const make=(id,txid,amount)=>({id,profileId:'wallet',status:'pending',inputs:[{txid,vout:0}],bitcoinAddress:'tb1-owner',quote:{direction:'to-bitcoin',amountSats:amount,netSats:amount,maxSats:5000}});
const a=make('a','a'.repeat(64),1000),b=make('b','b'.repeat(64),2000);
const consumed=[a,b].map(r=>({...r.inputs[0],isSpent:true,settledBy:commitment}));
const tx={txid:commitment,status:{confirmed:true},vout:[{scriptpubkey_address:'tb1-owner',value:3000}]};
const receipts=[4000,3000].map((value,vout)=>({txid:'e'.repeat(64),vout,value,commitmentTxIds:[commitment]}));
test('shared commitment attributes distinct inputs and complete receipts to both withdrawals',()=>{
 for(const r of [a,b])assert.equal(verifiedBoardingCommitment(r,[tx],receipts,consumed,[a,b]),commitment);
});
test('shared commitment never counts a receipt twice or ignores an absent input',()=>{
 assert.equal(verifiedBoardingCommitment(a,[tx],[receipts[0]],consumed,[a,b]),undefined);
 assert.equal(verifiedBoardingCommitment(a,[tx],receipts,[consumed[0]],[a,b]),undefined);
 assert.equal(verifiedBoardingCommitment(a,[tx],receipts,consumed,[a,{...b,inputs:a.inputs}]),undefined);
 assert.equal(verifiedBoardingCommitment(a,[tx],[receipts[0],{...receipts[1],vout:0}],consumed,[a,b]),undefined);
});
test('an unrelated wallet record cannot supply missing output attribution',()=>{
 assert.equal(verifiedBoardingCommitment(a,[tx],receipts,consumed,[a,{...b,profileId:'foreign'}]),undefined);
});
test('shared commitment preserves each asset inventory',()=>{
 const assetId='d'.repeat(68);
 const assetChange={script:'5120-owner',sats:4000,assets:[{assetId,amount:'2'}]};
 const owned=[{...receipts[0],script:assetChange.script,assets:[{assetId,amount:2n}]},receipts[1]];
 const first={...a,assetChange};
 assert.equal(verifiedBoardingCommitment(first,[tx],owned,consumed,[first,b]),commitment);
 assert.equal(verifiedBoardingCommitment(first,[tx],[{...owned[0],assets:[]},owned[1]],consumed,[first,b]),undefined);
});
test('shared boarding checks exact Bitcoin change and all deposit inputs',()=>{
 const records=[a,b].map(r=>({...r,quote:{...r.quote,direction:'to-arkade'}}));
 const transaction={...tx,vin:records.flatMap(r=>r.inputs),vout:[{scriptpubkey_address:'tb1-owner',value:7000}]};
 const outputs=[1000,2000].map((value,vout)=>({txid:'e'.repeat(64),vout,value,commitmentTxIds:[commitment]}));
 for(const r of records)assert.equal(verifiedBoardingCommitment(r,[transaction],outputs,[],records),commitment);
 assert.equal(verifiedBoardingCommitment(records[0],[{...transaction,vout:[{scriptpubkey_address:'tb1-owner',value:6999}]}],outputs,[],records),undefined);
});
