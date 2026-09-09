import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bech32m} from '@scure/base';
import {ArkAddress,Batch,CSVMultisigTapscript,Extension,ReadonlyWallet,RestArkProvider,Transaction,Wallet,createAssetPacket,networks} from '@arkade-os/sdk';
import {quoteBoarding,submitBoarding} from '../src/arkade/boarding.ts';
import {readBoardingRecord} from '../src/core/boarding-record.ts';
import {walletReservations} from '../src/core/wallet-reservations.ts';
import {testLocks} from './locks-fixture.mjs';

// Public curve points and transport fixtures only. Real SDK Batch.join,
// createBatchHandler, PSBT/tree/recipient/asset validators run unchanged.
// Session methods are controlled seams, not a full MuSig or live withdrawal.
const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
const own=new ArkAddress(point,point,'tark');
const bitcoinAddress=bech32m.encode('tb',[1,...bech32m.toWords(point)]);
const account={profileId:'handler-player',phrase:'abandon '.repeat(11)+'about'};
const intentId='11111111-1111-4111-8111-111111111111',batchId='22222222-2222-4222-8222-222222222222';
const asset={assetId:'a'.repeat(64)+'0000',amount:9007199254740993n};
const psbt=tx=>Buffer.from(tx.toPSBT()).toString('base64');
function transactions(kind) {
 const commitment=new Transaction({version:3});
 commitment.addInput({txid:'a'.repeat(64),index:0,witnessUtxo:{script:own.pkScript,amount:3000n}});
 commitment.addOutput({script:own.pkScript,amount:2000n});
 commitment.addOutput({script:own.pkScript,amount:1000n});
 const leaf=new Transaction({version:3});
 leaf.addInput({txid:kind==='wrong-tree'?'b'.repeat(64):commitment.id,index:0,witnessUtxo:{script:own.pkScript,amount:2000n}});
 leaf.addOutput({script:own.pkScript,amount:2000n});
 if(kind!=='missing-assets')leaf.addOutput(Extension.create([createAssetPacket(new Map([[0,[asset]]]),[{address:own.encode(),amount:2000,assets:[kind==='wrong-assets'?{...asset,amount:1n}:asset]}])]).txOut());
 return {commitment,leaf};
}
async function run(t,kind) {
 const data=new Map(),calls={register:0,confirm:0,init:0,nonces:0,signatures:0};let streamSignal;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No live network in SDK handler fixture');});
 const coin={txid:'c'.repeat(64),vout:0,value:3000};
 const info={network:'signet',sessionDuration:60n,fees:{txFeeRate:'0',intentFee:{}},utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n};
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
 t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=>{calls.register++;return intentId;});
 t.mock.method(RestArkProvider.prototype,'confirmRegistration',async()=>{calls.confirm++;if(kind==='lost-confirm')throw Error('transport response lost');});
 t.mock.method(RestArkProvider.prototype,'submitTreeNonces',async()=>{calls.nonces++;if(kind==='lost-nonces')throw Error('transport response lost');});
 t.mock.method(RestArkProvider.prototype,'submitTreeSignatures',async()=>{calls.signatures++;});
 t.mock.method(RestArkProvider.prototype,'getEventStream',async function*(signal){streamSignal=signal;yield {type:'fixture-probe'};});
 const wallet={dustAmount:330n,boardingTapscript:{exitScript:'00'},dispose:async()=>{},getAddress:async()=>own.encode(),getBoardingAddress:async()=>bitcoinAddress,getBoardingUtxos:async()=>[],getBalance:async()=>({available:3000,total:3000,boarding:{total:0}}),onchainProvider:{getChainTip:async()=>({height:1})},getProviderConnectionState:()=>({mode:'online',source:'live'}),getSpendableVtxos:async()=>[coin]};
 t.mock.method(ReadonlyWallet,'create',async()=>wallet);
 let finish,handlerError,releaseEvents,enteredBatch,settleFinished,current=true;
 const eventGate=new Promise(resolve=>{releaseEvents=resolve;});
 const participated=new Promise(resolve=>{enteredBatch=resolve;});
 const settled=new Promise(resolve=>{settleFinished=resolve;});
 const deadline=new AbortController();
 const originalTimeout=AbortSignal.timeout.bind(AbortSignal);
 if(kind==='deadline')t.mock.method(AbortSignal,'timeout',ms=>ms>=180000?deadline.signal:originalTimeout(ms));
 const finished=new Promise(resolve=>{finish=resolve;});
 t.mock.method(Wallet,'create',async options=>({...wallet,dispose:async()=>finish(),settle:async(_params,eventCallback)=>{
  const provider=options.arkProvider;
  await provider.getEventStream(new AbortController().signal,[]).next();
  await provider.registerIntent({proof:''});
  const session={getPublicKey:async()=>point,init:async()=>{calls.init++;},getNonces:async()=>new Map(),aggregatedNonces:async()=>({hasAllNonces:true}),sign:async()=>new Map()};
  const recipients=[{address:bitcoinAddress,amount:1000n},{address:own.encode(),amount:2000n,assets:[asset]}];
  const handler=Wallet.prototype.createBatchHandler.call({arkProvider:provider,network:networks.signet,forfeitPubkey:point},intentId,[coin],recipients,session);
  const {commitment,leaf}=transactions(kind);
  async function* events(){
   yield {type:'batch_started',id:batchId,intentIdHashes:[createHash('sha256').update(intentId).digest('hex')],batchExpiry:172032n};
   if(kind==='deadline'||kind==='replacement'){enteredBatch();await eventGate;}
   if(kind==='stream-closed'||kind==='lost-confirm')return;
   if(kind.endsWith('batch-failed')){yield {type:'batch_failed',id:kind==='selected-batch-failed'?batchId:'33333333-3333-4333-8333-333333333333',reason:'public fixture batch failure'};return;}
   yield {type:'tree_tx',id:batchId,batchIndex:0,chunk:{tx:psbt(leaf),children:{}}};
   yield {type:'tree_signing_started',id:batchId,unsignedCommitmentTx:psbt(commitment),cosignersPublicKeys:kind==='missing-cosigner'?[]:[Buffer.from(point).toString('hex')]};
  }
  try{return await Batch.join(events(),handler,{eventCallback});}
  catch(error){handlerError=error;throw error;}
  finally{settleFinished();}
 }}));
 await submitBoarding(account,await quoteBoarding(account,1000,new AbortController().signal,'to-bitcoin'),()=>current);
 if(kind==='deadline'){
  await participated;deadline.abort();await finished;
  await new Promise(resolve=>setImmediate(resolve));
  releaseEvents();await settled;
 }
 if(kind==='replacement'){await participated;current=false;releaseEvents();await settled;}
 await finished;
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(streamSignal.aborted,true,'Adapter teardown aborts the provider event stream');
 const record=readBoardingRecord(account.profileId);
 assert.equal(record.status,'pending');assert.equal(record.commitmentTxid,undefined);
 assert.equal(record.progress.execution,'interrupted');
 assert.equal(walletReservations(account.profileId).length,1);
 assert.equal(calls.register,1,'No replacement intent is submitted');
 await assert.rejects(quoteBoarding(account,1000,new AbortController().signal,'to-bitcoin'),/No spendable/);
 return {calls,record,error:handlerError};
}
test('real handler validates public tree and exact large asset amount before nonce submission',async t=>{
 const f=await run(t,'valid');assert.match(f.error.message,/event stream closed/);
 assert.equal(f.calls.init,1);assert.equal(f.calls.nonces,1);
 assert.equal(f.record.failure.code,'event-stream-closed');assert.equal(f.record.failure.action,'tree-nonces');
});
test('real handler stream closure after participation retains selected stage',async t=>{
 const f=await run(t,'stream-closed');assert.equal(f.calls.confirm,1);assert.equal(f.calls.nonces,0);
 assert.equal(f.record.failure.code,'event-stream-closed');assert.equal(f.record.failure.stage,'batch-selected');
});
for(const scope of ['selected','unrelated'])test(`real SDK ${scope} batch failure never fabricates completion or input release`,async t=>{
 const f=await run(t,`${scope}-batch-failed`);assert.match(f.error.message,/public fixture batch failure/);
 assert.equal(f.calls.nonces,0);assert.equal(f.record.diagnostic,scope==='selected'?'batch-failed':'settlement-interrupted');
 assert.equal(f.record.failure.batchId,batchId);
});
test('missing cosigner skips signing and exhausted stream remains interrupted',async t=>{
 const f=await run(t,'missing-cosigner');assert.equal(f.calls.init,0);assert.equal(f.calls.nonces,0);
 assert.equal(f.record.failure.action,'validate-tree');assert.equal(f.record.failure.code,'event-stream-closed');
});
for(const kind of ['wrong-tree','missing-assets','wrong-assets'])test(`real handler rejects ${kind} before nonce construction`,async t=>{
 const f=await run(t,kind);
 assert.match(f.error.message,{'wrong-tree':/^wrong commitment txid$/,'missing-assets':/^no extension output found in transaction$/,'wrong-assets':/invalid asset output amount.*got 1, want 9007199254740993/}[kind]);
 assert.equal(f.calls.init,0);assert.equal(f.calls.nonces,0);assert.equal(f.record.failure.action,'validate-tree');
});
for(const [kind,action,nonces] of [['lost-confirm','confirm-registration',0],['lost-nonces','tree-nonces',1]])test(`real handler ${kind} preserves before-send uncertainty`,async t=>{
 const f=await run(t,kind);assert.match(f.error.message,/transport response lost/);
 assert.equal(f.calls.nonces,nonces);assert.equal(f.record.failure.action,action);
 assert.equal(f.record.failure.code,'unknown');
});
test('deadline prevents late SDK events from submitting more nonces after wallet disposal',async t=>{
 const f=await run(t,'deadline');assert.equal(f.calls.nonces,0);
 assert.equal(f.record.status,'pending');assert.equal(f.record.commitmentTxid,undefined);
});
test('account replacement prevents the old SDK signing session from submitting more nonces',async t=>{
 const f=await run(t,'replacement');assert.equal(f.calls.nonces,0);
 assert.match(f.error.message,/Transfer signing session ended/);
});
