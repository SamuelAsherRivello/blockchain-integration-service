import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHistory, observeActivityWallet } from '../src/arkade/activity.ts';
import { createContext } from '../src/core/context.ts';
import { formatTransactions } from '../src/core/activity.ts';
const tick=()=>new Promise(r=>setImmediate(r));
const tx=(id,createdAt=0,extra={})=>({key:{boardingTxid:id,arkTxid:'',commitmentTxid:''},amount:100,type:'RECEIVED',settled:false,createdAt,...extra});
test('confirmation counts use chain tip and confirmed height, never timestamps',()=>{
 const coin={txid:'a',vout:0,value:100,status:{confirmed:true,block_height:100}};
 assert.deepEqual(normalizeHistory([tx('a')],[coin],102)[0].bitcoin,{txid:'a',confirmations:3,blockHeight:100});
 assert.equal(normalizeHistory([tx('a')],[{...coin,status:{confirmed:false}}],102)[0].bitcoin.confirmations,0);
 assert.equal(normalizeHistory([tx('a')],[coin])[0].bitcoin.confirmations,undefined);
 assert.equal(normalizeHistory([tx('a')],[coin],99)[0].bitcoin.confirmations,undefined);
 assert.equal(normalizeHistory([tx('a',123)],[],102)[0].bitcoin.confirmations,undefined);
 assert.equal(normalizeHistory([tx('',0,{key:{arkTxid:'offchain'},settled:true})],[],102)[0].bitcoin,undefined);
});
test('all SDK history retained; newest first with undated pending first, outgoing and spent records',()=>{
  const rows=normalizeHistory([tx('old',100,{settled:true}),tx('new',200),tx('pending'),tx('',0,{key:{boardingTxid:'',arkTxid:'send',commitmentTxid:''},type:'SENT',settled:true})],[]);
  assert.deepEqual(rows.map(r=>r.identifier),['pending','new','old','ark:send']);
  assert.equal(rows[2].status,'Confirmed'); assert.equal(rows[3].status,'Settled offchain');
  assert.match(formatTransactions(rows),/100 sats \| Outgoing \| Settled offchain \| ark:send/);
  assert.equal(formatTransactions(rows).split('\n').length,4);
  assert.ok(Object.isFrozen(rows)); assert.ok(Object.isFrozen(rows[0]));
});
test('outpoints only when unambiguous; multiple history outputs preserved; invalid amount rejected',()=>{
  const coins=[{txid:'a',vout:0,value:100,status:{confirmed:false}},{txid:'a',vout:1,value:100,status:{confirmed:false}}];
  const rows=normalizeHistory([tx('a'),tx('a')],coins);
  assert.equal(rows.length,2); assert.notEqual(rows[0].id,rows[1].id);assert.equal(rows[0].identifier,'a');
  assert.equal(normalizeHistory([tx('a')],coins.slice(0,1))[0].identifier,'a:0');
  assert.throws(()=>normalizeHistory([tx('a',0,{amount:NaN})],[]));
});
test('wallet watcher reconciles snapshots and stops on abort',async()=>{
  let notify, history=[tx('a')], stopped=0,disposed=0;const results=[];
  const controller=new AbortController();
  const wallet={getTransactionHistory:async()=>history,getBoardingUtxos:async()=>[],getProviderConnectionState:()=>({mode:'online',source:'live'}),notifyIncomingFunds:async cb=>{notify=cb;return()=>stopped++;},dispose:async()=>{disposed++;}};
  const run=observeActivityWallet(Promise.resolve(wallet),controller.signal,r=>results.push(r),()=>true,10000);
  await tick(); assert.equal(results[0].length,1);
  history=[tx('a',100),tx('b')];notify({});notify({});await tick();
  assert.equal(results.at(-1).length,2);assert.equal(results.at(-1)[1].status,'Confirmed');
  history=[];notify({});await tick();assert.equal(results.at(-1).length,0);
  controller.abort();await run;assert.equal(stopped,1);assert.equal(disposed,1);
});

test('watcher refreshes confirmations and retains history when chain tip fails or stalls',async()=>{
 let notify,mode='live',height=100;
 const controller=new AbortController(),results=[];
 const wallet={getTransactionHistory:async()=>[tx('a')],getBoardingUtxos:async()=>[{txid:'a',vout:0,value:100,status:{confirmed:true,block_height:100}}],onchainProvider:{getChainTip:async()=>{if(mode==='fail')throw Error('unavailable');if(mode==='stall')return new Promise(()=>{});return {height};}},getProviderConnectionState:()=>({mode:'online',source:'live'}),notifyIncomingFunds:async cb=>{notify=cb;return()=>{};},dispose:async()=>{}};
 const run=observeActivityWallet(Promise.resolve(wallet),controller.signal,r=>results.push(r),()=>true,10000,100);
 try {
  await tick();assert.equal(results.at(-1)[0].bitcoin.confirmations,1);
  height=102;notify({});await tick();assert.equal(results.at(-1)[0].bitcoin.confirmations,3);
  mode='fail';notify({});await tick();assert.equal(results.at(-1)[0].bitcoin.confirmations,undefined);
  mode='stall';notify({});await new Promise(r=>setTimeout(r,70));assert.equal(results.length,4);assert.equal(results.at(-1)[0].bitcoin.confirmations,undefined);
 } finally {controller.abort();await run;}
});
test('failure after success clears observer, rejects and disposes; late acquisition disposes',async()=>{
  let notify,fail=false,disposed=0;
  const wallet={getTransactionHistory:async()=>{if(fail)throw Error('private');return[];},getBoardingUtxos:async()=>[],getProviderConnectionState:()=>({mode:'online',source:'live'}),notifyIncomingFunds:async cb=>{notify=cb;return()=>{};},dispose:async()=>disposed++};
  const run=observeActivityWallet(Promise.resolve(wallet),new AbortController().signal,()=>{});
  const rejection=assert.rejects(run,/Activity unavailable/);
  await tick();fail=true;notify({});await rejection;assert.equal(disposed,1);
  let resolve;const pending=new Promise(r=>resolve=r),abort=new AbortController();
  const late=observeActivityWallet(pending,abort.signal,()=>assert.fail('late publish'));
  const stopped=assert.rejects(late);abort.abort();await stopped;resolve(wallet);await tick();assert.equal(disposed,2);
});
function setup(){
  let account={phrase:'isolated',profileId:'one'},generation=0,publish,signal;const listeners=new Set();
  const storage={load:async()=>({account,generation}),save:async()=>{},reset:async()=>{account=null;generation++;listeners.forEach(l=>l());},subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);}};
  const context=createContext(storage,undefined,async()=>account?.profileId,undefined,async()=>({availableSats:0,totalSats:0}),undefined,async()=>({bitcoinAddress:'test',arkadeAddress:'test'}),async(a,s,p)=>{signal=s;publish=p;await new Promise(r=>s.addEventListener('abort',r,{once:true}));});
  return{context,storage,publish:()=>publish,signal:()=>signal,replace(){account={phrase:'other',profileId:'two'};generation++;listeners.forEach(l=>l());}};
}
test('degraded connection or latched provider failure never publishes history',async()=>{
  for(const mode of ['degraded','latched']){
    let disposed=0;
    const wallet={getTransactionHistory:async()=>[tx('a')],getBoardingUtxos:async()=>[],getProviderConnectionState:()=>({mode:mode==='degraded'?'degraded':'online',source:'live'}),notifyIncomingFunds:async()=>()=>{},dispose:async()=>disposed++};
    await assert.rejects(observeActivityWallet(Promise.resolve(wallet),new AbortController().signal,()=>assert.fail('unhealthy publish'),()=>mode!=='latched'));
    assert.equal(disposed,1);
  }
});
test('Account Activity lifecycle: no menu read, Back, switch, account change, logout, disposal',async()=>{
  for(const action of ['back','details','replace','logout','dispose','reset']){
    const s=setup();const c=s.context;await c.ready();c.openAccountDialog();await tick();assert.equal(s.publish(),undefined);
    c.openAccountActivity();await tick();const publish=s.publish();publish(normalizeHistory([tx('a')],[]));assert.equal(c.getState().activity.status,'ready');
    if(action==='back')c.closeAccount();if(action==='details')c.openAccountDetails();if(action==='replace')s.replace();if(action==='logout')c.openLogoutConfirmation();if(action==='dispose')c.dispose();if(action==='reset')await s.storage.reset();
    await tick();assert.equal(s.signal().aborted,true);publish(normalizeHistory([tx('late')],[]));assert.equal(c.getState().activity.status,'idle');c.dispose();
  }
});
