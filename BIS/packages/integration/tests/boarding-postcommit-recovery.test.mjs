import test from 'node:test';
import assert from 'node:assert/strict';
import {bech32m} from '@scure/base';
import {ArkAddress,Batch,CSVMultisigTapscript,Intent,ReadonlyWallet,RestArkProvider,RestIndexerProvider,Wallet,networks} from '@arkade-os/sdk';
import {quoteBoarding,submitBoarding,reconcileBoarding} from '../src/arkade/boarding.ts';
import {readBoardingRecord,readBoardingRecords} from '../src/core/boarding-record.ts';
import {walletReservations} from '../src/core/wallet-reservations.ts';
import {testLocks} from './locks-fixture.mjs';

const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
const own=new ArkAddress(point,point,'tark');
const bitcoinPoint=Uint8Array.from(Buffer.from('c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5','hex'));
const bitcoinAddress=bech32m.encode('tb',[1,...bech32m.toWords(bitcoinPoint)]);
const account={profileId:'postcommit',phrase:'abandon '.repeat(11)+'about'};
const commitment='d'.repeat(64),assetId='a'.repeat(64)+'0000';
const asset={assetId,amount:9007199254740993n};
// This isolates the real SDK's processing after Batch.join returns a commitment.
// Handler/tree validation itself is covered in boarding-sdk-handler.test.mjs.
async function fixture(t,{shared=false,evidence='valid'}={}) {
 const data=new Map(),calls={register:0,delete:0,db:0,signingWallets:0};let disposed;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No live network in postcommit fixture');});
 const coins=[{txid:'b'.repeat(64),vout:0,value:4000,assets:[asset]},...(shared?[{txid:'c'.repeat(64),vout:0,value:2000}]:[])];
 const info={network:'signet',sessionDuration:60n,fees:{txFeeRate:'0',intentFee:{}},utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n};
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
 t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=>`11111111-1111-4111-8111-${String(++calls.register).padStart(12,'0')}`);
 t.mock.method(RestArkProvider.prototype,'deleteIntent',async()=>{calls.delete++;throw Error('Unexpected cancellation');});
 const sdkSnapshots=[];
 const wallet={dustAmount:330n,boardingTapscript:{exitScript:'00'},dispose:async()=>{},getAddress:async()=>own.encode(),getBoardingAddress:async()=>bitcoinAddress,getBoardingUtxos:async()=>[],getBalance:async()=>({available:6000,total:6000,boarding:{total:0}}),onchainProvider:{getChainTip:async()=>({height:1})},getProviderConnectionState:()=>({mode:'online',source:'live'}),getSpendableVtxos:async()=>coins};
 t.mock.method(ReadonlyWallet,'create',async()=>wallet);
 t.mock.method(Batch,'join',async()=>commitment);
 t.mock.method(Wallet,'create',async options=>{
  calls.signingWallets++;
  const facade={...wallet,network:networks.signet,arkProvider:options.arkProvider,
   logUngatedInputs:async()=>{},recipientAddressContext:()=>({hrp:'tark',signerSet:{active:Buffer.from(point).toString('hex'),deprecated:[]}}),
   identity:{signerSession:()=>({getPublicKey:async()=>point})},
   makeRegisterIntentSignature:async(inputs,outputs,onchainIndexes)=>({proof:Buffer.from(Intent.create({type:'register',onchain_output_indexes:onchainIndexes,valid_at:0,expire_at:0,cosigners_public_keys:[]},inputs.map(c=>({txid:c.txid,index:c.vout,witnessUtxo:{script:own.pkScript,amount:BigInt(c.value)}})),outputs).toPSBT()).toString('base64')}),
   makeDeleteIntentSignature:async()=>({proof:''}),
   persistIntentSnapshot:async(_id,state,_intent,_delete,_inputs,details)=>sdkSnapshots.push({state,...details}),
   getContractManager:async()=>({assertAnnotatable:async()=>{}}),_addPendingSpends:()=>{},_removePendingSpends:()=>{},
   safeRegisterIntent:intent=>options.arkProvider.registerIntent(intent),createBatchHandler:()=>({}),
   updateDbAfterSettle:async()=>{calls.db++;throw Error('controlled local repository failure');},
   dispose:async()=>disposed(),
  };
  facade.arkProvider.getEventStream=async function*(){yield {type:'unused controlled stream'};};
  return {...facade,settle:(params,callback)=>Wallet.prototype._settleImpl.call(facade,params,callback)};
 });
 for(let i=0;i<(shared?2:1);i++) {
  const finished=new Promise(resolve=>{disposed=resolve;});
  await submitBoarding(account,await quoteBoarding(account,1000,new AbortController().signal,'to-bitcoin'));
  await finished;
 }
 const originals=readBoardingRecords(account.profileId);
 assert.equal(calls.db,originals.length,`Actual SDK reaches its postcommit database update: ${JSON.stringify(sdkSnapshots)}`);
 assert.equal(sdkSnapshots.filter(s=>s.state==='batch_succeeded'&&s.commitmentTransactionId===commitment).length,originals.length);
 assert.equal(calls.delete,0,'SDK postcommit branch never cancels');
 for(const r of originals){assert.equal(r.status,'pending');assert.equal(r.commitmentTxid,undefined);assert.equal(r.progress.execution,'interrupted');}
 const receipts=originals.map((r,i)=>({txid:'e'.repeat(64),vout:i,value:r.quote.inputSats-1000,commitmentTxIds:[commitment],...(r.assetChange?{script:r.assetChange.script,assets:[evidence==='wrong-assets'?{...asset,amount:1n}:asset]}:{})}));
 const tx={txid:commitment,status:{confirmed:evidence!=='unconfirmed'},vout:[{scriptpubkey_address:bitcoinAddress,value:evidence==='wrong-bitcoin'?999:1000*originals.length}]};
 t.mock.method(ReadonlyWallet,'create',async()=>({dispose:async()=>{},getProviderConnectionState:()=>({mode:'online',source:'live'}),getVtxos:async()=>evidence==='missing-change'?[]:receipts,onchainProvider:{getTransactions:async()=>evidence==='absent'?[]:[tx]}}));
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:originals.flatMap(r=>r.inputs).map(c=>({...c,isSpent:true,settledBy:commitment}))}));
 const before={...calls};
 await reconcileBoarding(account,new AbortController().signal);
 assert.deepEqual(calls,before,'Reconciliation performs no signing, replay or cancellation');
 return {originals,records:readBoardingRecords(account.profileId)};
}
for(const shared of [false,true])test(`local SDK failure after ${shared?'shared':'single'} commitment resolves original operation from exact receipts`,async t=>{
 const {originals,records}=await fixture(t,{shared});
 assert.equal(records.length,shared?2:1);
 for(const [i,r] of records.entries()){
  assert.equal(r.status,'succeeded');assert.equal(r.commitmentTxid,commitment);
  assert.equal(r.id,originals[i].id);assert.equal(r.intentId,originals[i].intentId);
  assert.deepEqual(r.inputs,originals[i].inputs);assert.deepEqual(r.assetChange,originals[i].assetChange);
 }
 assert.equal(walletReservations(account.profileId).length,0);
});
for(const evidence of ['absent','wrong-bitcoin','wrong-assets','unconfirmed','missing-change'])test(`local SDK postcommit failure stays unresolved with ${evidence} receipt evidence`,async t=>{
 const {originals,records}=await fixture(t,{evidence});
 assert.deepEqual(records,originals);assert.equal(walletReservations(account.profileId).length,1);
 assert.equal(readBoardingRecord(account.profileId).status,'pending');
});
