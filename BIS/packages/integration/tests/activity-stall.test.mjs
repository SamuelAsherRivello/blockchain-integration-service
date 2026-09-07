import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHistory,observeActivityWallet} from '../src/arkade/activity.ts';
import {formatTransactions} from '../src/core/activity.ts';
const never=()=>new Promise(()=>{});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const tx={key:{arkTxid:'a'.repeat(64),boardingTxid:'',commitmentTxid:''},amount:0,type:'RECEIVED',settled:false,createdAt:100};
const wallet=()=>({getTransactionHistory:async()=>[tx],getBoardingUtxos:async()=>[],getProviderConnectionState:()=>({mode:'online',source:'live'}),notifyIncomingFunds:async()=>()=>{},dispose:async()=>{}});

test('live history can finish after ten seconds of SDK historical lookups',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const controller=new AbortController(),rows=[];
 const run=observeActivityWallet(Promise.resolve({...wallet(),getTransactionHistory:async()=>{await pause(12000);return [tx];}}),controller.signal,r=>rows.push(r)).catch(()=>{});
 await new Promise(r=>setImmediate(r));
 t.mock.timers.tick(10001);await new Promise(r=>setImmediate(r));
 t.mock.timers.tick(1999);await new Promise(r=>setImmediate(r));
 controller.abort();await run;
 assert.equal(rows.length,1,'successful historical reads must not be discarded at ten seconds');
});
test('history loads without waiting for a stalled subscription',async()=>{
 const controller=new AbortController(),rows=[];
 const run=observeActivityWallet(Promise.resolve({...wallet(),notifyIncomingFunds:never}),controller.signal,r=>rows.push(r),()=>true,1000,30).catch(()=>{});
 try {await pause(15);assert.equal(rows.length,1,'history must publish before subscription finishes');}
 finally {controller.abort();await run;}
});
test('history failure is reported even when SDK disposal never resolves',async()=>{
 const controller=new AbortController();
 const run=observeActivityWallet(Promise.resolve({...wallet(),getTransactionHistory:async()=>{throw Error('network');},dispose:never}),controller.signal,()=>{},()=>true,1000,30).then(()=> 'resolved',()=> 'rejected');
 const result=await Promise.race([run,pause(75).then(()=> 'stuck')]);
 controller.abort();assert.equal(result,'rejected','cleanup must not block error publication');
});
test('asset history retains exact quantities and identifiers in Transactions and copied text',()=>{
 const rows=normalizeHistory([{...tx,assets:[{assetId:'asset-example',amount:9007199254740993n}]}],[]);
 assert.deepEqual(rows[0].assets,[{assetId:'asset-example',quantity:'9007199254740993'}]);
 assert.match(formatTransactions(rows),/9007199254740993 base units.*asset-example/);
});

test('Transactions loads signed SDK asset deltas after a burn without retrying valid history',async()=>{
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'signed-history-fixture',phrase:'isolated-placeholder'};
 let reads=0;
 // SDK subtractAssets computes change minus spent: outgoing asset deltas can be negative.
 const history=[tx,{...tx,key:{...tx.key,arkTxid:'b'.repeat(64)},type:'SENT',settled:true,
   assets:[{assetId:'burned-asset',amount:-9007199254740993n},{assetId:'minted-asset',amount:1n}]}];
 const c=createContext({load:async()=>({account,generation:0}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,
   (_account,signal,publish)=>observeActivityWallet(Promise.resolve({...wallet(),getTransactionHistory:async()=>{reads++;return history;}}),signal,publish));
 try {
   await c.ready();c.openAccountDialog();c.openAccountActivity();
   await new Promise(resolve=>setImmediate(resolve));
   const activity=c.getState().activity;
   assert.equal(activity.status,'ready','a valid signed asset delta must not fail the whole history page');
   assert.equal(reads,1,'valid history must not consume the automatic retry');
   assert.equal(activity.transactions.length,2,'ordinary transactions are retained alongside asset history');
   const outgoing=activity.transactions.find(row=>row.direction==='Outgoing');
   assert.deepEqual(outgoing.assets,[{assetId:'burned-asset',quantity:'-9007199254740993'},{assetId:'minted-asset',quantity:'1'}]);
   assert.match(formatTransactions(activity.transactions),/-9007199254740993 base units/);
 } finally {c.dispose();}
});

test('Activity leaves Loading and ignores late results when its observer never settles',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'test',phrase:'test-placeholder'};
 let publish,signal;
 const c=createContext({load:async()=>({account,generation:0}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,async(_a,s,p)=>{signal=s;publish=p;await never();});
 await c.ready();c.openAccountDialog();c.openAccountActivity();await new Promise(r=>setImmediate(r));
 assert.equal(c.getState().activity.status,'loading');t.mock.timers.tick(15000);
 assert.equal(c.getState().activity.status,'loading');t.mock.timers.tick(60000);
 await new Promise(r=>setImmediate(r));assert.equal(c.getState().activity.status,'loading');t.mock.timers.tick(75000);await new Promise(r=>setImmediate(r));assert.equal(c.getState().activity.status,'unavailable');assert.equal(signal.aborted,true);
 publish(normalizeHistory([tx],[]));assert.equal(c.getState().activity.status,'unavailable');
 c.closeAccount();assert.equal(c.getState().accountActivity,false);c.dispose();
});

test('mint operations show exact decimal quantities, pending status, and deduplicate known transaction IDs',async()=>{
 const {withMintActivity}=await import('../src/core/activity.ts');
 const record={request:{operationId:'mint-1',name:'Test Token',ticker:'TEST',amount:'90071992547409.93',decimals:2},status:'pending'};
 const local=withMintActivity([], [record]);
 assert.match(formatTransactions(local),/Sats not yet reported.*Mint.*Pending — outcome unknown.*90071992547409.93 TEST.*ID pending/);
 const sdk=normalizeHistory([{...tx,assets:[{assetId:'asset-id',amount:9007199254740993n}]}],[]);
 const merged=withMintActivity(sdk,[{...record,status:'succeeded',transactionId:tx.key.arkTxid,asset:{assetId:'asset-id',quantity:'9007199254740993'}}]);
 assert.equal(merged.length,1);assert.equal(merged[0].kind,'Asset mint');assert.equal(merged[0].status,'Pending offchain');
});

test('a failed activity refresh preserves the last successful transaction snapshot',async()=>{
 const {createContext}=await import('../src/core/context.ts');
 const account={profileId:'history-preservation',phrase:'isolated-placeholder'};
 let rejectRead;
 const rows=normalizeHistory([tx],[]);
 const c=createContext({load:async()=>({account,generation:0}),subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,
  async(_account,signal,publish)=>{publish(rows);await new Promise((resolve,reject)=>{rejectRead=reject;signal.addEventListener('abort',resolve,{once:true});});});
 try {
  await c.ready();c.openAccountDialog();c.openAccountActivity();await new Promise(r=>setImmediate(r));
  assert.equal(c.getState().activity.status,'ready');
  rejectRead(Error('network'));await new Promise(r=>setImmediate(r));
  assert.equal(c.getState().activity.status,'unavailable');
  assert.deepEqual(c.getState().activity.transactions,rows,'loaded records remain usable during a network failure');
 } finally {c.dispose();}
});
