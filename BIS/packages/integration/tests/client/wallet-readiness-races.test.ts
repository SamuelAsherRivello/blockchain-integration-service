import test from 'node:test';
import assert from 'node:assert/strict';
import {createBisContinue} from '../../src/client/state-layer-core/game-continue.ts';
import {createLocalGameWallet} from '../../src/client/state-layer-core/game-wallet.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

for(const stage of ['addresses','balance','observation'])for(const replacement of ['logout','network','relogin','dispose'])test(`obsolete Game Wallet ${stage} completion after ${replacement} stays suppressed`,async()=>{
 let player='player',network='signet',phase='active',notify,unsubscribed=0,observed;
 const pending=deferred();let blocked=stage!=='observation';
 const balance={availableSats:2000,totalSats:2000,arkadeSats:2000,bitcoinSats:0};
 const wallet=createLocalGameWallet({playerProfileId:()=>player,playerNetwork:()=>network,playerSessionKey:()=>JSON.stringify([player,network,phase]),playerSubscribe:l=>{notify=l;return()=>{unsubscribed++;};}}, {
  storage:{load:async()=>({profileId:'game',network}),subscribe:()=>()=>{},dispose(){}},restore:async()=>{},
  addresses:async()=>stage==='addresses'&&blocked?pending.promise:{arkadeAddress:'current-'+network,bitcoinAddress:'bitcoin'},
  balance:async()=>stage!=='addresses'&&blocked?pending.promise:balance,
  watch:async(_address,_signal,callback)=>{observed=callback;},
 });
 await tick();
 let observation;if(stage==='observation'){assert.equal(wallet.getState().status,'ready');blocked=true;observation=observed();await tick();}
 blocked=false;
 if(replacement==='dispose')wallet.dispose();
 else if(replacement==='logout'){player=undefined;notify();}
 else if(replacement==='network'){network='mutinynet';notify();}
 else{phase='idle';notify();phase='active';notify();}
 await tick();const current=wallet.getState();
 pending.resolve(stage==='addresses'?{arkadeAddress:'obsolete',bitcoinAddress:'old'}:{...balance,availableSats:999});
 if(observation)await observation;await tick();assert.deepEqual(wallet.getState(),current);
 wallet.dispose();assert.equal(unsubscribed,1);
});

test('Continue coalesces identical notifications and a fresh controller retries unavailable eligibility',async()=>{
 let notify,reads=0;const pending=deferred();
 const context={getState:()=>({hasProfile:true,phase:'active',profileId:'p',network:'signet'}),subscribe:l=>{notify=l;return()=>{};},getContinueAvailability:()=>{reads++;return pending.promise;},showToast(){}};
 const c=createBisContinue(context,{context:'coalesce',onSuccess(){}});const ready=c.readyAsync();
 notify();notify();assert.equal(reads,1);pending.resolve({canPay:false,reason:'Balance unavailable'});await ready;assert.equal(c.getState().canPay,false);c.dispose();
 context.getContinueAvailability=async()=>({canPay:true});const retry=createBisContinue(context,{context:'retry',onSuccess(){}});await retry.readyAsync();assert.equal(retry.getState().canPay,true);retry.dispose();
});

for(const order of ['old-first','new-first'])test(`Continue readiness follows superseding balance evidence: ${order}`,async()=>{
 let state={hasProfile:true,phase:'active',profileId:'p',network:'signet',balance:{arkadeSats:1000}},notify;
 const reads=[],submitted=[];
 const c=createBisContinue({getState:()=>state,subscribe:l=>{notify=l;return()=>{};},showToast(){},getContinueAvailability:()=>{const read=deferred();reads.push(read);return read.promise;},requestContinue:async r=>{submitted.push(r);return {...r,profileId:'p',status:'succeeded'};}},{context:'race',onSuccess(){}});
 let ready=false;const waiting=c.readyAsync().then(()=>{ready=true;});
 state={...state,balance:{arkadeSats:2000}};notify();
 assert.equal(reads.length,2);
 if(order==='old-first'){reads[0].resolve({canPay:false});await tick();assert.equal(ready,false);reads[1].resolve({canPay:true});}
 else{reads[1].resolve({canPay:true});await tick();reads[0].resolve({canPay:false});}
 await waiting;assert.equal(c.getState().canPay,true);await c.pay();assert.equal(submitted.length,1);c.dispose();
});

for(const replacement of ['player','network','recipient','relogin','dispose'])test(`Continue preparation cannot cross ${replacement}`,async()=>{
 let state={hasProfile:true,phase:'active',profileId:'p',network:'signet'},recipient='game',notify;
 const read=deferred();let submitted=0;
 const c=createBisContinue({getState:()=>state,subscribe:l=>{notify=l;return()=>{};},getContinueRecipient:()=>recipient,showToast(){},getContinueAvailability:()=>read.promise,requestContinue:async()=>{submitted++;}},{context:'scope',onSuccess(){assert.fail();}});
 const wait=c.readyAsync();
 if(replacement==='dispose')c.dispose();
 else if(replacement==='recipient'){recipient='other';notify();}
 else if(replacement==='relogin'){state={...state,phase:'idle',hasProfile:false};notify();state={...state,phase:'active',hasProfile:true};notify();}
 else{state={...state,...(replacement==='player'?{profileId:'other'}:{network:'mutinynet'})};notify();}
 read.resolve({canPay:true});await wait;await c.pay();assert.equal(submitted,0);c.dispose();
});

for(const outcome of ['role-conflict','network-mismatch','empty','error'])test(`obsolete Game Wallet storage ${outcome} cannot replace ready state`,async()=>{
 const reads=[];const wallet=createLocalGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'signet'}, {
  storage:{load:()=>{const d=deferred();reads.push(d);return d.promise;},subscribe:()=>()=>{},dispose(){}},restore:async()=>{},
  addresses:async()=>({arkadeAddress:'game',bitcoinAddress:'bitcoin'}),balance:async()=>({availableSats:2000,totalSats:2000,arkadeSats:2000,bitcoinSats:0}),watch:undefined,
 });
 const fresh=wallet.refresh();reads[1].resolve({profileId:'game',network:'signet'});await fresh;const ready=wallet.getState();assert.equal(ready.status,'ready');
 if(outcome==='error')reads[0].reject(Error('old storage failure'));
 else reads[0].resolve(outcome==='empty'?null:{profileId:outcome==='role-conflict'?'player':'other',network:outcome==='network-mismatch'?'mutinynet':'signet'});
 await tick();assert.deepEqual(wallet.getState(),ready);wallet.dispose();
});
