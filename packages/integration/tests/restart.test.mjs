import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, createBisAdminContext } from '../src/core/context.ts';

function fixture() {
  let record = {generation:0,account:{phrase:'fixture-only',profileId:'profile-a'}};
  const listeners=new Set(); let clears=0;
  const notify=()=>{for(const listener of listeners)listener();};
  const storage={load:async()=>record,save:async()=>{},subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    reset:async(expected,options)=>{clears++; record={generation:record.generation+1,account:null,...(options ? {logout:{id:'logout-one',profileId:'profile-a',generation:record.generation+1}} : {})};notify();}};
  const make=()=>createContext(storage,async()=>{throw Error('unexpected create');},async()=>record.account?.profileId??'profile-a');
  return {storage,make,notify,clears:()=>clears,replace(){record={generation:2,account:{phrase:'fixture-b',profileId:'profile-b'}};notify();}};
}
async function logout(c){await c.ready();c.openAccountDialog();c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);await c.confirmLogout();}

test('non-reloading hosts receive restart after invalidation, once per affected context',async()=>{
  const f=fixture(),a=f.make(),b=f.make(),ae=[],be=[];
  await Promise.all([a.ready(),b.ready()]);
  for(const [c,events] of [[a,ae],[b,be]])c.onEvent(e=>{assert.equal(c.getState().hasProfile,false);assert.equal(c.getState().profileId,undefined);events.push(e);});
  await logout(a);await b.ready();f.notify();await b.ready();
  for(const events of [ae,be])assert.deepEqual(events.map(e=>e.type),['accountDisconnected','restartRequested']);
  assert.equal(ae[1].logoutId,be[1].logoutId);assert.equal(f.clears(),1);
  const fresh=f.make();await fresh.ready();assert.equal(fresh.getState().hasProfile,false);
  a.dispose();b.dispose();fresh.dispose();
});
test('throwing host cannot turn completed cleanup into logout-error or repeat cleanup',async()=>{
  const f=fixture(),c=f.make(); const old=console.error;const reports=[];console.error=(message)=>reports.push(message);
  try{c.onEvent(()=>{throw Error('host private detail');});await logout(c);assert.equal(c.getState().phase,'idle');await c.retry();assert.equal(f.clears(),1);assert.equal(reports.length,2);assert.ok(reports.every(r=>!r.includes('private detail')));}finally{console.error=old;c.dispose();}
});
test('cancel, initial absence, admin reset and disposal do not request restart',async()=>{
  const f=fixture(),c=f.make(),events=[];c.onEvent(e=>events.push(e));await c.ready();c.openAccountDialog();c.openLogoutConfirmation();c.cancelLogout();await createBisAdminContext(c).resetClient();assert.equal(events.some(e=>e.type==='restartRequested'),false);c.dispose();f.notify();
});
test('late cleanup cannot invalidate a replacement profile or publish restart',async()=>{
  const f=fixture(),c=f.make(),events=[];await c.ready();c.onEvent(e=>events.push(e));const reset=f.storage.reset;
  f.storage.reset=async(...args)=>{await reset(...args);f.replace();};await logout(c);assert.equal(c.getState().profileId,'profile-b');assert.equal(events.some(e=>e.type==='restartRequested'),false);c.dispose();
});
