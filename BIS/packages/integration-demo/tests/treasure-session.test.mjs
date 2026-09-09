import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasureSession,treasureMessage} from '../src/preview/treasure-session.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup() {
  let now=1000,sequence=0;
  const player={profileId:'player',phase:'active'},game={profileId:'game',status:'ready'},calls=[],records=[];
  const offers={start:async request=>{calls.push(['start',request]);return {status:'pending'};},endSession:async id=>calls.push(['end',id]),
    checkContracts:async()=>({status:'ready',contracts:records}),claim:async id=>{calls.push(['claim',id]);return {status:'pending'};},reject:async id=>{calls.push(['reject',id]);return {status:'pending'};}};
  const controller=createTreasureSession({context:{getState:()=>player},gameWallet:{getState:()=>game},offers,now:()=>now,newId:()=>`session-${++sequence}`});
  const record=(patch={})=>({id:'contract',type:'lto',purpose:'treasureLTO',sessionId:controller.getState().sessionId,hostReference:`treasure:${controller.getState().sessionId}`,scope:{playerId:'player',gameId:'game'},canClaim:true,financial:'funded',eligibility:'within-window',...patch});
  return {controller,player,game,calls,records,record,offers,advance:ms=>{now+=ms;}};
}
test('Start fixes the 90-second deadline without waiting for funding or extending for pauses',async()=>{
  const s=setup();s.offers.start=()=>new Promise(()=>{});s.controller.start();
  assert.equal(s.controller.getState().remainingSeconds,90);
  s.records.push(s.record({financial:'funding',canClaim:false}));await s.controller.inspect();
  assert.equal(s.controller.getState().status,'preparing');
  s.advance(90001);assert.equal(s.controller.getState().status,'expired');
  assert.equal((await s.controller.act('claim')).status,'unavailable');
});
test('missing player or game at Start skips the entire session',async()=>{
  for(const role of ['player','game']){
    const s=setup();s[role].profileId=undefined;s.controller.start();s[role].profileId=role;
    await s.controller.inspect();await tick();assert.equal(s.calls.length,0);
  }
});
test('chest ignores other purposes, sessions and references and only claims the matching contract',async()=>{
  const s=setup();s.controller.start();await tick();
  s.records.push(s.record({purpose:'anotherReward'}),s.record({sessionId:'old'}),s.record({hostReference:'another-chest'}));
  await s.controller.inspect();assert.notEqual(s.controller.getState().status,'active');
  s.records.push(s.record());await s.controller.inspect();assert.equal(s.controller.getState().status,'active');
  const actions=await Promise.all([s.controller.act('claim'),s.controller.act('claim')]);
  assert.equal(actions.filter(r=>r.status==='pending').length,1);assert.equal(s.calls.filter(c=>c[0]==='claim').length,1);
});
test('expiry remains inspectable after backend refund and a rejected reward never restarts',async()=>{
  const s=setup();s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  s.advance(91000);s.records[0]=s.record({financial:'refunded',eligibility:'resolved',canClaim:false});await s.controller.inspect();
  assert.equal(s.controller.getState().status,'expired');
  assert.equal(treasureMessage(s.controller.getState().status),"You found a treasure but it's expired");
  assert.equal((await s.controller.act('reject')).status,'unavailable');assert.equal(s.calls.filter(c=>c[0]==='start').length,1);
});
test('late results from an ended session cannot alter a new session',async()=>{
  const s=setup();let release;s.offers.start=()=>new Promise(resolve=>{release=resolve;});s.controller.start();const old=s.record();
  s.controller.end();s.player.profileId=undefined;s.controller.start();release({status:'confirmed',contract:old});await tick();
  assert.equal(s.controller.getState().status,'missing-player');assert.equal(s.controller.getState().contractId,undefined);
});
test('unavailable reads stay distinct from empty and account replacement disables actions',async()=>{
  const s=setup();s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  s.offers.checkContracts=async()=>({status:'unavailable',contracts:[]});await s.controller.inspect();assert.equal(s.controller.getState().status,'unavailable');
  s.player.profileId='other';assert.equal((await s.controller.act('claim')).status,'unavailable');
});

test('level progression restores the same deadline and contract without another funding attempt',async()=>{
  const s=setup();s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  const saved=s.controller.snapshot();s.controller.dispose({preserveSession:true});
  s.advance(30000);
  const resumed=createTreasureSession({context:{getState:()=>s.player},gameWallet:{getState:()=>s.game},offers:s.offers,now:()=>31000});
  assert.equal(resumed.restore(saved),true);await resumed.inspect();
  assert.equal(resumed.getState().remainingSeconds,60);assert.equal(resumed.getState().contractId,'contract');
  assert.equal(s.calls.filter(c=>c[0]==='start').length,1);assert.equal(s.calls.filter(c=>c[0]==='end').length,0);
});
