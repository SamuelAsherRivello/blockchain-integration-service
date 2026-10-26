import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAcceptanceSelection,assertOriginalRun,observeAcceptance,verifyInsufficientEvidence,gameReadinessFromConsole,validateAlternateProfile,assertAcceptanceBudget,observeGameReadiness} from './treasure-acceptance-policy.ts';
import {assertProtectedScenarioSlot,validateOtherNetworkFixture} from './treasure-acceptance-policy.ts';
import {needsAcceptanceReadDiagnostics,acceptanceReadRequest,acceptanceReadFailure,readOnlyAcceptanceRequestAllowed} from './treasure-acceptance-policy.ts';

test('readiness diagnostics cover the unfunded network gate without changing other financial scenarios',()=>{
  for(const scenario of ['readiness','network-replacement'])assert.equal(needsAcceptanceReadDiagnostics(scenario),true);
  for(const scenario of ['legacy-rollback','claim','probe','recover'])assert.equal(needsAcceptanceReadDiagnostics(scenario),false);
});
test('public read metadata redacts identifiers, credentials, query and raw errors',()=>{
  const request={url:()=> 'https://user:private-password@signet.arkade.sh/v1/indexer/vtxos/privateIdentifier?token=private-token',method:()=> 'GET',
    headers:()=>{throw Error('headers forbidden');},postData:()=>{throw Error('body forbidden');}};
  assert.deepEqual(acceptanceReadRequest(request,'signet'),{service:'operator',hostname:'signet.arkade.sh',method:'GET',path:'/v1/indexer/vtxos/:value'});
  const failed=acceptanceReadFailure('net::ERR_TIMED_OUT private-token');assert.equal(failed.ERR_TIMED_OUT,true);
  assert.equal(JSON.stringify(failed).includes('private-token'),false);
  assert.equal(acceptanceReadFailure('net::ERR_HTTP2_PROTOCOL_ERROR private-token').ERR_HTTP2_PROTOCOL_ERROR,true);
  assert.equal(acceptanceReadFailure('UND_ERR_CONNECT_TIMEOUT').UND_ERR_CONNECT_TIMEOUT,true);
  const custom=acceptanceReadRequest({url:()=> 'https://private.example/secretPath',method:()=> 'private-method'},'signet');
  assert.equal(custom.hostname,'other');assert.equal(custom.method,'other');assert.equal(custom.path,'/:value');
});
test('read-only diagnostics permit exact metadata and indexer observation but reject signing and funding',()=>{
  const request=(url,method='POST')=>({url:()=>url,method:()=>method});
  assert.equal(readOnlyAcceptanceRequestAllowed(request('http://127.0.0.1:5174/api/bis/connect')),true);
  assert.equal(readOnlyAcceptanceRequestAllowed(request('https://signet.arkade.sh/v1/indexer/script/subscribe')),true);
  for(const url of ['http://127.0.0.1:5174/api/bis/sign','http://127.0.0.1:5174/api/bis/authorize',
    'http://127.0.0.1:5174/api/bis/connect?token=extra','https://mutinynet.arkade.sh/v1/tx/submit','https://signet.arkade.sh/v1/tx/finalize',
    'https://emulator.mutinynet.arkade.sh/v1/tx','https://untrusted.example/v1/indexer/script/subscribe'])
    assert.equal(readOnlyAcceptanceRequestAllowed(request(url)),false,url);
  assert.equal(readOnlyAcceptanceRequestAllowed(request('http://127.0.0.1:5174/api/bis/connect','DELETE')),false);
});

test('new protected scenarios require an exact coordinator slot and immutable legacy browser mode',()=>{
  for(const scenario of ['network-replacement','legacy-rollback']){
    for(const assigned of [undefined,'another-run',''])assert.throws(()=>assertProtectedScenarioSlot(scenario,'original-a',assigned),/financial-slot-required/);
    assert.doesNotThrow(()=>assertProtectedScenarioSlot(scenario,'original-a','original-a'));
    assert.throws(()=>assertOriginalRun({mode:'browser-policy-v1',network:'signet'},'browser-policy-v1',scenario,'signet'),/requires-reconciliation/);
  }
  assert.throws(()=>validateAcceptanceSelection('cosigner','legacy-rollback','valid','mutinynet'),/invalid-arguments/);
  for(const network of ['signet','mutinynet'])assert.doesNotThrow(()=>validateAcceptanceSelection('browser','legacy-rollback','valid',network));
  assert.doesNotThrow(()=>validateAcceptanceSelection('cosigner','network-replacement','valid','mutinynet'));
});
test('live network replacement requires registered already-selected saved local wallets without unresolved work',()=>{
  const eligible={originalNetwork:'signet',otherNetwork:'mutinynet',registered:true,saved:true,playerSelected:true,gameSelected:true,localGame:true,unresolved:false};
  assert.doesNotThrow(()=>validateOtherNetworkFixture(eligible));
  for(const patch of [{otherNetwork:'signet'},{otherNetwork:'mainnet'},{registered:false},{saved:false},{playerSelected:false},{gameSelected:false},{localGame:false},{unresolved:true}])
    assert.throws(()=>validateOtherNetworkFixture({...eligible,...patch}),/network-fixture-unavailable/);
});
test('a new protected lifecycle needs budget for both original funding and payout',()=>{
  const now=Date.now(),intent={id:'original-lifecycle-budget',network:'signet',amountSats:2000,feeSats:0};
  const record=amountSats=>({createdAt:new Date(now-1).toISOString(),intent:{...intent,id:'prior',amountSats}});
  assert.doesNotThrow(()=>assertAcceptanceBudget([record(8000)],intent,now));
  assert.throws(()=>assertAcceptanceBudget([record(8001)],intent,now),/network-day-limit/);
});

test('readiness awaits async loading reads and returns the exact terminal observation',async()=>{
  let calls=0;
  assert.equal(await observeGameReadiness(async()=>{await new Promise(resolve=>setTimeout(resolve,5));return ++calls===1?'loading':'ready';},1000),'ready');
  assert.equal(calls,2);
  for(const status of ['unavailable','empty'] as const)assert.equal(await observeGameReadiness(async()=>status,100),status);
});
test('a timed-out readiness read never starts a second read',async()=>{
  let calls=0,finish;
  await assert.rejects(observeGameReadiness(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},5),/observation-timeout/);
  finish('loading');await new Promise(resolve=>setTimeout(resolve,20));assert.equal(calls,1);
});

test('protected acceptance counts reservations and fees against rolling network limits',()=>{
  const now=Date.parse('2026-10-25T13:00:00Z');
  const intent={id:'new',network:'signet',amountSats:1000,feeSats:0};
  const record=(id,amountSats,createdAt=new Date(now-1000).toISOString(),network='signet')=>({createdAt,intent:{...intent,id,amountSats,network}});
  assert.doesNotThrow(()=>assertAcceptanceBudget([record('prior',9000)],intent,now));
  assert.throws(()=>assertAcceptanceBudget([record('unknown',9001)],intent,now),/network-day-limit/);
  assert.throws(()=>assertAcceptanceBudget([],{...intent,amountSats:5000,feeSats:1},now),/operation-limit/);
  assert.doesNotThrow(()=>assertAcceptanceBudget([record('old',10000,new Date(now-86400001).toISOString()),record('other',10000,undefined,'mutinynet')],intent,now));
  for(const createdAt of ['invalid',new Date(now+1).toISOString()])assert.throws(()=>assertAcceptanceBudget([record('bad',1000,createdAt)],intent,now),/budget-unverified/);
  assert.throws(()=>assertAcceptanceBudget([],{...intent,feeSats:null},now),/budget-unverified/);
  assert.doesNotThrow(()=>assertAcceptanceBudget([record('new',1000)],intent,now));
});

test('identity race requires a distinct registered saved profile before funding',()=>{
  const input={playerId:'a'.repeat(64),gameId:'b'.repeat(64),alternatePlayerId:'c'.repeat(64),registered:true,savedProfiles:['a'.repeat(64),'c'.repeat(64)]};
  assert.doesNotThrow(()=>validateAlternateProfile(input));
  for(const patch of [{registered:false},{alternatePlayerId:input.playerId},{alternatePlayerId:input.gameId},{alternatePlayerId:'unknown'},{savedProfiles:[input.playerId]}])
    assert.throws(()=>validateAlternateProfile({...input,...patch}),/identity-fixture-unavailable/);
});

test('readiness belongs to the latest exact object, never nested or neighbouring status',()=>{
  const record=status=>JSON.stringify({operation:'A.G.3 Wallet Status',status,availability:{status:'ready'}});
  assert.equal(gameReadinessFromConsole(record('ready')),'ready');
  assert.equal(gameReadinessFromConsole(record('loading')+'\n'+JSON.stringify({operation:'another',status:'ready'})),'loading');
  assert.equal(gameReadinessFromConsole(record('ready')+'\n'+record('unavailable')),'unavailable');
  assert.equal(gameReadinessFromConsole(record('empty')),'empty');
  assert.equal(gameReadinessFromConsole('{"operation":"A.G.3 Wallet Status","status":"ready"'),undefined);
  assert.equal(gameReadinessFromConsole('{"operation":"A.G.3 Boarding Status","status":"ready"}'),undefined);
  assert.equal(gameReadinessFromConsole(record('future-status')),undefined);
});
test('readiness parsing handles braces/escaped strings and rejects excessive or malformed logs',()=>{
  const text='Details\n'+JSON.stringify({operation:'A.G.3 Wallet Status',status:'ready',message:'quoted " } { \\ text',wallet:{status:'unavailable'}})+'\nOther {}';
  assert.equal(gameReadinessFromConsole(text),'ready');
  assert.equal(gameReadinessFromConsole('x'.repeat(2_000_001)),undefined);
  assert.equal(gameReadinessFromConsole('{"operation":"A.G.3 Wallet Status",bad}'),undefined);
});

test('protected acceptance selections reject unsupported networks, modes and unsafe run identifiers',()=>{
  for(const [mode,network] of [['browser','signet'],['browser','mutinynet'],['cosigner','mutinynet']])
    for(const scenario of ['probe','readiness','feedback-claim','duplicate-claim','empty-duplicate-claim','insufficient','session-rollback'])assert.doesNotThrow(()=>validateAcceptanceSelection(mode,scenario,'acceptance-a',network));
  assert.doesNotThrow(()=>validateAcceptanceSelection('browser','lost-claim-ack','valid','mutinynet'));
  for(const args of [['cosigner','lost-claim-ack','valid','mutinynet'],['browser','lost-claim-ack','valid','signet'],['cosigner','claim','valid','signet'],['browser','claim','valid','mainnet'],['browser','claim','../wallet','signet'],['browser','retry','valid','signet']])
    assert.throws(()=>validateAcceptanceSelection(...args as [string,string,string,string]),/invalid-arguments/);
});
test('insufficient funds requires an exact local rejection and no attempted financial submission',()=>{
  const exact={financial:'failed',submission:'not-submitted',failure:'insufficient-funds'};
  assert.doesNotThrow(()=>verifyInsufficientEvidence(exact,0));
  for(const patch of [{financial:'unknown'},{submission:'submitted'},{failure:'preparation-failed'},{transactionId:'unexpected'},{fundingTransactionId:'unexpected'}])
    assert.throws(()=>verifyInsufficientEvidence({...exact,...patch},0));
  assert.throws(()=>verifyInsufficientEvidence(undefined,0));
  assert.throws(()=>verifyInsufficientEvidence(exact,1));
});
test('an existing attempt can only be recovered in its original network and persisted mode',()=>{
  const original={mode:'browser-policy-v1',network:'signet'};
  for(const scenario of ['claim','duplicate-claim','session-rollback'])assert.throws(()=>assertOriginalRun(original,original.mode,scenario,'signet'));
  for(const scenario of ['recover','peer']){
    assert.doesNotThrow(()=>assertOriginalRun(original,original.mode,scenario,'signet'));
    assert.throws(()=>assertOriginalRun(undefined,original.mode,scenario,'signet'));
    assert.throws(()=>assertOriginalRun(original,'arkade-covenant-v2',scenario,'signet'));
    assert.throws(()=>assertOriginalRun(original,original.mode,scenario,'mutinynet'));
  }
});
test('observation accepts only bounded limits and preserves successful original results',async()=>{
  assert.equal(await observeAcceptance(Promise.resolve('receipt'),100),'receipt');
  for(const limit of [0,-1,120001,Infinity,1.5])await assert.rejects(observeAcceptance(Promise.resolve(),limit),/observation-limit/);
});
test('timeout does not cancel, repeat, or classify an original submission as failed',async()=>{
  let complete!:()=>void,calls=0,settled=false;
  const original=new Promise<void>(resolve=>{calls++;complete=()=>{settled=true;resolve();};});
  await assert.rejects(observeAcceptance(original,5),/original-operation-observation-timeout/);
  assert.equal(calls,1);assert.equal(settled,false);
  complete();await original;assert.equal(calls,1);assert.equal(settled,true);
});
