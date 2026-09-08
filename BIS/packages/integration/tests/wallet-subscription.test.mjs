import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,getControls} from '../src/core/context.ts';
const tick=()=>new Promise(r=>setImmediate(r));
function setup(readBalance) {
 let account={profileId:'wallet',phrase:'fixture-only'},generation=0,changed,rows=[],sats=2000,holdings=[];
 const sources=[];
 const observer=async(a,signal,publish)=>{sources.push({signal,publish});publish(rows);await new Promise(r=>signal.addEventListener('abort',r,{once:true}));};
 const storage={load:async()=>({account,generation}),save:async()=>{},reset:async()=>{},subscribe:l=>{changed=l;return()=>{};}};
 const c=createContext(storage,undefined,async()=>account.profileId,undefined,readBalance ?? (async()=>({availableSats:sats,totalSats:sats,bitcoinSats:0,arkadeSats:sats})),undefined,undefined,observer,undefined,{list:async()=>holdings,mint:async()=>{}},undefined,undefined,undefined,{},observer);
 return {c,sources,emit(next,amount=sats,assets=holdings){rows=next;sats=amount;holdings=assets;sources.at(-1)?.publish(rows);},replace(){account={profileId:'other',phrase:'fixture-only'};generation++;changed();}};
}
test('shared wallet observation updates outgoing balance without a receipt toast',async()=>{
 const s=setup();try{
 await s.c.ready();await tick();s.c.openAccountDialog();s.c.openAccountDetails();await tick();
 assert.equal(s.c.getState().balance.arkadeSats,2000);
 s.emit([{id:'out',identifier:'ark:out',amountSats:1000,direction:'Outgoing',status:'Settled offchain'}],1000);await tick();
 assert.equal(s.c.getState().balance.arkadeSats,1000);assert.equal(getControls(s.c).toasts.getSnapshot(),null);
 }finally{s.c.dispose();}
});

test('failed background reconciliation clears the displayed balance',async()=>{
 let offline=false;
 const s=setup(async()=>{if(offline)throw Error('offline');return {availableSats:2000,totalSats:2000,bitcoinSats:0,arkadeSats:2000};});
 try {
 await s.c.ready();await tick();s.c.openAccountDialog();s.c.openAccountDetails();await tick();
 offline=true;s.emit([]);await tick();
 assert.deepEqual(s.c.getState().balance,{status:'unavailable'});
 }finally{s.c.dispose();}
});

test('a pre-change balance read cannot overwrite the replacement read',async()=>{
 let release,oldSignal,reads=0;
 const amounts=sats=>({availableSats:sats,totalSats:sats,bitcoinSats:0,arkadeSats:sats});
 const s=setup(async(a,signal)=>{reads++;if(reads===1){oldSignal=signal;return new Promise(r=>release=()=>r(amounts(2000)));}return amounts(1000);});
 try {
 await s.c.ready();await tick();s.c.openAccountDialog();s.c.openAccountDetails();await tick();
 s.emit([]);await tick();assert.equal(oldSignal.aborted,true);assert.equal(s.c.getState().balance.arkadeSats,1000);
 release();await tick();assert.equal(s.c.getState().balance.arkadeSats,1000);
 }finally{s.c.dispose();}
});

test('manual Activity refresh requests a new source and later confirmations use that source',async()=>{
 const s=setup();try {
 await s.c.ready();await tick();s.c.openAccountDialog();s.c.openAccountActivity();await tick();
 const old=s.sources[0];void s.c.refreshActivity();await tick();assert.equal(old.signal.aborted,true);assert.equal(s.sources.length,2);
 const row={id:'deposit',identifier:'tx:0',amountSats:100,direction:'Incoming',status:'Pending',bitcoin:{txid:'tx',confirmations:0}};
 s.emit([row]);await tick();assert.equal(s.c.getState().activity.transactions[0].status,'Pending');
 s.emit([{...row,status:'Confirmed',bitcoin:{txid:'tx',confirmations:1}}]);await tick();
 assert.equal(s.c.getState().activity.transactions[0].bitcoin.confirmations,1);assert.equal(s.sources.length,2);
 }finally{s.c.dispose();}
});
test('one retained source serves Activity navigation and rejects old-account callbacks',async()=>{
 const s=setup();try{
 await s.c.ready();await tick();assert.equal(s.sources.length,1);
 s.c.openAccountDialog();s.c.openAccountActivity();await tick();assert.equal(s.sources.length,1);
 s.c.closeAccount();s.c.openAccountActivity();await tick();assert.equal(s.sources.length,1);
 const old=s.sources[0];s.replace();await tick();await tick();assert.equal(old.signal.aborted,true);
 old.publish([{id:'late',identifier:'ark:late',amountSats:5,direction:'Incoming',status:'Settled offchain'}]);
 assert.equal(getControls(s.c).toasts.getSnapshot(),null);
 }finally{s.c.dispose();if(s.sources.length)assert.equal(s.sources.at(-1).signal.aborted,true);}
});
test('asset-only wallet observations refresh visible holdings',async()=>{
 const s=setup();try{
 await s.c.ready();await tick();s.c.openAccountDialog();s.c.openAccountAssets();await tick();
 assert.deepEqual(s.c.getState().assets.assets,[]);
 s.emit([],2000,[{assetId:'asset',quantity:'3'}]);await tick();
 assert.deepEqual(s.c.getState().assets.assets,[{assetId:'asset',quantity:'3'}]);
 }finally{s.c.dispose();}
});

test('background reconnect restores visible Activity and does not replay receipt toasts',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let fail,starts=0;
 const row={id:'existing',identifier:'ark:existing',amountSats:1000,direction:'Incoming',status:'Settled offchain'};
 const observer=async(a,s,p)=>{starts++;p([row]);await new Promise((resolve,reject)=>{fail=reject;s.addEventListener('abort',resolve,{once:true});});};
 const account={profileId:'retry',phrase:'fixture-only'};
 const c=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,observer,undefined,undefined,undefined,undefined,undefined,{},observer);
 try {
 await c.ready();await tick();c.openAccountDialog();c.openAccountActivity();await tick();assert.equal(starts,1);
 fail(Error('offline'));await tick();assert.equal(c.getState().activity.status,'unavailable');
 t.mock.timers.tick(10000);await tick();await tick();assert.equal(starts,2);assert.equal(c.getState().activity.status,'ready');
 assert.equal(getControls(c).toasts.getSnapshot(),null);
 }finally{c.dispose();}
});

