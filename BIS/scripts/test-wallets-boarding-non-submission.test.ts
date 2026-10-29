import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey} from '@arkade-os/sdk';
import {register} from './test-wallets/inventory.ts';
import {findTestActor,actorSource} from './test-wallets/server-actors.ts';
import {Operations} from './test-wallets/operations.ts';
import {verifyBoardingNonSubmission,hasVerifiedBoardingNonSubmission,reviewedBoardingAbortSources} from './test-wallets/boarding-non-submission.ts';
import {assertAcceptanceBudget} from './treasure-acceptance-policy.ts';
import {assertAtomicPaymentBudget} from '../packages/bis-server/scripts/funded-workflow-live.ts';

async function fixture(reviewedAbort=false){
 const state:any={version:1,revision:1,accounts:[],pairs:[]},vault={transaction:async(use:any)=>use(state)};
 await register(vault,[{label:'player',phrase:'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'}],'supplied');
 const publicKey=Buffer.from(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey()).toString('hex');
 state.serverActors={game:{endpoint:'https://fixture.vercel.app/api/bis/',network:'signet',publicKey,profileId:createHash('sha256').update(Buffer.from(publicKey,'hex')).digest('hex'),grant:{active:true,networks:['signet'],source:'user-approved-hosted-test-actor'}}};
 const game=findTestActor(state,'game'),player=state.accounts[0],runId=reviewedAbort?'srv-board-2990c-1029':'srv-board-fixture',ledger=new Operations(vault);
 await ledger.prepare({id:runId+'-board',account:'game',profileId:game.profileId,generation:1,network:'signet',kind:'btc-send',recipient:'boarding:'+game.profileId,amountSats:2990,feeSats:0,sourceOrigin:'http://127.0.0.1:5174',serverSource:actorSource(game)});
 const record=await ledger.submit(runId+'-board',async()=>{throw Error('Fixture abort before dispatch.');});
 const sourceHashes=Object.fromEntries(['live','lifecycle','boarding'].map(name=>[`BIS/packages/bis-server/scripts/funded-workflow-${name}.ts`,'a'.repeat(64)]));
 const a={runId,pair:'fixture-pair',workflow:'boarding',authorizationMode:'player-proof',network:'signet',gameProfileId:game.profileId,playerProfileId:player.profileId,amountSats:2990,sourceHashes};
 const run:any={scope:'b'.repeat(64),phase:'unresolved',workflow:'boarding',assignment:a,plan:{outpoints:['c'.repeat(64)+':1'],quote:{fingerprint:'d'.repeat(64)}},serverRequests:[{path:'player/challenge',body:{gameId:'stealth-and-steel',network:'signet',profileId:game.profileId,operationId:'original-operation',playerPublicKey:Buffer.from(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey()).toString('hex')}}]};
 // The Player proof key is derived from the published fixture phrase.
 const {MnemonicIdentity}=await import('@arkade-os/sdk');run.serverRequests[0].body.playerPublicKey=Buffer.from(await MnemonicIdentity.fromMnemonic(state.accounts[0].phrase,{isMainnet:false}).compressedPublicKey()).toString('hex');
 state.serverLifecycleRuns={[runId]:run};
 const evidence:any={kind:'guarded-boarding-not-submitted-v1',runId,operationFingerprint:record.fingerprint,scope:run.scope,sourceHashes,
  closedBrowser:{profileKey:createHash('sha256').update(`fixture-pair:signet:http://127.0.0.1:5174:admin:recovery:life-${runId}`).digest('hex').slice(0,24),observedAt:new Date().toISOString(),reopenedOriginalProfile:true,closed:true},
  browserRecord:{id:'original-browser-record',profileId:game.profileId,network:'signet',status:'not-submitted',phase:'prepared',createdAt:Date.parse(record.createdAt),inputs:[{txid:'c'.repeat(64),vout:1}],quote:{fingerprint:'d'.repeat(64),profileId:game.profileId,amountSats:2990}}};
 if(reviewedAbort){
  Object.assign(sourceHashes,reviewedBoardingAbortSources);Object.assign(a,{candidateId:'signet:01',boardingExecutionMs:300000,endpoint:game.server.endpoint,serverPublicKey:game.server.publicKey});
  const scope=run.serverRequests[0].body;
  run.serverRequests.push({path:'player/authenticate',body:{gameId:scope.gameId,network:scope.network,profileId:scope.profileId,operationId:scope.operationId,challenge:'protected-challenge-value',signature:'01'.repeat(64)}});
  run.originalReconciliations=1;run.originalInspectionStartedAt=record.updatedAt;
  run.guardFailures=[{stage:'transport',path:'other',observedAt:record.createdAt}];
  evidence.reviewedPreDispatchAbort={kind:'remote-only-pre-dispatch-abort-2026-10-29',sourceCommit:'b64244146387c5b15c6ade2cef86d61fca24a939',originalInspectionStartedAt:run.originalInspectionStartedAt,guardFailure:structuredClone(run.guardFailures[0])};
 }
 return {state,vault,ledger,record,run,evidence};
}

test('closed challenge-only boarding resolves as not submitted without a fabricated provider receipt',async()=>{
 const f=await fixture();f.evidence.arbitraryDiagnostic='must-not-be-stored';
 const resolved=await f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence);
 assert.equal(resolved.state,'cancelled');assert.equal(resolved.providerId,undefined);assert.equal(resolved.resolution.networkOutcome,'not-submitted');
 assert.equal(resolved.resolution.previousState,'unknown');assert.equal(resolved.resolution.previousUpdatedAt,f.record.updatedAt);
 assert.equal(f.run.phase,'not-submitted');assert.equal(f.run.originalReconciliations,1);assert.equal(hasVerifiedBoardingNonSubmission(resolved),true);
 assert.equal(JSON.stringify(resolved).includes('must-not-be-stored'),false);
 await assert.rejects(f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence));
});

test('the reviewed c abort proves zero dispatch while retaining its guard and consumed inspection',async()=>{
 const f=await fixture(true),guard=structuredClone(f.run.guardFailures);f.evidence.reviewedPreDispatchAbort.extra='PRIVATE_SENTINEL';
 assert.throws(()=>verifyBoardingNonSubmission(f.record,f.run,f.evidence));
 const resolved=await f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence);
 assert.equal(hasVerifiedBoardingNonSubmission(resolved),true);assert.equal(resolved.providerId,undefined);assert.equal(resolved.resolution.networkOutcome,'not-submitted');
 assert.equal(resolved.resolution.previousUpdatedAt,f.record.updatedAt);assert.equal(f.run.originalReconciliations,1);assert.deepEqual(f.run.guardFailures,guard);
 assert.deepEqual(resolved.resolution.proof.reviewedPreDispatchAbort.guardFailure,guard[0]);assert.equal(JSON.stringify(resolved.resolution).includes('PRIVATE_SENTINEL'),false);
 await assert.rejects(f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence));
});

test('a pre-dispatch guard never permits another case, driver, local signer or financial path',async()=>{
 const f=await fixture(true);
 for(const mutate of [
  (r:any,e:any,s:any)=>r.assignment.runId='another-case',
  (r:any,e:any,s:any)=>r.assignment.network='mutinynet',
  (r:any,e:any,s:any)=>r.assignment.candidateId='signet:02',
  (r:any,e:any,s:any)=>r.assignment.amountSats=2991,
  (r:any,e:any,s:any)=>r.assignment.boardingExecutionMs=120000,
  (r:any,e:any,s:any)=>r.assignment.playerProfileId=r.assignment.gameProfileId,
  (r:any,e:any,s:any)=>r.originalReconciliations=0,
  (r:any,e:any,s:any)=>r.originalReconciliations=2,
  (r:any,e:any,s:any)=>r.originalInspectionStartedAt='invalid',
  (r:any,e:any,s:any)=>e.reviewedPreDispatchAbort.sourceCommit='0'.repeat(40),
  (r:any,e:any,s:any)=>e.reviewedPreDispatchAbort.guardFailure.path='changed',
  (r:any,e:any,s:any)=>r.guardFailures.push(r.guardFailures[0]),
  (r:any,e:any,s:any)=>r.guardFailures[0].stage='financial-intent',
  (r:any,e:any,s:any)=>r.guardFailures[0].path='sign',
  (r:any,e:any,s:any)=>r.guardFailures[0].request={method:'sign'},
  (r:any,e:any,s:any)=>r.guardFailures[0].observedAt='invalid',
  (r:any,e:any,s:any)=>r.serverRequests.pop(),
  (r:any,e:any,s:any)=>r.serverRequests.push({path:'settlement/plan'}),
  (r:any,e:any,s:any)=>r.successfulServerSigns=[{method:'sign'}],
  (r:any,e:any,s:any)=>r.providerRequests=[{path:'/v1/batch/registerIntent'}],
  (r:any,e:any,s:any)=>r.successfulServerSigns={length:0},
  (r:any,e:any,s:any)=>r.providerRequests={length:0},
  (r:any,e:any,s:any)=>r.providerStages={length:0},
  (r:any,e:any,s:any)=>r.originalRegistration=null,
  (r:any,e:any,s:any)=>r.originalCommitment='',
  (r:any,e:any,s:any)=>r.planToken='present',
  (r:any,e:any,s:any)=>s.accounts.push({label:'local-copy',profileId:r.assignment.gameProfileId,phrase:'PUBLIC fixture'}),
  (r:any,e:any,s:any)=>delete s.serverActors.game,
  (r:any,e:any,s:any)=>s.serverActors.game.phrase='PUBLIC fixture',
  (r:any,e:any,s:any)=>s.serverActors.game.grant.active=false,
 ]){const r=structuredClone(f.run),e=structuredClone(f.evidence),s=structuredClone(f.state);mutate(r,e,s);assert.throws(()=>verifyBoardingNonSubmission(f.record,r,e,s));}
 for(const path of Object.keys(reviewedBoardingAbortSources)){
  const r=structuredClone(f.run),e=structuredClone(f.evidence);r.assignment.sourceHashes[path]='0'.repeat(64);e.sourceHashes=structuredClone(r.assignment.sourceHashes);
  assert.throws(()=>verifyBoardingNonSubmission(f.record,r,e,f.state));
 }
 assert.equal(f.state.operations[0].state,'unknown');
});

test('the exact ordered auth-only pair permits non-submission without retaining proof credentials',async()=>{
 const f=await fixture(),scope=f.run.serverRequests[0].body;
 f.run.serverRequests.push({path:'player/authenticate',body:{gameId:scope.gameId,network:scope.network,profileId:scope.profileId,operationId:scope.operationId,challenge:'protected-challenge-value',signature:'01'.repeat(64)}});
 const resolved=await f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence);
 assert.equal(hasVerifiedBoardingNonSubmission(resolved),true);
 assert.deepEqual(resolved.resolution.proof.requestPaths,['player/challenge','player/authenticate']);
 assert.equal(JSON.stringify(resolved.resolution).includes('protected-challenge-value'),false);
});

test('reordered, extra, mismatched or financial requests never qualify as an auth-only pair',async()=>{
 const f=await fixture(),scope=f.run.serverRequests[0].body;
 f.run.serverRequests.push({path:'player/authenticate',body:{gameId:scope.gameId,network:scope.network,profileId:scope.profileId,operationId:scope.operationId,challenge:'protected-challenge-value',signature:'01'.repeat(64)}});
 for(const mutate of [
  (r:any)=>r.serverRequests.reverse(),(r:any)=>r.serverRequests.push(r.serverRequests[1]),
  (r:any)=>r.serverRequests[1].path='settlement/plan',(r:any)=>r.serverRequests[1].path='sign',
  (r:any)=>r.serverRequests[1].grant='financial-grant',(r:any)=>r.serverRequests[1].body.gameId='another-game',
  (r:any)=>r.serverRequests[1].body.network='mutinynet',(r:any)=>r.serverRequests[1].body.profileId='a'.repeat(64),
  (r:any)=>r.serverRequests[1].body.operationId='another-operation',(r:any)=>r.serverRequests[1].body.signature='bad',
  (r:any)=>r.guardFailures=[{stage:'financial-intent'}],(r:any)=>r.planToken='financial-plan',
 ]){const run=structuredClone(f.run);mutate(run);assert.throws(()=>verifyBoardingNonSubmission(f.record,run,f.evidence));}
});

test('any financial request or incomplete original evidence refuses non-submission',async()=>{
 const f=await fixture();
 for(const mutate of [
  (r:any,e:any)=>r.serverRequests.push({path:'player/authenticate'}),
  (r:any,e:any)=>r.serverRequests[0].path='settlement/plan',
  (r:any,e:any)=>r.successfulServerSigns=[{method:'sign'}],
  (r:any,e:any)=>r.providerRequests=[{path:'/v1/batch/registerIntent'}],
  (r:any,e:any)=>r.providerStages=['/v1/batch/ack'],
  (r:any,e:any)=>r.originalRegistration={},(r:any,e:any)=>r.originalCommitment='present',
  (r:any,e:any)=>r.planToken='present',(r:any,e:any)=>r.originalReconciliations=1,
  (r:any,e:any)=>r.serverRequests=[],(r:any,e:any)=>e.closedBrowser.closed=false,
  (r:any,e:any)=>e.closedBrowser.reopenedOriginalProfile=false,(r:any,e:any)=>e.closedBrowser.profileKey='0'.repeat(24),
  (r:any,e:any)=>e.browserRecord.status='pending',(r:any,e:any)=>e.browserRecord.phase='submitting',
  (r:any,e:any)=>e.browserRecord.intentId='registered',(r:any,e:any)=>e.browserRecord.commitmentTxid='e'.repeat(64),
  (r:any,e:any)=>e.browserRecord.inputs[0].vout=2,(r:any,e:any)=>e.sourceHashes={},
 ]){const run=structuredClone(f.run),evidence=structuredClone(f.evidence);mutate(run,evidence);assert.throws(()=>verifyBoardingNonSubmission(f.record,run,evidence));}
 assert.throws(()=>verifyBoardingNonSubmission({...f.record,providerId:'e'.repeat(64)},f.run,f.evidence));
 assert.throws(()=>verifyBoardingNonSubmission({...f.record,intent:{...f.record.intent,kind:'refund'}},f.run,f.evidence));
 assert.equal(f.state.operations[0].state,'unknown');
});

test('only verified zero dispatch has zero budget cost, and tampering restores reservation',async()=>{
 const f=await fixture(),now=Date.now(),extra={createdAt:new Date(now).toISOString(),intent:{id:'other-spend',network:'signet',amountSats:5000,feeSats:0}},next={id:'next-spend',network:'signet',amountSats:5000,feeSats:0};
 assert.throws(()=>assertAcceptanceBudget([f.record,extra],next,now));
 assert.throws(()=>assertAtomicPaymentBudget([f.record],next,3000,now));
 const resolved=await f.ledger.reconcileGuardedBoardingNotSubmitted(f.record.intent.id,async()=>f.evidence);
 assert.doesNotThrow(()=>assertAcceptanceBudget([resolved,extra],next,Date.now()));
 assert.doesNotThrow(()=>assertAtomicPaymentBudget([resolved],next,3000,Date.now()));
 for(const mutate of [(r:any)=>r.resolution.proof.financialDispatches=1,(r:any)=>r.intent.amountSats=1,(r:any)=>r.resolution.digest='0'.repeat(64),(r:any)=>r.state='unknown',(r:any)=>r.providerId='e'.repeat(64)]){
  const changed=structuredClone(resolved);mutate(changed);assert.equal(hasVerifiedBoardingNonSubmission(changed),false);
 }
 const ordinary={...f.record,state:'failed'};assert.throws(()=>assertAcceptanceBudget([ordinary,extra],next,Date.now()));
});
