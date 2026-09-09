import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {verifiedReceipt,capturedFunding,fundingEligible,canSubmit,half} from '../src/model.js';
import {Ramps,ArkAddress} from '@arkade-os/sdk';
import {newRecoveryPhrase,normalizeRecoveryPhrase} from '../src/identity-material.js';
import {queuedLocks} from './helpers.mjs';
import {WorkCoordinator,staleError,withDeadline} from '../src/coordinator.js';
import {classifyFailure,nextRetry,recoveryMessage,batchFailure} from '../src/recovery.js';

// Exercise the application's actual startup and provider wrapper without keys or network calls.
async function app(operation, registrationError, activeSigner=false, startupError) {
 const saved={identity:{id:'test-account',kind:'mnemonic'},operation:structuredClone(operation)};
 const elements=new Map();
 const element=()=>({value:'50',style:{},classList:{toggle(){}},setAttribute(){},
  insertAdjacentHTML(){},replaceChildren(){},append(){},addEventListener(){},
  closest:()=>element(),querySelector:()=>element()});
 let provider;
 const streamSignals=[],timeouts=new Map();let timeoutId=0;
 class Provider {
  constructor(){provider=this;}
  async getInfo(){if(startupError)throw startupError;return {network:'signet',fees:{txFeeRate:'0',intentFee:{}}};}
  async registerIntent(){if(typeof registrationError==='function')return registrationError();if(registrationError)throw registrationError;return 'registered-id';}
  async deleteIntent(){return;}
  async confirmRegistration(){context.confirmCalls=(context.confirmCalls??0)+1;}
  getEventStream(signal){
   streamSignals.push(signal);let resolve;
   signal.addEventListener('abort',()=>resolve?.({done:true}));
   return {next:()=>new Promise(r=>{resolve=r;if(signal.aborted)r({done:true});}),return:async()=>{resolve?.({done:true});return {done:true};},[Symbol.asyncIterator](){return this;}};
  }
 }
 const locks=queuedLocks(),held=locks.held;
 if(activeSigner)held.set('standalone-settlement',{});
 const context=vm.createContext({console,Date,Error,Number,Math:Object.assign(Object.create(Math),{random:()=>0}),Uint8Array,Promise,AbortController,
  WorkCoordinator,staleError,withDeadline,classifyFailure,batchFailure,nextRetry:(previous,error,options)=>nextRetry(previous,error,{...options,random:()=>0}),recoveryMessage,
  crypto:{randomUUID:()=> 'attempt'},navigator:{locks},
  document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
   querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},
  setInterval(){},clearInterval(){},setTimeout(fn,ms){const id=++timeoutId;timeouts.set(id,{fn,ms});return id;},clearTimeout(id){timeouts.delete(id);},
  layout:'',sdkVersion:'test',identity:async()=>({}),normalizeRecoveryPhrase,
  read:async key=>structuredClone(saved[key]),write:async(key,value)=>{saved[key]=structuredClone(value);},
  RestArkProvider:Provider,InMemoryWalletRepository:class{},InMemoryContractRepository:class{},
  Wallet:{create:async()=>({arkProvider:provider,boardingTapscript:{exitScript:'00'},
   indexerProvider:{getVtxos:async()=>({vtxos:[]})},
   settle:async()=>{throw new Error('Synthetic settlement failure');},
   getBoardingAddress:async()=> 'tb1-test',getBoardingUtxos:async()=>[],
   getBalance:async()=>({boarding:{total:10000},total:10000,available:0}),
   getProviderConnectionState:()=>({mode:'online',source:'live'}),
   getSpendableVtxos:async()=>[],onchainProvider:{getTransactions:async()=>[],getCoins:async()=>[],getChainTip:async()=>({height:1})}})},
  CSVMultisigTapscript:{decode:()=>({params:{timelock:{}}})},fundingEligible,hasBoardingTxExpired:()=>false,Ramps,
  verifiedReceipt,capturedFunding,canSubmit,half,incomingTransactions:()=>[],
  recordTiming:async()=>true,loadTimings:()=>({runs:{}}),renderTimings(){},
  setupTimingViews(){},setupStepDisclosure(){},renderStepCompletion(){},renderSettlementOutput(){},
  transferBadge(){},statusBadge(){},settlementCard(){},
  errorSummary:()=> 'Network request failed',guarded:(fn)=>fn,
 });
 context.stateStorage=context.localStorage;context.stateLocks=locks;
 context.windowState={id:'test-window'};context.updateWindowUrl=()=>{};
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8')
  .replace(/^import .*?;\r?\n/gm,'')
  .replace("void start().catch(error=>captureError('startup',error));","globalThis.started=start();");
 vm.runInContext(source,context);
 await context.started;
 return {saved,elements,provider,context,held,streamSignals,timeouts};
}

const pending={accountId:'test-account',phase:'submitting',attemptKey:'attempt',
 inputs:[{txid:'funding',vout:0,value:10000}],total:10000,target:5000,change:5000,leg:'board'};

test('CPU onboarding waits for fresh confirmed funding then submits once without a click',async()=>{
 const {context,saved}=await app({phase:'idle'});
 let confirmed=false,networkAvailable=true,calls=0,submitted;
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=params=>{calls++;submitted=params;return new Promise(()=>{});};
 context.mockConnection=()=>({mode:networkAvailable?'online':'offline',source:'live'});
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;wallet.getProviderConnectionState=mockConnection;',context);
 await vm.runInContext('tick()',context);assert.equal(calls,0);
 confirmed=true;networkAvailable=false;
 await vm.runInContext('tick()',context);assert.equal(calls,0);
 networkAvailable=true;
 await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(calls,1,'confirmed funding must start onboarding automatically');
 assert.equal(saved.operation.target,5000);
 assert.equal(saved.operation.autoRecovery,true,'automatic continuation must survive a page reload');
 assert.deepEqual(saved.operation.inputs,pending.inputs);
 assert.equal(submitted.inputs.length,1);
 await vm.runInContext('tick()',context);assert.equal(calls,1,'refresh must not duplicate submission');
});

test('startup outage schedules same-account automatic reconnect',async()=>{
 const {elements,timeouts}=await app({phase:'idle'},undefined,false,Object.assign(new Error('network'),{name:'FetchError'}));
 assert.match(elements.get('account-status').textContent,/retry|recover/i);
 assert.ok([...timeouts.values()].some(t=>t.ms>=5000&&t.ms<=60000),'startup must schedule recovery without a reload');
});

test('failed preparation retains its captured inputs when a later deposit appears',async()=>{
 const {context,saved}=await app({phase:'idle'});
 let coins=[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockCoins=async()=>coins;
 context.mockAddress=async()=>{throw new TypeError('unseen preparation failure');};
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;',context);
 await vm.runInContext('tick()',context);
 assert.deepEqual(saved.operation.inputs,pending.inputs);
 coins=[...coins,{txid:'later',vout:0,value:90000,status:{confirmed:true}}];
 await vm.runInContext('tick()',context);
 assert.deepEqual(saved.operation.inputs,pending.inputs,'preparation must not recapture later deposits');
});

test('a hanging observation has a deadline and holds no operation lock',async()=>{
 const {context,timeouts,held}=await app({phase:'idle'});
 context.mockCoins=()=>new Promise(()=>{});
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;void tick();',context);
 await new Promise(setImmediate);
 assert.equal(held.has('standalone-operation'),false,'network waits must not own the operation lock');
 assert.ok([...timeouts.values()].some(t=>t.ms>=10000&&t.ms<=60000),'observation must have a bounded deadline');
});

test('reload shows interrupted submission and offers explicit recovery without submitting',async()=>{
 const {saved,elements}=await app(pending);
 assert.equal(saved.operation.phase,'uncertain');
 assert.match(elements.get('status').textContent,/interrupted|not active/i);
 assert.equal(elements.get('retry-existing').disabled,false);
 assert.equal(saved.operation.intent,undefined);
 assert.deepEqual(saved.operation.inputs,pending.inputs);
});

test('registration error is persisted before SDK cleanup can finish or hang',async()=>{
 const {saved,provider}=await app({...pending,phase:'idle'},new TypeError('Failed to fetch'));
 saved.operation=structuredClone(pending);
 await assert.rejects(provider.registerIntent({}),/Failed to fetch/);
 assert.equal(saved.operation.phase,'uncertain');
 assert.equal(saved.operation.failureAt,'registration');
 assert.equal(saved.operation.intent,undefined);
 assert.deepEqual(saved.operation.inputs,pending.inputs);
});

test('a committed transfer remains available for read-only reconciliation on reload',async()=>{
 const {saved}=await app({...pending,phase:'committed',commitment:'commitment'});
 assert.equal(saved.operation.phase,'committed');
 assert.equal(saved.operation.commitment,'commitment');
});
test('another tab holding the signing lease is not marked interrupted',async()=>{
 const {saved}=await app(pending,undefined,true);
 assert.equal(saved.operation.phase,'submitting');
});
test('registered intent is preserved when its signing session exits',async()=>{
 const {saved}=await app({...pending,phase:'registered',intent:'existing-intent'});
 assert.equal(saved.operation.phase,'uncertain');
 assert.equal(saved.operation.intent,'existing-intent');
});
test('a live settlement failure releases its signing lease and preserves the attempt',async()=>{
 const {context,saved,held}=await app({...pending,phase:'idle'});
 saved.operation=structuredClone(pending);
 vm.runInContext('launchSettlement({});',context);
 await new Promise(setImmediate);
 assert.equal(saved.operation.phase,'uncertain');
 assert.equal(held.has('standalone-settlement'),false);
 assert.deepEqual(saved.operation.inputs,pending.inputs);
});
test('SDK duplicate-input recovery can delete and retry once within the same attempt',async()=>{
 let calls=0;
 const duplicate=Object.assign(new Error('duplicated input'),{code:0});
 const {saved,provider}=await app({...pending,phase:'idle'},()=>{if(++calls===1)throw duplicate;return 'replacement-id';});
 saved.operation=structuredClone(pending);
 await assert.rejects(provider.registerIntent({}),/duplicated input/);
 await provider.deleteIntent({});
 assert.equal(await provider.registerIntent({}),'replacement-id');
 assert.equal(saved.operation.phase,'registered');
 assert.equal(saved.operation.intent,'replacement-id');
 await assert.rejects(provider.registerIntent({}),/Repeat registration blocked/);
 assert.equal(calls,2);
});
test('two-leg settlement repeatedly reaches Step 6 only after both confirmations and exact receipts',async()=>{
 for(let run=0;run<3;run++){
  const {context,saved,elements}=await app({...pending,phase:'idle'});
  saved.operation={...structuredClone(pending),mode:'board-then-return',phase:'submitting'};
  const board={txid:`board-${run}`,status:{confirmed:false},vin:[{txid:'funding',vout:0}],vout:[]};
  const back={txid:`return-${run}`,status:{confirmed:false},vin:[],vout:[{scriptpubkey_address:'tb1-test',value:5000}]};
  let settlements=0,receipts=[];
  context.mockSettle=async params=>{
   settlements++;
   if(settlements===1){receipts=[{txid:'board-vtxo',vout:0,value:10000,commitmentTxIds:[board.txid]}];return board.txid;}
   assert.equal(settlements,2,'never register a third transfer');
   assert.equal(params.inputs.length,1);
   assert.equal(params.inputs[0].value,10000);
   assert.equal(params.outputs[0].amount,5000n);
   assert.equal(params.outputs[1].amount,5000n);
   receipts=[{txid:'final-vtxo',vout:0,value:5000,commitmentTxIds:[back.txid]}];return back.txid;
  };
  context.mockReceipts=async()=>receipts;
  context.mockTransactions=async()=>[board,back];
  vm.runInContext("wallet.settle=mockSettle;wallet.getAddress=async()=> 'own-arkade';wallet.getSpendableVtxos=mockReceipts;wallet.onchainProvider.getTransactions=mockTransactions;launchSettlement({});",context);
  await new Promise(setImmediate);
  assert.equal(saved.operation.phase,'committed');
  assert.equal(settlements,2);
  assert.notEqual(saved.operation.phase,'success');
  back.status.confirmed=true;
  await vm.runInContext('tick()',context);
  assert.notEqual(saved.operation.phase,'success','return confirmation alone is insufficient');
  board.status.confirmed=true;
  await vm.runInContext('tick()',context);
  assert.equal(saved.operation.phase,'success');
  assert.match(elements.get('usable').textContent,/5,000 sats verified/);
  await vm.runInContext('tick()',context);
  assert.equal(settlements,2);
 }
});
test('explicit recovery freezes original funding and ignores later deposits',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});
 const original={...pending.inputs[0],status:{confirmed:true}};
 const later={txid:'later',vout:1,value:999999,status:{confirmed:true}};
 let selected,fail;
 context.mockCoins=async()=>[original,later];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=params=>{selected=params;return new Promise((_,reject)=>{fail=reject;});};
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;',context);
 await elements.get('retry-existing').onclick();
 await new Promise(setImmediate);
 assert.equal(selected.inputs.length,1);
 assert.equal(selected.inputs[0].txid,'funding');
 assert.equal(selected.outputs[0].amount,10000n);
 assert.equal(saved.operation.target,5000);
 assert.equal(saved.operation.total,10000);
 fail(new Error('Finish simulated test'));
 await new Promise(setImmediate);
});
test('recovery never submits when an original input is missing',async()=>{
 const {context,elements,saved}=await app({...pending,phase:'uncertain'});
 let calls=0;context.mockSettle=async()=>{calls++;};
 vm.runInContext('wallet.settle=mockSettle;',context);
 await elements.get('retry-existing').onclick();
 assert.equal(calls,0);
 assert.equal(saved.operation.phase,'uncertain');
});
test('recovery resumes the Bitcoin return using only its original Arkade inputs',async()=>{
 const returnInput={txid:'board-vtxo',vout:0,value:10000,commitmentTxIds:['board']};
 const {context,saved,elements}=await app({...pending,phase:'uncertain',mode:'board-then-return',leg:'return',boardingCommitment:'board',returnInputs:[returnInput]});
 let submitted;
 context.mockReceipts=async()=>[returnInput,{txid:'later-vtxo',vout:0,value:999999}];
 context.mockSettle=async params=>{submitted=params;return 'return-commitment';};
 vm.runInContext("wallet.getSpendableVtxos=mockReceipts;wallet.settle=mockSettle;wallet.getAddress=async()=> 'own-arkade';",context);
 await elements.get('retry-existing').onclick();await new Promise(setImmediate);
 assert.ok(submitted,'the return leg must be recoverable');
 assert.equal(submitted.inputs.length,1);assert.equal(submitted.inputs[0].txid,'board-vtxo');
 assert.equal(submitted.outputs[0].amount,5000n);
 assert.equal(saved.operation.commitment,'return-commitment');
});
test('one click retries a transient failure and reaches Step 6 without another click',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain',target:10000,change:0});
 let now=Date.now(),calls=0;
 context.Date=class extends Date{static now(){return now;}};
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=async()=>{if(++calls===1)throw Object.assign(new Error('Network request failed'),{name:'FetchError'});return 'board';};
 context.mockReceipts=async()=>calls>=2?[{value:10000,commitmentTxIds:['board']}]:[];
 context.mockTransactions=async()=>calls>=2?[{txid:'board',status:{confirmed:true},vin:[{txid:'funding',vout:0}],vout:[]}]:[];
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;wallet.getSpendableVtxos=mockReceipts;wallet.onchainProvider.getTransactions=mockTransactions;',context);
 await vm.runInContext('tick()',context);assert.equal(calls,0,'loading never initiates signing');
 await elements.get('retry-existing').onclick();await new Promise(setImmediate);
 assert.equal(calls,1);
 now+=31000;await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(calls,2);
 assert.equal(saved.operation.phase,'success');
});

test('operator internal errors retry the original transfer automatically',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain',target:10000,change:0});
 let now=Date.now(),calls=0;
 context.Date=class extends Date{static now(){return now;}};
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=async()=>{if(++calls===1)throw Object.assign(new Error('internal error: failed to confirm registration'),{name:'INTERNAL_ERROR',code:0});return 'board';};
 context.mockReceipts=async()=>calls>=2?[{value:10000,commitmentTxIds:['board']}]:[];
 context.mockTransactions=async()=>calls>=2?[{txid:'board',status:{confirmed:true},vin:[{txid:'funding',vout:0}],vout:[]}]:[];
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;wallet.getSpendableVtxos=mockReceipts;wallet.onchainProvider.getTransactions=mockTransactions;',context);
 await elements.get('retry-existing').onclick();await new Promise(setImmediate);
 assert.equal(calls,1);
 now+=31000;await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(calls,2,'INTERNAL_ERROR must not silently turn off recovery');
 assert.equal(saved.operation.phase,'success');
});

test('an opted-in interrupted signing session automatically recovers after reload',async()=>{
 const {context,saved}=await app({...pending,autoRecovery:true});
 assert.equal(saved.operation.phase,'uncertain');
 let now=Date.now()+31000,calls=0;
 context.Date=class extends Date{static now(){return now;}};
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=()=>{calls++;return new Promise(()=>{});};
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;',context);
 await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(calls,1,'saved automatic continuation must not require another click');
 assert.equal(saved.operation.autoRecovery,true);
 assert.deepEqual(saved.operation.inputs,pending.inputs);
});

test('reload retains retry delay and attempt count instead of retrying immediately',async()=>{
 const nextRecoveryAt=Date.now()+60000;
 const {context,saved}=await app({...pending,phase:'uncertain',autoRecovery:true,retryAllowed:true,recoveryAttempts:3,nextRecoveryAt});
 let now=nextRecoveryAt-1,calls=0;
 context.Date=class extends Date{static now(){return now;}};
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=()=>{calls++;return new Promise(()=>{});};
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;',context);
 await vm.runInContext('tick()',context);assert.equal(calls,0);
 now+=2;await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(calls,1);
 assert.equal(saved.operation.recoveryAttempts,4);
});

test('a silent settlement stream times out by closing the SDK stream before recovery',async()=>{
 const {provider,streamSignals,timeouts}=await app({...pending,phase:'uncertain'});
 const controller=new AbortController();
 const stream=provider.getEventStream(controller.signal,['public-test-topic']);
 const next=stream.next();
 const timeout=[...timeouts.values()].find(t=>t.ms===300000);
 assert.ok(timeout,'settlement stream must have a five-minute inactivity watchdog');
 const failed=assert.rejects(next,{name:'SettlementStreamTimeoutError'});
 timeout.fn();
 await failed;
 assert.equal(streamSignals[0].aborted,true,'stop the actual SDK stream before retrying');
 assert.equal(timeouts.size,0);
});

test('SDK cleanup can close a pending watched stream without waiting for its timeout',async()=>{
 const {provider,streamSignals,timeouts}=await app({...pending,phase:'uncertain'});
 const stream=provider.getEventStream(new AbortController().signal,[]);
 const next=stream.next();
 await stream.return();await next;
 assert.equal(streamSignals[0].aborted,true);
 assert.equal(timeouts.size,0);
});

test('reconciliation discovers completed boarding after its acknowledgement was lost',async()=>{
 const {context,saved}=await app({...pending,phase:'uncertain',mode:'board-then-return'});
 const board={txid:'recovered-board',status:{confirmed:true},vin:[{txid:'funding',vout:0}],vout:[]};
 const receipt={txid:'board-vtxo',vout:0,value:10000,commitmentTxIds:[board.txid]};
 let submitted;
 context.mockTransactions=async()=>[board];context.mockReceipts=async()=>[receipt];
 context.mockSettle=params=>{submitted=params;return new Promise(()=>{});};
 vm.runInContext("wallet.onchainProvider.getTransactions=mockTransactions;wallet.getSpendableVtxos=mockReceipts;wallet.getAddress=async()=> 'own-arkade';wallet.settle=mockSettle;",context);
 await vm.runInContext('tick()',context);await new Promise(setImmediate);
 assert.equal(saved.operation.boardingCommitment,board.txid);
 assert.equal(saved.operation.leg,'return');
 assert.equal(submitted.inputs[0].txid,receipt.txid,'continue from received Arkade funds, never board again');
});

test('boarding reconciliation rejects unrelated inputs or an inexact receipt',async()=>{
 for(const mismatch of ['input','receipt']){
  const {context,saved}=await app({...pending,phase:'uncertain',mode:'board-then-return'});
  context.mockTransactions=async()=>[{txid:'candidate',status:{confirmed:true},vin:[{txid:mismatch==='input'?'unrelated':'funding',vout:0}],vout:[]}];
  context.mockReceipts=async()=>[{value:mismatch==='receipt'?9999:10000,commitmentTxIds:['candidate']}];
  let calls=0;context.mockSettle=async()=>{calls++;};
  vm.runInContext('wallet.onchainProvider.getTransactions=mockTransactions;wallet.getSpendableVtxos=mockReceipts;wallet.settle=mockSettle;',context);
  await vm.runInContext('tick()',context);
  assert.equal(saved.operation.phase,'uncertain');assert.equal(calls,0);
 }
});

test('a lost return acknowledgement is recovered from the exact settled inputs and receipts',async()=>{
 for(const wrongLink of [false,true]){
  const input={txid:'board-vtxo',vout:0,value:10000};
  const {context,saved}=await app({...pending,phase:'uncertain',mode:'board-then-return',leg:'return',boardingCommitment:'board',returnInputs:[input]});
  context.mockHistory=async()=>({vtxos:[{...input,settledBy:wrongLink?'unrelated':'return',commitmentTxIds:['board']}]});
  context.mockTransactions=async()=>[
   {txid:'board',status:{confirmed:true},vin:[{txid:'funding',vout:0}],vout:[]},
   {txid:'return',status:{confirmed:true},vin:[],vout:[{scriptpubkey_address:'tb1-test',value:5000}]}];
  context.mockReceipts=async()=>[{value:5000,commitmentTxIds:['return']}];
  let calls=0;context.mockSettle=async()=>{calls++;};
  vm.runInContext('wallet.indexerProvider.getVtxos=mockHistory;wallet.onchainProvider.getTransactions=mockTransactions;wallet.getSpendableVtxos=mockReceipts;wallet.settle=mockSettle;',context);
  await vm.runInContext('tick()',context);
  assert.equal(calls,0,'reconciliation must not resubmit already settled inputs');
  assert.equal(saved.operation.phase,wrongLink?'uncertain':'success');
  if(!wrongLink)assert.equal(saved.operation.commitment,'return');
 }
});

test('validation failures stop recovery and that decision survives reload',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 let calls=0;context.mockSettle=async()=>{calls++;throw Object.assign(new Error('invalid signature'),{name:'INVALID_INTENT_PROOF',code:23});};
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;',context);
 await elements.get('retry-existing').onclick();await new Promise(setImmediate);
 assert.equal(saved.operation.autoRecovery,false);
 assert.equal(saved.operation.retryAllowed,false);
 await vm.runInContext('tick()',context);assert.equal(calls,1);
 const restored=await app(saved.operation);
 assert.equal(restored.saved.operation.autoRecovery,false);
});

test('a prolonged transient outage keeps recovering with capped backoff until Step 6',async()=>{
 const {context,saved}=await app({...pending,phase:'uncertain',target:10000,change:0,autoRecovery:true,retryAllowed:true,recoveryAttempts:4,nextRecoveryAt:Date.now()+10000});
 let now=Date.now()+11000,calls=0;
 context.Date=class extends Date{static now(){return now;}};
 context.mockCoins=async()=>[{...pending.inputs[0],status:{confirmed:true}}];
 context.mockAddress=async()=>new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 context.mockSettle=async()=>{if(++calls<7)throw Object.assign(new Error('Network unavailable'),{name:'FetchError'});return 'board';};
 context.mockReceipts=async()=>calls>=7?[{value:10000,commitmentTxIds:['board']}]:[];
 context.mockTransactions=async()=>calls>=7?[{txid:'board',status:{confirmed:true},vin:[{txid:'funding',vout:0}],vout:[]}]:[];
 vm.runInContext('wallet.getBoardingUtxos=mockCoins;wallet.getAddress=mockAddress;wallet.settle=mockSettle;wallet.getSpendableVtxos=mockReceipts;wallet.onchainProvider.getTransactions=mockTransactions;',context);
 for(let attempt=1;attempt<=7;attempt++){
  await vm.runInContext('tick()',context);await new Promise(setImmediate);
  assert.equal(calls,attempt,'a prolonged temporary failure must not require another click');
  if(attempt<7){
   assert.equal(saved.operation.autoRecovery,true);
   assert.ok(saved.operation.nextRecoveryAt>now);
   assert.ok(saved.operation.nextRecoveryAt-now<=300000,'backoff must be capped at five minutes');
   now=saved.operation.nextRecoveryAt+1;
  }
 }
 assert.equal(saved.operation.phase,'success');
});
test('Reset & Restart is enabled during an unresolved signing attempt; cancel preserves it',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'registered',intent:'existing'});
 vm.runInContext('busy=true;signing=true;render();',context);
 assert.equal(elements.get('create').disabled,false);
 let confirmations=0;context.window.confirm=()=>{confirmations++;return false;};
 const before=structuredClone(saved);
 await elements.get('create').onclick();
 assert.equal(confirmations,1);
 assert.deepEqual(saved,before);
});
test('confirmed reset archives an unresolved account and reloads into the new account',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});
 context.window.confirm=()=>true;
 let reloads=0,rotations=0;
 context.window.location={reload(){reloads++;}};
 context.localStorage.clear=()=>{};
 let cleared=false;context.localStorage.clear=()=>{cleared=true;};
 context.identity=async(create,recreate)=>{
  assert.equal(create,true);assert.equal(recreate,true);rotations++;
  saved.archive={identity:saved.identity,operation:saved.operation};
  saved.identity={id:'new-account'};saved.operation={phase:'idle'};
  return {};
 };
 await elements.get('create').onclick();
 assert.equal(rotations,1);
 assert.equal(cleared,false,'restart must retain timing history for Last observed');
 assert.equal(saved.archive.operation.phase,'uncertain');
 assert.equal(reloads,1);
 assert.equal(elements.get('create').disabled,false);
});
test('manual restart prompts locally and cancellation leaves the current account intact',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});
 elements.get('seed-mode').value='manual';
 let prompts=0;context.window.prompt=()=>{prompts++;return null;};
 const before=structuredClone(saved);
 assert.equal(typeof elements.get('create')?.onclick,'function');
 await elements.get('create').onclick();
 assert.equal(prompts,1);assert.deepEqual(saved,before);
 assert.equal(elements.get('create').disabled,false);
});
test('manual restart validates before archiving and passes the entered phrase to encrypted storage',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});
 elements.get('seed-mode').value='manual';
 let rotations=0,reloads=0,confirmations=0;
 context.window.confirm=()=>{confirmations++;return true;};
 context.window.prompt=()=> 'invalid phrase';
 const before=structuredClone(saved);
 await elements.get('create').onclick();
 assert.deepEqual(saved,before);assert.equal(confirmations,0);
 const phrase=newRecoveryPhrase();
 context.window.prompt=()=>phrase;
 context.window.location={reload(){reloads++;}};context.localStorage.clear=()=>{};
 context.identity=async(create,recreate,entered)=>{
  assert.ok(entered===phrase,'The entered phrase must reach storage without being replaced');
  rotations++;saved.identity={id:'manual-account'};saved.operation={phase:'idle'};return {};
 };
 await elements.get('create').onclick();
 assert.equal(rotations,1);assert.equal(reloads,1);assert.equal(confirmations,1);
});

test('failed checkpoint does not change memory or submit and its original snapshot remains durable',async()=>{
 const {context,saved}=await app({...pending,phase:'prepared'});
 const before=structuredClone(saved.operation);
 context.write=async()=>{throw Object.assign(new Error('storage'),{name:'StorageError'});};
 await assert.rejects(vm.runInContext("save({phase:'submitting'})",context),{name:'StorageError'});
 assert.deepEqual(saved.operation,before);
 assert.equal(vm.runInContext('state.phase',context),'prepared');
});

test('confirmed restart still reloads after optional preference failure',async()=>{
 const {context,saved,elements}=await app({...pending,phase:'uncertain'});let reloads=0,rotations=0;
 context.window.confirm=()=>true;context.window.location={reload(){reloads++;}};
 context.localStorage.setItem=()=>{throw Error('quota');};
 context.identity=async()=>{rotations++;saved.identity={id:'replacement'};saved.operation={phase:'idle'};return {};};
 await elements.get('create').onclick();assert.equal(rotations,1);assert.equal(reloads,1);
});

test('late signing acknowledgement cannot overwrite a replacement account',async()=>{
 const {context,saved}=await app({...pending,phase:'uncertain'});let finish;
 context.mockSettle=()=>new Promise(resolve=>{finish=resolve;});
 saved.operation={...pending,phase:'submitting'};
 vm.runInContext('wallet.settle=mockSettle;launchSettlement({});',context);await new Promise(setImmediate);
 saved.identity={id:'replacement'};saved.operation={phase:'idle'};
 finish('old-commitment');await new Promise(setImmediate);
 assert.deepEqual(saved.operation,{phase:'idle'});
});

test('batch failure is recoverable after cleanup while batch validation stops signing',async()=>{
 for(const reason of ['not all participants submitted nonces','invalid proof']){
  const {context,saved,held}=await app({...pending,phase:'uncertain'});
  saved.operation={...pending,phase:'submitting',autoRecovery:true};
  context.mockSettle=async(_params,callback)=>{await callback({type:'batch_failed'});throw Error(reason);};
  vm.runInContext('wallet.settle=mockSettle;runRequested=true;launchSettlement({});',context);await new Promise(setImmediate);
  assert.equal(saved.operation.phase,'uncertain');assert.equal(held.has('standalone-settlement'),false);
  assert.equal(saved.operation.retryAllowed,reason!=='invalid proof');
 }
});

test('legacy failed-batch recovery preserves the same inputs and keeps a retry deadline',async()=>{
 const {saved}=await app({...pending,phase:'uncertain',autoRecovery:false,stage:'batch failed',failureSummary:'Error: Details withheld to protect wallet data'});
 assert.equal(saved.operation.autoRecovery,true);assert.equal(saved.operation.retryAllowed,true);
 assert.equal(saved.operation.failureCategory,'BatchFailedError');assert.ok(saved.operation.nextRecoveryAt>Date.now());
 assert.deepEqual(saved.operation.inputs,pending.inputs);
});

test('critical callback failure pauses signing even if the SDK ignores callback promises',async()=>{
 const {context,saved}=await app({...pending,phase:'uncertain'});let finish;
 saved.operation={...pending,phase:'submitting',autoRecovery:true};
 context.write=async()=>{throw Object.assign(new Error('storage'),{name:'StorageError'});};
 context.mockSettle=(_params,callback)=>{void callback({type:'batch_started'});return new Promise(resolve=>{finish=resolve;});};
 vm.runInContext('wallet.settle=mockSettle;launchSettlement({});',context);await new Promise(setImmediate);
 assert.equal(vm.runInContext('criticalFailure',context),true);
 finish('commitment');await new Promise(setImmediate);assert.notEqual(saved.operation.phase,'success');
});

test('a stale provider cannot register or delete an intent after account replacement',async()=>{
 let submissions=0;
 const {saved,provider}=await app({...pending,phase:'idle'},()=>{submissions++;return 'old-id';});
 saved.operation=structuredClone(pending);
 saved.identity={id:'replacement'};
 await assert.rejects(provider.registerIntent({}),{name:'StaleOperationError'});
 assert.equal(submissions,0,'identity fencing must happen before the network mutation');
 await assert.rejects(provider.deleteIntent({}),{name:'StaleOperationError'});
});

test('step 6 distinguishes spendable target from a pending Bitcoin confirmation',async()=>{
 const {context,elements}=await app({...pending,phase:'committed',commitment:'commitment'});
 context.mockReceipts=async()=>[{value:5000,commitmentTxIds:['commitment']}];
 vm.runInContext('wallet.getSpendableVtxos=mockReceipts;',context);
 await vm.runInContext('tick()',context);
 assert.match(elements.get('ready-status').textContent,/Bitcoin confirmation/);
 assert.match(elements.get('usable').textContent,/5,000 sats.*spendable/);
 assert.equal(vm.runInContext('state.phase',context),'committed');
});

test('startup disposes a wallet that finishes after its connection generation changes',async()=>{
 const {context}=await app({phase:'idle'});let finish,disposed=0;
 context.Wallet.create=()=>new Promise(resolve=>{finish=resolve;});
 const connecting=vm.runInContext('start()',context);await new Promise(setImmediate);
 vm.runInContext('connectionGeneration++;',context);
 finish({getBoardingAddress:async()=> 'tb1-test',dispose:async()=>{disposed++;}});
 await connecting;assert.equal(disposed,1);
});

test('faucet popup rejection preserves manual funding and never implies a deposit',async()=>{
 const {context,saved,elements}=await app({phase:'idle'});
 context.window.open=()=>{throw new Error('Popup blocked');};
 await elements.get('faucet').onclick();
 assert.match(elements.get('fund-status').textContent,/direct faucet link/);
 assert.equal(saved.operation.phase,'idle');assert.equal(vm.runInContext('depositSeen',context),false);
 context.window.open=()=>null;
 await elements.get('faucet').onclick();assert.equal(vm.runInContext('depositSeen',context),false);
 const markup=readFileSync(new URL('../src/layout.js',import.meta.url),'utf8');
 assert.match(markup,/href="https:\/\/signet\.2nd\.dev\/"/);
});

test('clipboard failure selects the public address for manual copy',async()=>{
 const {context,elements}=await app({phase:'idle'});let selected=0;
 context.navigator.clipboard={writeText:async()=>{throw Error('denied');}};
 elements.get('address').select=()=>{selected++;};
 await elements.get('copy').onclick();assert.equal(selected,1);
 assert.match(elements.get('copied').textContent,/copy.*manually/);
});

test('fresh account render never treats missing receipt fields as spendable evidence',async()=>{
 const {context,elements}=await app({phase:'idle'});
 vm.runInContext("accountId=undefined;wallet=undefined;state={phase:'idle'};spendableEvidence={};",context);
 assert.doesNotThrow(()=>vm.runInContext('render()',context));
 assert.match(elements.get('usable').textContent,/Not ready yet/);
 assert.doesNotMatch(elements.get('ready-status').textContent,/target spendable/);
});

test('batch acknowledgement is observable and a stale account cannot send it',async()=>{
 const {provider,saved,context,elements}=await app({phase:'idle'});
 saved.operation={...pending,phase:'registered',intent:'registered-id'};
 await provider.confirmRegistration('registered-id');
 assert.equal(context.confirmCalls,1);
 assert.match(elements.get('callback-errors').textContent,/Batch participation confirmed/);
 saved.identity={id:'replacement'};
 await assert.rejects(provider.confirmRegistration('registered-id'),{name:'StaleOperationError'});
 assert.equal(context.confirmCalls,1);
});

test('a failed earlier batch cannot interrupt an intent queued for the next batch',async()=>{
 const {context}=await app({phase:'idle'});
 context.TextEncoder=TextEncoder;context.crypto.subtle=crypto.subtle;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('our-intent'));
 const hash=Buffer.from(digest).toString('hex');
 context.currentIntent=undefined;
 context.testEvents=async function*(){
  yield {type:'batch_started',id:'earlier-batch',intentIdHashes:[]};
  yield {type:'batch_failed',id:'earlier-batch',reason:'not enough intent confirmations received'};
  yield {type:'batch_started',id:'our-batch',intentIdHashes:[hash]};
  yield {type:'batch_failed',id:'different-batch',reason:'unrelated'};
  yield {type:'batch_failed',id:'our-batch',reason:'real failure'};
 };
 const stream=vm.runInContext('watchedSettlementStream(testEvents,new AbortController().signal,[],()=>currentIntent)',context);
 assert.equal((await stream.next()).value.id,'earlier-batch');
 // SDK primes its stream before registration, then consumes it after registration.
 context.currentIntent='our-intent';
 assert.equal((await stream.next()).value.id,'our-batch','ignore failure from a batch that did not select this intent');
 const actualFailure=(await stream.next()).value;
 assert.equal(actualFailure.type,'batch_failed');assert.equal(actualFailure.id,'our-batch');
 await stream.return();
});

test('unselected batch traffic cannot postpone the settlement recovery deadline',async()=>{
 const {context,timeouts}=await app({phase:'idle'});
 context.TextEncoder=TextEncoder;context.crypto.subtle=crypto.subtle;
 context.testEvents=async function*(signal){
  yield {type:'batch_started',id:'other-one',intentIdHashes:[]};
  yield {type:'batch_failed',id:'other-one'};
  yield {type:'batch_started',id:'other-two',intentIdHashes:[]};
  await new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',resolve,{once:true});});
 };
 const stream=vm.runInContext("watchedSettlementStream(testEvents,new AbortController().signal,[],()=> 'queued-intent')",context);
 try{
  await stream.next();
  const [deadlineId,deadline]=[...timeouts].find(([,timer])=>timer.ms===300000);
  await stream.next();
  assert.equal(timeouts.has(deadlineId),true,'unrelated traffic must not restart the five-minute deadline');
  const waiting=stream.next();
  const failed=assert.rejects(waiting,{name:'SettlementStreamTimeoutError'});
  deadline.fn();await failed;
  assert.equal(timeouts.size,0);
 }finally{await stream.return();}
});

test('matching batch progress renews the deadline after pre-registration stream priming',async()=>{
 const {context,timeouts}=await app({phase:'idle'});
 context.TextEncoder=TextEncoder;context.crypto.subtle=crypto.subtle;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('our-intent'));
 context.currentIntent=undefined;
 context.testEvents=async function*(){
  yield {type:'batch_started',id:'ours',intentIdHashes:[Buffer.from(digest).toString('hex')]};
  yield {type:'tree_tx',id:'ours'};
  yield {type:'batch_started',id:'another',intentIdHashes:[]};
  yield {type:'tree_signing_started',id:'ours'};
 };
 const stream=vm.runInContext('watchedSettlementStream(testEvents,new AbortController().signal,[],()=>currentIntent)',context);
 const deadlineId=()=>[...timeouts].find(([,timer])=>timer.ms===300000)[0];
 try{
  await stream.next();const initial=deadlineId();
  context.currentIntent='our-intent';
  await stream.next();const progress=deadlineId();
  assert.notEqual(progress,initial,'our batch selection and tree progress renew the initial deadline');
  await stream.next();assert.equal(deadlineId(),progress,'another batch is not progress');
  await stream.next();assert.notEqual(deadlineId(),progress,'our next signing stage renews the deadline');
 }finally{await stream.return();}
 assert.equal(timeouts.size,0);
});
