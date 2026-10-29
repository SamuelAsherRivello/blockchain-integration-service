import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey} from '@arkade-os/sdk';
import {register} from './test-wallets/inventory.ts';
import {findTestActor,actorSource} from './test-wallets/server-actors.ts';
import {Operations} from './test-wallets/operations.ts';
import {verifyBoardingNonSubmission,hasVerifiedBoardingNonSubmission} from './test-wallets/boarding-non-submission.ts';
import {assertAcceptanceBudget} from './treasure-acceptance-policy.ts';
import {assertAtomicPaymentBudget} from '../packages/bis-server/scripts/funded-workflow-live.ts';

async function fixture(){
 const state:any={version:1,revision:1,accounts:[],pairs:[]},vault={transaction:async(use:any)=>use(state)};
 await register(vault,[{label:'player',phrase:'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'}],'supplied');
 const publicKey=Buffer.from(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey()).toString('hex');
 state.serverActors={game:{endpoint:'https://fixture.vercel.app/api/bis/',network:'signet',publicKey,profileId:createHash('sha256').update(Buffer.from(publicKey,'hex')).digest('hex'),grant:{active:true,networks:['signet'],source:'user-approved-hosted-test-actor'}}};
 const game=findTestActor(state,'game'),player=state.accounts[0],runId='srv-board-fixture',ledger=new Operations(vault);
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
