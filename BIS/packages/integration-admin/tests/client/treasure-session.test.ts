import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasureSession,treasureMessage} from '../../src/client/preview-layer/treasure-session.ts';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup() {
  let now=1000,sequence=0;
  const player={profileId:'player',phase:'active',network:'signet'},game={profileId:'game',status:'ready',network:'signet'},calls=[],records=[];
  const offers={start:async request=>{calls.push(['start',request]);return {status:'pending'};},endSession:async id=>calls.push(['end',id]),
    checkContractsAsync:async()=>({status:'ready',contracts:records}),claim:async id=>{calls.push(['claim',id]);return {status:'pending'};},reject:async id=>{calls.push(['reject',id]);return {status:'pending'};}};
  const controller=createTreasureSession({context:{getState:()=>player},gameWallet:{getState:()=>game},offers,now:()=>now,newId:()=>`session-${++sequence}`});
  const record=(patch={})=>({id:'contract',type:'lto',purpose:'treasureLTO',sessionId:controller.getState().sessionId,hostReference:`treasure:${controller.getState().sessionId}`,expiresAt:controller.snapshot()?.expiresAt,scope:{playerId:'player',gameId:'game',network:'signet'},canClaim:true,financial:'funded',eligibility:'within-window',...patch});
  return {controller,player,game,calls,records,record,offers,advance:ms=>{now+=ms;}};
}
test('Start fixes the 90-second deadline without waiting for funding or extending for pauses',async()=>{
  const s=setup();s.offers.start=()=>new Promise(()=>{});s.controller.start();
  await tick();
  assert.equal(s.controller.getState().remainingSeconds,90);
  s.records.push(s.record({financial:'funding',canClaim:false}));await s.controller.inspect();
  assert.equal(s.controller.getState().status,'preparing');
  s.advance(90001);assert.equal(s.controller.getState().status,'expired');
  assert.equal((await s.controller.act('claim')).status,'unavailable');
});
test('missing player or game at Start skips the entire session',async()=>{
  for(const role of ['player','game']){
    const s=setup();s[role].profileId=undefined;s.controller.start();await tick();s[role].profileId=role;
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
test('losing cooperating session cannot adopt or claim another session contract',async()=>{
  let now=1000,sequence=0;
  const player={profileId:'player',phase:'active',network:'signet'},game={profileId:'game',status:'ready',network:'signet'},calls=[],records=[];
  const offers={start:async request=>{calls.push(['start',request]);return {status:request.sessionId==='session-1'?'pending':'unavailable'};},endSession:async id=>calls.push(['end',id]),
    checkContractsAsync:async()=>({status:'ready',contracts:records}),claim:async id=>{calls.push(['claim',id]);return {status:'pending'};},reject:async id=>{calls.push(['reject',id]);return {status:'pending'};}};
  const first=createTreasureSession({context:{getState:()=>player},gameWallet:{getState:()=>game},offers,now:()=>now,newId:()=>`session-${++sequence}`});
  const second=createTreasureSession({context:{getState:()=>player},gameWallet:{getState:()=>game},offers,now:()=>now,newId:()=>`session-${++sequence}`});
  first.start();second.start();await tick();
  records.push({id:'contract-one',type:'lto',purpose:'treasureLTO',sessionId:first.getState().sessionId,hostReference:`treasure:${first.getState().sessionId}`,expiresAt:91000,scope:{playerId:'player',gameId:'game',network:'signet'},canClaim:true,financial:'funded',eligibility:'within-window'});
  await first.inspect();await second.inspect();
  assert.equal(first.getState().status,'active');
  assert.equal(second.getState().status,'unavailable');
  assert.equal(second.getState().contractId,undefined);
  assert.equal((await second.act('claim')).status,'unavailable');
  assert.equal(calls.filter(c=>c[0]==='claim').length,0);
  first.dispose();second.dispose();
});
test('expiry remains inspectable after backend refund and a rejected reward never restarts',async()=>{
  const s=setup();s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  s.advance(91000);s.records[0]=s.record({financial:'refunded',eligibility:'resolved',canClaim:false});await s.controller.inspect();
  assert.equal(s.controller.getState().status,'expired');
  assert.equal(treasureMessage(s.controller.getState().status),"You found a treasure but it's expired");
  assert.equal((await s.controller.act('reject')).status,'unavailable');assert.equal(s.calls.filter(c=>c[0]==='start').length,1);
});
test('late results from an ended session cannot alter a new session',async()=>{
  const s=setup();let release;s.offers.start=()=>new Promise(resolve=>{release=resolve;});s.controller.start();await tick();const old=s.record();
  s.controller.end();s.player.profileId=undefined;s.controller.start();release({status:'confirmed',contract:old});await tick();
  assert.equal(s.controller.getState().status,'missing-player');assert.equal(s.controller.getState().contractId,undefined);
});
test('replacement Start waits for prior cleanup before beginning a fresh offer',async()=>{
  const s=setup();s.controller.start();await tick();
  let release;const originalEnd=s.offers.endSession;s.offers.endSession=id=>new Promise(resolve=>{s.calls.push(['end-start',id]);release=resolve;});
  const replacement=s.controller.start();await tick();
  assert.equal(s.calls.filter(call=>call[0]==='start').length,1);
  release();await replacement;await tick();
  assert.equal(s.calls.filter(call=>call[0]==='start').length,2);
  s.offers.endSession=originalEnd;
});
test('unavailable reads stay distinct from empty and account replacement disables actions',async()=>{
  const s=setup();s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  s.offers.checkContractsAsync=async()=>({status:'unavailable',contracts:[]});await s.controller.inspect();assert.equal(s.controller.getState().status,'unavailable');
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

test('Admin forwards an explicit validation choice and displays the mode returned by BIS',async()=>{
  const s=setup();
  await s.controller.start('browser-policy-v1');
  assert.equal(s.calls.find(call=>call[0]==='start')[1].validationSolution,'browser-policy-v1');
  s.records.push(s.record({validationMode:'browser-policy-v1'}));
  await s.controller.inspect();
  assert.equal(s.controller.getState().validationMode,'browser-policy-v1');
  await s.controller.act('claim');
  s.advance(91000);
  assert.equal(s.controller.getState().status,'pending');
  assert.equal(s.controller.getState().validationMode,'browser-policy-v1');
});

test('host default leaves automatic selection to BIS instead of choosing a browser mode locally',async()=>{
  const s=setup();await s.controller.start();
  assert.equal('validationSolution' in s.calls.find(call=>call[0]==='start')[1],false);
  s.records.push(s.record({validationMode:'arkade-covenant-v2'}));
  await s.controller.inspect();
  assert.equal(s.controller.getState().validationMode,'arkade-covenant-v2');
});

test('uncertain explicit creation preserves its mode through recovery without issuing a fallback offer',async()=>{
  const s=setup();
  s.offers.start=async request=>{s.calls.push(['start',request]);return {status:'pending'};};
  await s.controller.start('arkade-covenant-v2');
  assert.equal(s.controller.getState().validationMode,'arkade-covenant-v2');
  assert.equal(s.calls.filter(call=>call[0]==='start').length,1);

  const saved=s.controller.snapshot();
  s.controller.dispose({preserveSession:true});
  const resumed=createTreasureSession({context:{getState:()=>s.player},gameWallet:{getState:()=>s.game},offers:s.offers,now:()=>1000});
  assert.equal(resumed.restore(saved),true);
  assert.equal(resumed.getState().validationMode,'arkade-covenant-v2');
  assert.equal(s.calls.filter(call=>call[0]==='start').length,1);

  s.records.push(s.record({validationMode:'arkade-covenant-v2'}));
  await resumed.inspect();
  assert.equal(resumed.getState().validationMode,'arkade-covenant-v2');
  assert.equal(resumed.getState().status,'active');
  assert.equal(s.calls.filter(call=>call[0]==='start').length,1);
  assert.equal(s.calls.some(call=>call[0]==='start'&&call[1].validationSolution==='browser-policy-v1'),false);
  resumed.dispose({preserveSession:true});
});

test('pending rejection keeps its persisted mode and financial pending state across expiry',async()=>{
  const s=setup();await s.controller.start('arkade-covenant-v2');
  s.records.push(s.record({validationMode:'arkade-covenant-v2'}));await s.controller.inspect();
  assert.equal((await s.controller.act('reject')).status,'pending');
  s.advance(91000);
  assert.equal(s.controller.getState().status,'pending');
  assert.equal(s.controller.getState().validationMode,'arkade-covenant-v2');
});

test('restored active cache cannot authorize an action before matching BIS inspection',async()=>{
  const s=setup();await s.controller.start();await tick();s.records.push(s.record());await s.controller.inspect();
  const saved=s.controller.snapshot();s.controller.dispose({preserveSession:true});
  const restored=createTreasureSession({context:{getState:()=>s.player},gameWallet:{getState:()=>s.game},offers:s.offers,now:()=>1000});
  assert.equal(restored.restore({...saved,status:'active'}),true);
  assert.equal(restored.getState().status,'unavailable');
  assert.equal((await restored.act('claim')).status,'unavailable');
  await restored.inspect();assert.equal(restored.getState().status,'active');
  assert.equal(s.calls.filter(c=>c[0]==='claim').length,0);
  restored.dispose({preserveSession:true});
});

test('network and deadline substitutions cannot activate a matching-looking contract',async()=>{
  const s=setup();await s.controller.start();await tick();
  for(const patch of [{scope:{playerId:'player',gameId:'game',network:'mutinynet'}},{expiresAt:92000}]){
    s.records.splice(0,s.records.length,s.record(patch));await s.controller.inspect();
    assert.equal(s.controller.getState().status,'unavailable');
    assert.equal((await s.controller.act('claim')).status,'unavailable');
  }
  s.records.splice(0,s.records.length,s.record());await s.controller.inspect();
  s.player.network='mutinynet';s.game.network='mutinynet';
  assert.equal(s.controller.getState().status,'no-offer');
  assert.equal((await s.controller.act('reject')).status,'unavailable');
});

test('concurrent inspections share the same pending read and do not sign',async()=>{
  const s=setup();await s.controller.start();await tick();let release,reads=0;
  s.offers.checkContractsAsync=()=>{reads++;return new Promise(resolve=>{release=resolve;});};
  const first=s.controller.inspect(),second=s.controller.inspect();
  assert.equal(first,second);await tick();assert.equal(reads,1);
  release({status:'ready',contracts:[s.record()]});await Promise.all([first,second]);
  assert.equal(s.controller.getState().status,'active');
  assert.equal(s.calls.filter(c=>['claim','reject'].includes(c[0])).length,0);
});

test('a pending old inspection cannot block or overwrite the replacement session',async()=>{
  const s=setup();await s.controller.start();await tick();let release;
  s.offers.checkContractsAsync=()=>new Promise(resolve=>{release=resolve;});
  const old=s.controller.inspect();await tick();const oldRecord=s.record();
  s.controller.end();s.offers.checkContractsAsync=async()=>({status:'ready',contracts:s.records});
  await s.controller.start();await tick();s.records.push(s.record({id:'new-contract'}));await s.controller.inspect();
  assert.equal(s.controller.getState().contractId,'new-contract');
  release({status:'ready',contracts:[oldRecord]});await old;
  assert.equal(s.controller.getState().contractId,'new-contract');
  assert.equal(s.controller.getState().status,'active');
});

test('network replacement during a pending read cannot restore active eligibility',async()=>{
  const s=setup();await s.controller.start();await tick();let release;
  s.offers.checkContractsAsync=()=>new Promise(resolve=>{release=resolve;});
  const read=s.controller.inspect();await tick();const original=s.record();
  s.player.network='mutinynet';s.game.network='mutinynet';
  release({status:'ready',contracts:[original]});await read;
  assert.equal(s.controller.getState().status,'no-offer');
  assert.equal((await s.controller.act('claim')).status,'unavailable');
});

test('mismatched wallet networks skip Start without signing or funding',async()=>{
  const s=setup();s.game.network='mutinynet';await s.controller.start();
  assert.equal(s.controller.getState().status,'no-offer');assert.equal(s.calls.length,0);
});

