import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { bech32m } from '@scure/base';
import { ArkAddress, ReadonlyWallet, RestArkProvider, CSVMultisigTapscript, Wallet, Intent, networks, Transaction, Extension, Batch } from '@arkade-os/sdk';
import { quoteBoarding, submitBoarding, inspectBoardingAssets } from '../src/arkade/boarding.ts';
import { verifiedBoardingCommitment } from '../src/core/boarding-reconciliation.ts';
import { writeBoardingRecord, readBoardingRecord } from '../src/core/boarding-record.ts';
import {transferStatus} from '../src/core/boarding-status.ts';

const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
const own=new ArkAddress(point,point,'tark');
const bitcoinAddress=bech32m.encode('tb',[1,...bech32m.toWords(Uint8Array.from(Buffer.from('c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5','hex')))]);
const account={profileId:'test',phrase:'abandon '.repeat(11)+'about'};
const assets=[{assetId:'a'.repeat(64)+'0000',amount:9007199254740993n}];
function fixture(t,{withAssets=true,value=280715}={}) {
 storage(t);
 const coin={txid:'b'.repeat(64),vout:0,value,...(withAssets?{assets}: {})};
 const info={network:'signet',sessionDuration:60n,fees:{txFeeRate:'0',intentFee:{}},utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n};
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
 t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
 const wallet={dustAmount:330n,boardingTapscript:{exitScript:'00'},dispose:async()=>{},getAddress:async()=>own.encode(),getBoardingAddress:async()=>bitcoinAddress,getBoardingUtxos:async()=>[],getBalance:async()=>({available:value,total:value,boarding:{total:0}}),onchainProvider:{getChainTip:async()=>({height:1})},getProviderConnectionState:()=>({mode:'online',source:'live'}),getSpendableVtxos:async options=>{assert.deepEqual(options,{withRecoverable:false,withUnrolled:false});return [coin];}};
 t.mock.method(ReadonlyWallet,'create',async()=>wallet);
 return {coin,wallet,quote:amount=>quoteBoarding(account,amount,new AbortController().signal,'to-bitcoin')};
}
test('registration returns pending while settlement continues with its wallet alive',async t=>{
 const f=fixture(t,{withAssets:false});let release,joinedResolve,disposed=false,returned=false;
 const joined=new Promise(resolve=>{joinedResolve=resolve;});
 const gate=new Promise(resolve=>{release=resolve;});
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=> 'background-intent');
 t.mock.method(Wallet,'create',async options=>({...f.wallet,dispose:async()=>{disposed=true;},settle:async()=>{
  await options.arkProvider.registerIntent({proof:''});joinedResolve();await gate;return 'd'.repeat(64);
 }}));
 const submission=submitBoarding(account,await f.quote(1000)).then(r=>{returned=true;return r;});
 try {await joined;await new Promise(resolve=>setImmediate(resolve));assert.equal(returned,true);assert.equal(disposed,false);assert.equal((await submission).intentId,'background-intent');}
 finally {release();await submission;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(disposed,true);assert.equal(readBoardingRecord('test').commitmentTxid,'d'.repeat(64));
 await assert.rejects(f.quote(1000),/No spendable/);
 const freshCoin={...f.coin,txid:'f'.repeat(64),value:2000};
 f.wallet.getSpendableVtxos=async()=>[f.coin,freshCoin];
 assert.equal((await f.quote(1000)).maxSats,2000,'Only independent funds are available for the next transfer');
});

test('provider acknowledgements progress after the foreground returns and interruption preserves evidence',async t=>{
 const f=fixture(t,{withAssets:false});let release,disposed;
 const gate=new Promise(resolve=>{release=resolve;}),finished=new Promise(resolve=>{disposed=resolve;});
 const seen=[];
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=> 'background-intent');
 for(const action of ['confirmRegistration','submitTreeNonces','submitTreeSignatures','submitSignedForfeitTxs'])t.mock.method(RestArkProvider.prototype,action,async()=>{seen.push(readBoardingRecord('test').progress);});
 t.mock.method(Wallet,'create',async options=>({...f.wallet,dispose:async()=>disposed(),settle:async()=>{
  const p=options.arkProvider;await p.registerIntent({proof:''});await gate;
  await p.confirmRegistration('background-intent');await p.submitTreeNonces();await p.submitTreeSignatures();await p.submitSignedForfeitTxs();
  assert.equal(readBoardingRecord('test').commitmentTxid,undefined);
  throw Error('test stream interruption');
 }}));
 const result=await submitBoarding(account,await f.quote(1000));
 assert.equal(result.phase,'registered');assert.equal(transferStatus(readBoardingRecord('test')).execution,'running');
 release();await finished;
 assert.deepEqual(seen.map(p=>p.action),['confirm-registration','tree-nonces','tree-signatures','forfeit-signatures']);
 const final=transferStatus(readBoardingRecord('test'));
 assert.equal(final.stage,'signatures-submitted');assert.equal(final.execution,'interrupted');assert.equal(final.commitmentTxid,undefined);
});
test('withdraw sats from an asset-bearing output and reserve asset change for Max',async t=>{
 const f=fixture(t);
 const partial=await f.quote(1000);
 assert.equal(partial.amountSats,1000);assert.equal(partial.arkadeAfterSats,279715);
 const max=await f.quote();
 assert.equal(max.amountSats,280385);assert.equal(max.maxSats,280385);
 assert.equal(max.inputSats,280715);assert.equal(max.arkadeAfterSats,330);
 await assert.rejects(f.quote(280715),/preserve your assets/);
});
test('asset inventory changes invalidate the quote even when sats and outpoints are unchanged',async t=>{
 const f=fixture(t),before=await f.quote(1000);
 f.coin.assets=[{...assets[0],amount:assets[0].amount+1n}];
 assert.notEqual((await f.quote(1000)).fingerprint,before.fingerprint);
});
test('asset-free Max still withdraws the entire eligible balance',async t=>{
 const f=fixture(t,{withAssets:false});assert.equal((await f.quote()).amountSats,280715);
});
test('partial transfer selects only enough inputs while Max includes every available input',async t=>{
 const f=fixture(t,{withAssets:false,value:4000});f.coin.value=2000;
 f.wallet.getSpendableVtxos=async()=>[f.coin,{...f.coin,txid:'c'.repeat(64)}];
 assert.equal((await f.quote(1000)).inputSats,2000);
 assert.equal((await f.quote()).inputSats,4000);
});
test('asset-only dust cannot fund a Bitcoin withdrawal',async t=>{
 const f=fixture(t,{value:330});await assert.rejects(f.quote(),/preserve your assets/);
});

// Run the installed SDK's output/asset construction, stopping at its signing seam.
// No keys, signing, registration or network operations are used here.
async function sdkOutputs(params) {
 const stop=new Error('capture only');let captured;
 const facade={getAddress:async()=>own.encode(),logUngatedInputs:async()=>{},network:networks.signet,
  recipientAddressContext:()=>({hrp:'tark',signerSet:{active:Buffer.from(point).toString('hex'),deprecated:[]}}),
  identity:{signerSession:()=>({getPublicKey:async()=>point})},
  makeRegisterIntentSignature:async(_coins,outputs,onchainIndexes)=>{assert.deepEqual(onchainIndexes,params.outputs.flatMap((o,i)=>o.address===bitcoinAddress?[i]:[]));captured=outputs;throw stop;},makeDeleteIntentSignature:async()=>{}};
 await assert.rejects(Wallet.prototype._settleImpl.call(facade,params),error=>error===stop);
 return captured;
}

// Operator f48445b8: getOutputVtxosLeaves removes onchain receivers while
// AssetGroup.toBatchLeafAssetGroup preserves asset output indices. Reproduce
// those transformations on REAL SDK output construction, not a hand-corrected
// leaf packet. No signing or network is involved.
async function operatorRecipients(params) {
 const outputs=await sdkOutputs(params);
 const intent=new Transaction({version:3});
 for(const output of outputs)intent.addOutput(output);
 const packet=Extension.fromTx(intent).getAssetPacket();
 const commitment=new Transaction({version:3});
 const leaf=new Transaction({version:3});
 const change=params.outputs.find(o=>o.address===own.encode());
 commitment.addInput({txid:'d'.repeat(64),index:0,witnessUtxo:{script:own.pkScript,amount:BigInt(params.inputs.reduce((sum,c)=>sum+c.value,0))}});
 commitment.addOutput({script:own.pkScript,amount:change.amount});
 for(let i=0;i<params.outputs.length;i++) {
  (params.outputs[i].address===bitcoinAddress?commitment:leaf).addOutput(outputs[i]);
 }
 if(packet)leaf.addOutput(Extension.create([packet.leafTxPacket(new Uint8Array(32).fill(1))]).txOut());
 leaf.addInput({txid:commitment.id,index:0,witnessUtxo:{script:own.pkScript,amount:change.amount}});
 const recipients=params.outputs.map(o=>({address:o.address,amount:Number(o.amount),...(o.address===own.encode()?{assets:params.inputs.flatMap(c=>c.assets??[])}:{})}));
 let nonces=0;
 const provider={confirmRegistration:async()=>{},submitTreeNonces:async()=>{nonces++;}};
 const session={getPublicKey:async()=>point,init:async()=>{},getNonces:async()=>new Map()};
 const handler=Wallet.prototype.createBatchHandler.call({arkProvider:provider,network:networks.signet,forfeitPubkey:point},'fixture-intent',params.inputs,recipients,session);
 const psbt=tx=>Buffer.from(tx.toPSBT()).toString('base64');
 async function* events(){
  yield {type:'batch_started',id:'fixture-batch',intentIdHashes:[createHash('sha256').update('fixture-intent').digest('hex')],batchExpiry:172032n};
  yield {type:'tree_tx',id:'fixture-batch',batchIndex:0,chunk:{tx:psbt(leaf),children:{}}};
  yield {type:'tree_signing_started',id:'fixture-batch',unsignedCommitmentTx:psbt(commitment),cosignersPublicKeys:[Buffer.from(point).toString('hex')]};
 }
 try {await Batch.join(events(),handler);}
 catch(error){if(error.message!=='event stream closed')throw error;}
 assert.equal(nonces,1,'Real tree and recipient validators must pass before nonce submission');
}

test('Bitcoin-first asset withdrawal reproduces operator leaf index mismatch',async t=>{
 const f=fixture(t,{value:263715});
 await assert.rejects(operatorRecipients({inputs:[f.coin],outputs:[{address:bitcoinAddress,amount:1000n},{address:own.encode(),amount:262715n}]}),/asset output not found.*index 0/);
});

test('production withdrawal output order preserves asset indices through operator leaf construction',async t=>{
 const f=fixture(t,{value:263715});let captured;
 f.coin.assets=[{assetId:'2ad590810a27d0568431a9eda264d0d1e37440605193341c27924196de1da1950000',amount:1n},{assetId:'dc84cce91c3c9cb943ea5016ece2ccc309a97ed7a7df535accb7d809ddcc91110000',amount:1n}];
 t.mock.method(Wallet,'create',async()=>({...f.wallet,settle:async params=>{captured=params;throw Error('stop before signing');}}));
 await submitBoarding(account,await f.quote(1000));
 assert.ok(captured);
 await operatorRecipients(captured);
});
function intentProof(coins,outputs) {
 const tx=Intent.create({type:'register',onchain_output_indexes:[1],valid_at:0,expire_at:0,cosigners_public_keys:[]},
  coins.map(coin=>({txid:coin.txid,index:coin.vout,witnessUtxo:{script:own.pkScript,amount:BigInt(coin.value)}})),outputs);
 return Buffer.from(tx.toPSBT()).toString('base64');
}
function storage(t) {
 const values=new Map();
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');});
 return values;
}
test('SDK settlement preserves exact asset quantities; altered asset proofs are rejected',async t=>{
 const f=fixture(t),params={inputs:[f.coin],outputs:[{address:own.encode(),amount:279715n},{address:bitcoinAddress,amount:1000n}]};
 const outputs=await sdkOutputs(params);
 const change={script:Buffer.from(own.pkScript).toString('hex'),sats:279715,assets:assets.map(a=>({...a,amount:String(a.amount)}))};
 assert.equal(outputs.length,3);
 assert.doesNotThrow(()=>inspectBoardingAssets(intentProof(params.inputs,outputs),params,change));
 for(const changed of [outputs.slice(0,2),[{...outputs[0],amount:279714n},outputs[1],outputs[2]],[{...outputs[0],script:new Uint8Array([0x51])},outputs[1],outputs[2]],[outputs[0],outputs[1],{...outputs[2],script:new Uint8Array([0x6a])}]]) {
  assert.throws(()=>inspectBoardingAssets(intentProof(params.inputs,changed),params,change));
 }
 assert.throws(()=>inspectBoardingAssets(intentProof([{...f.coin,txid:'c'.repeat(64)}],outputs),params,change));
});
test('SDK settlement aggregates multiple assets from multiple inputs without depending on asset order',async t=>{
 const f=fixture(t);f.coin.assets=[{assetId:'f'.repeat(68),amount:2n},...assets];
 const other={...f.coin,txid:'c'.repeat(64),value:1000,assets:[{...assets[0],amount:3n}]};
 const params={inputs:[f.coin,other],outputs:[{address:own.encode(),amount:330n},{address:bitcoinAddress,amount:281385n}]};
 const change={script:Buffer.from(own.pkScript).toString('hex'),sats:330,assets:[{...assets[0],amount:String(assets[0].amount+3n)},{assetId:'f'.repeat(68),amount:'2'}]};
 const outputs=await sdkOutputs(params);
 assert.doesNotThrow(()=>inspectBoardingAssets(intentProof(params.inputs,outputs),params,change));
});
test('submission binds and journals asset change before registration; ambiguous outcomes remain pending',async t=>{
 const f=fixture(t);storage(t);let registrations=0;
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=>{
  registrations++;const r=readBoardingRecord('test');assert.equal(r.phase,'submitting');assert.equal(r.assetChange.sats,330);assert.equal(r.assetChange.assets[0].amount,String(assets[0].amount));return 'intent';
 });
 t.mock.method(Wallet,'create',async options=>({...f.wallet,settle:async params=>{
  await options.arkProvider.registerIntent({proof:intentProof(params.inputs,await sdkOutputs(params))});
  throw Error('connection lost');
 }}));
 const quote=await f.quote(),result=await submitBoarding(account,quote);
 assert.equal(registrations,1);assert.equal(result.status,'pending');assert.equal(result.phase,'registered');assert.equal(result.quote.inputSats,280715);
 const roundtrip=readBoardingRecord('test');assert.deepEqual(roundtrip.assetChange,result.assetChange);
 assert.throws(()=>writeBoardingRecord({...roundtrip,assetChange:undefined}));
 assert.throws(()=>writeBoardingRecord({...roundtrip,assetChange:{...roundtrip.assetChange,assets:[{...roundtrip.assetChange.assets[0],amount:'1.5'}]}}));
});
test('changed asset inventory at confirmation cannot register an intent',async t=>{
 const f=fixture(t);storage(t);let registrations=0;
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=>{registrations++;});
 t.mock.method(Wallet,'create',async()=>({...f.wallet,settle:async()=>{throw Error('unexpected');}}));
 const quote=await f.quote();
 for(const altered of [{...assets[0],amount:1n},{...assets[0],assetId:'f'.repeat(68)}]) {
  f.coin.assets=[altered];
  await assert.rejects(submitBoarding(account,quote),/Transfer details changed/);
 }
 assert.equal(registrations,0);assert.equal(readBoardingRecord('test'),undefined);
});
test('altered settlement proofs cannot reach registration',async t=>{
 for(const kind of ['asset-id','quantity','allocation','input'])await t.test(kind,async child=>{
  const f=fixture(child);storage(child);let registrations=0;
  child.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n}));
  child.mock.method(RestArkProvider.prototype,'registerIntent',async()=>{registrations++;return 'unexpected';});
  child.mock.method(Wallet,'create',async options=>({...f.wallet,settle:async params=>{
   let proofInputs=params.inputs;
   if(kind==='asset-id')proofInputs=[{...f.coin,assets:[{...assets[0],assetId:'f'.repeat(68)}]}];
   if(kind==='quantity')proofInputs=[{...f.coin,assets:[{...assets[0],amount:1n}]}];
   if(kind==='input')proofInputs=[{...f.coin,txid:'c'.repeat(64)}];
   const outputs=await sdkOutputs({...params,inputs:proofInputs});
   if(kind==='allocation')outputs[0]={...outputs[0],script:outputs[1].script};
   await options.arkProvider.registerIntent({proof:intentProof(proofInputs,outputs)});
   throw Error('unexpected registration');
  }}));
  const result=await submitBoarding(account,await f.quote());
  assert.equal(registrations,0);assert.equal(result.status,'not-submitted');assert.equal(result.phase,'prepared');
 });
});
test('recovery requires exact asset change alongside confirmed Bitcoin receipt',()=>{
 const commitment='d'.repeat(64),input={txid:'b'.repeat(64),vout:0};
 const change={script:Buffer.from(own.pkScript).toString('hex'),sats:330,assets:assets.map(a=>({...a,amount:String(a.amount)}))};
 const record={inputs:[input],bitcoinAddress,assetChange:change,quote:{direction:'to-bitcoin',amountSats:280385,netSats:280385,maxSats:280385,inputSats:280715}};
 const transaction={txid:commitment,status:{confirmed:true},vout:[{scriptpubkey_address:bitcoinAddress,value:280385}]};
 const receipt={value:330,script:change.script,assets,commitmentTxIds:[commitment]};
 const consumed=[{...input,isSpent:true,settledBy:commitment}];
 assert.equal(verifiedBoardingCommitment(record,[transaction],[receipt],consumed),commitment);
 for(const altered of [{assets:[]},{assets:[{...assets[0],amount:1n}]},{script:'wrong'},{value:329},{assets:[{...assets[0],amount:1}]}]) {
  assert.equal(verifiedBoardingCommitment(record,[transaction],[{...receipt,...altered}],consumed),undefined);
 }
 assert.equal(verifiedBoardingCommitment(record,[transaction],[],consumed),undefined);
 assert.equal(verifiedBoardingCommitment(record,[{...transaction,status:{confirmed:false}}],[receipt],consumed),undefined);
});
