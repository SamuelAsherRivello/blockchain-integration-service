import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,getControls} from '../src/core/context.ts';
const tick=()=>new Promise(r=>setImmediate(r));
test('payment observer runs with Account closed, reconnects silently and stops on replacement/disposal',async()=>{
 let account={profileId:'player',phrase:'fixture-only'},changed,publish,signal;
 const storage={load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:l=>{changed=l;return()=>{};}};
 const observer=async(_a,s,p)=>{signal=s;publish=p;p([]);await new Promise(r=>s.addEventListener('abort',r,{once:true}));};
 const c=createContext(storage,undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,async()=>{},undefined,undefined,undefined,undefined,undefined,{},observer);
 await c.ready();await tick();assert.ok(publish);assert.equal(c.getState().accountActivity,false);
 publish([{id:'new',identifier:'ark:new',direction:'Incoming',amountSats:1234,status:'Settled offchain'}]);
 assert.equal(getControls(c).toasts.getSnapshot().message,'Unknown User Sent You 1234 Sats');
 const oldSignal=signal,oldPublish=publish;account={profileId:'other',phrase:'fixture-only'};changed();await tick();await tick();
 assert.equal(oldSignal.aborted,true);assert.equal(getControls(c).toasts.getSnapshot(),null);
 oldPublish([{id:'late',identifier:'ark:late',direction:'Incoming',amountSats:10,status:'Settled offchain'}]);
 assert.equal(getControls(c).toasts.getSnapshot(),null);c.dispose();assert.equal(signal.aborted,true);
});
