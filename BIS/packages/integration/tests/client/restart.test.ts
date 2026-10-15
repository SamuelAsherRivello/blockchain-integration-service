import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, createBisAdminContext } from '../../src/client/state-layer-core/context.ts';

function fixture() {
  let record = {generation:0,account:{phrase:'fixture-only',profileId:'profile-a'}};
  const listeners=new Set(); let clears=0;
  const notify=()=>{for(const listener of listeners)listener();};
  const storage={load:async()=>record,save:async()=>{},subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    reset:async(expected,options)=>{clears++; record={generation:record.generation+1,account:null,...(options ? {logout:{id:'logout-one',profileId:'profile-a',generation:record.generation+1}} : {})};notify();}};
  const make=(options={})=>createContext(storage,async()=>{throw Error('unexpected create');},async()=>record.account?.profileId??'profile-a',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,options);
  return {storage,make,notify,clears:()=>clears,replace(){record={generation:2,account:{phrase:'fixture-b',profileId:'profile-b'}};notify();}};
}
async function logout(c){await c.readyAsync();c.openAccountDialog();c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);await c.confirmLogout();}

test('non-reloading hosts receive restart after invalidation, once per affected context',async()=>{
  const f=fixture(),a=f.make(),b=f.make(),ae=[],be=[];
  await Promise.all([a.readyAsync(),b.readyAsync()]);
  for(const [c,events] of [[a,ae],[b,be]])c.onEvent(e=>{assert.equal(c.getState().hasProfile,false);assert.equal(c.getState().profileId,undefined);events.push(e);});
  await logout(a);await b.readyAsync();f.notify();await b.readyAsync();
  for(const events of [ae,be])assert.deepEqual(events.map(e=>e.type),['accountDisconnected','restartRequested']);
  assert.equal(ae[1].logoutId,be[1].logoutId);assert.equal(f.clears(),1);
  const fresh=f.make();await fresh.readyAsync();assert.equal(fresh.getState().hasProfile,false);
  a.dispose();b.dispose();fresh.dispose();
});
test('throwing host cannot turn completed cleanup into logout-error or repeat cleanup',async()=>{
  const f=fixture(),c=f.make(); const old=console.error;const reports=[];console.error=(message)=>reports.push(message);
  try{c.onEvent(()=>{throw Error('host private detail');});await logout(c);assert.equal(c.getState().phase,'idle');await c.retry();assert.equal(f.clears(),1);assert.equal(reports.length,2);assert.ok(reports.every(r=>!r.includes('private detail')));}finally{console.error=old;c.dispose();}
});
test('cancel, initial absence, admin reset and disposal do not request restart',async()=>{
  const f=fixture(),c=f.make(),events=[];c.onEvent(e=>events.push(e));await c.readyAsync();c.openAccountDialog();c.openLogoutConfirmation();c.cancelLogout();await createBisAdminContext(c).resetClient();assert.equal(events.some(e=>e.type==='restartRequested'),false);c.dispose();f.notify();
});
test('late cleanup cannot invalidate a replacement profile or publish restart',async()=>{
  const f=fixture(),c=f.make(),events=[];await c.readyAsync();c.onEvent(e=>events.push(e));const reset=f.storage.reset;
  f.storage.reset=async(...args)=>{await reset(...args);f.replace();};await logout(c);assert.equal(c.getState().profileId,'profile-b');assert.equal(events.some(e=>e.type==='restartRequested'),false);c.dispose();
});
test('game may allow, confirm, or reject logout before browser cleanup',async()=>{
  const allow=fixture(),allowed=allow.make({authorizeLogout:async profileId=>{assert.equal(profileId,'profile-a');return {decision:'allow'};}});
  await allowed.readyAsync();allowed.openAccountDialog();await allowed.openLogoutConfirmation();await allowed.confirmLogout();assert.equal(allow.clears(),1);allowed.dispose();

  const confirm=fixture();let approved=false;
  const guarded=confirm.make({authorizeLogout:async()=>({decision:'confirm',authorizationId:'run-one',body:'Leaving will discard game progress.'}),recheckLogout:async id=>({decision:approved&&id==='run-one'?'allow':'deny',message:'The run changed.'})});
  await guarded.readyAsync();guarded.openAccountDialog();await guarded.openLogoutConfirmation();assert.equal(guarded.getState().logoutGameConfirmationBody,'Leaving will discard game progress.');await guarded.confirmLogout();assert.equal(confirm.clears(),0);assert.match(guarded.getState().error??'',/run changed/i);
  guarded.dispose();
});
test('unavailable game authorization requires an explicit BIS override acknowledgement',async()=>{
  const f=fixture(),c=f.make({authorizeLogout:async()=>{throw Error('unavailable');}});await c.readyAsync();c.openAccountDialog();await c.openLogoutConfirmation();assert.equal(c.getState().logoutOverrideRequired,true);await c.confirmLogout();assert.equal(f.clears(),0);c.setLogoutOverrideAcknowledged(true);await c.confirmLogout();assert.equal(f.clears(),1);c.dispose();
});
test('an unavailable game recheck changes the same logout dialog into an explicit BIS override',async()=>{
  const f=fixture(),c=f.make({authorizeLogout:async()=>({decision:'confirm',authorizationId:'run-one',body:'Leaving will discard game progress.'}),recheckLogout:async()=>{throw Error('unavailable');}});
  await c.readyAsync();c.openAccountDialog();await c.openLogoutConfirmation();await c.confirmLogout();assert.equal(f.clears(),0);assert.equal(c.getState().phase,'logout-confirmation');assert.equal(c.getState().logoutOverrideRequired,true);assert.match(c.getState().error??'',/could not recheck/i);c.setLogoutOverrideAcknowledged(true);await c.confirmLogout();assert.equal(f.clears(),1);c.dispose();
});
