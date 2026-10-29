import {createHash} from 'node:crypto';
import {validateServerActor} from './server-actors.ts';

/** Audited historical interception and remote-only identity sources for c.
 * This exception cannot qualify a different driver revision or financial case.
 */
export const reviewedBoardingAbortSources=Object.freeze({
 'BIS/packages/bis-server/scripts/funded-workflow-lifecycle.ts':'90b7131044313939ac293e8eba7591dc668a9c8ae5539791b2cd4f791ac5e40a',
 'BIS/packages/bis-server/scripts/funded-workflow-live.ts':'4a8278955d60696c88b50cfa1067a0f9cebfac02acf27065a0423844a87622ab',
 'BIS/packages/bis-server/scripts/funded-workflow-boarding.ts':'eae596fc285773aa099a8546dcd4782e17ced67c46e9ba591c300a68dc038bcb',
 'BIS/scripts/test-wallets/server-actors.ts':'b775f95326baa89e9f1253289198e53d86c3aaafeb7d70223f727f881a15fb2f',
 'BIS/scripts/test-wallets/owned-browser.ts':'341e3b9f3f324459aefb7b20d75ef1956dcccad0517417e537d5811c84049cbb',
 'BIS/packages/integration/src/client/wallet-layer-arkade/wallet-identity.ts':'214467404f94167db4942dbf2a483d6f39ccc13a037cba467c919e3917984dde',
 'BIS/packages/integration/src/client/wallet-layer-arkade/app-wallet-session.ts':'69769b6b5623a328aea6afbdf86852b275edc6c1c666cc829c14823b368a7ebc',
 'BIS/packages/integration/src/client/wallet-layer-arkade/server-wallet.ts':'673e2fa69dc474a60c5d5313427d97d54efae351ec3a4024a6a9cc81eb6b34db',
});

export type BoardingNonSubmissionEvidence = Readonly<{
  kind:'guarded-boarding-not-submitted-v1'; runId:string; operationFingerprint:string; scope:string;
  sourceHashes:Readonly<Record<string,string>>;
  reviewedPreDispatchAbort?:Readonly<{kind:'remote-only-pre-dispatch-abort-2026-10-29';sourceCommit:'b64244146387c5b15c6ade2cef86d61fca24a939';originalInspectionStartedAt:string;
    guardFailure:Readonly<{stage:'transport';path:'other';observedAt:string}>}>;
  closedBrowser:{profileKey:string;observedAt:string;reopenedOriginalProfile:true;closed:true};
  browserRecord:{id:string;profileId:string;network:string;status:string;phase:string;createdAt:number;
    inputs:{txid:string;vout:number}[];quote:{fingerprint:string;profileId:string;amountSats:number};intentId?:string;commitmentTxid?:string};
}>;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const points=(rows:{txid:string;vout:number}[])=>rows.map(row=>`${row.txid}:${row.vout}`).sort();
const denied=()=>Error('guarded-boarding-non-submission-unverified');
function reviewedPreDispatchAbort(record:any,run:any,evidence:BoardingNonSubmissionEvidence,state:any){
 const a=run.assignment,review=evidence.reviewedPreDispatchAbort,guard=run.guardFailures?.[0],closed=evidence.closedBrowser;
 if(!review)return false;
 if(review.kind!=='remote-only-pre-dispatch-abort-2026-10-29'||review.sourceCommit!=='b64244146387c5b15c6ade2cef86d61fca24a939'||
  a.runId!=='srv-board-2990c-1029'||a.network!=='signet'||a.candidateId!=='signet:01'||a.amountSats!==2990||a.boardingExecutionMs!==300000||a.playerProfileId===a.gameProfileId||
  run.originalReconciliations!==1||review.originalInspectionStartedAt!==run.originalInspectionStartedAt||
  !Number.isFinite(Date.parse(run.originalInspectionStartedAt))||Date.parse(run.originalInspectionStartedAt)<Date.parse(record.updatedAt)||Date.parse(run.originalInspectionStartedAt)>Date.parse(closed.observedAt)||
  !Array.isArray(run.guardFailures)||run.guardFailures.length!==1||!guard||!same(Object.keys(guard).sort(),['observedAt','path','stage'])||guard.stage!=='transport'||guard.path!=='other'||
  !same(review.guardFailure,guard)||!Number.isFinite(Date.parse(guard.observedAt))||Date.parse(guard.observedAt)<Date.parse(record.createdAt)-300000||Date.parse(guard.observedAt)>Date.parse(record.updatedAt)||
  ['successfulServerSigns','providerRequests','providerStages'].some(field=>run[field]!==undefined&&(!Array.isArray(run[field])||run[field].length!==0))||
  ['originalRegistration','originalCommitment','originalSubmit','sessionPublicKey','planToken','batchToken','batchId'].some(field=>run[field]!==undefined)||
  Object.entries(reviewedBoardingAbortSources).some(([path,digest])=>a.sourceHashes[path]!==digest)||
  !Array.isArray(state?.accounts)||state.accounts.some((row:any)=>row.profileId===a.gameProfileId||row.label===record.intent.account))throw denied();
 const actor=validateServerActor(state.serverActors?.[record.intent.account]);
 if(actor.profileId!==a.gameProfileId||actor.network!==a.network||!actor.grant.active||actor.endpoint!==a.endpoint||actor.publicKey!==a.serverPublicKey||
  !same(record.intent.serverSource,{endpoint:actor.endpoint,publicKey:actor.publicKey}))throw denied();
 return true;
}

/** Missing provider observations never prove non-submission. This requires the
 * original durable browser record and a closed, completely intercepted attempt.
 */
export function verifyBoardingNonSubmission(record:any,run:any,evidence:BoardingNonSubmissionEvidence,state?:any){
  const a=run?.assignment,b=evidence?.browserRecord,closed=evidence?.closedBrowser;
  const profileKey=createHash('sha256').update(`${a?.pair}:${a?.network}:http://127.0.0.1:5174:admin:recovery:life-${a?.runId}`).digest('hex').slice(0,24);
  const reviewedAbort=a&&evidence?.reviewedPreDispatchAbort?reviewedPreDispatchAbort(record,run,evidence,state):false;
  if(!a||a.workflow!=='boarding'||run.workflow!=='boarding'||run.phase!=='unresolved'||run.originalReconciliations&&!reviewedAbort||a.authorizationMode!=='player-proof'||
    record?.state!=='unknown'||record.providerId!==undefined||record.fingerprint!==hash(record.intent)||record.intent.kind!=='btc-send'||!record.intent.serverSource||
    record.intent.id!==a.runId+'-board'||record.intent.profileId!==a.gameProfileId||record.intent.network!==a.network||record.intent.amountSats!==a.amountSats||record.intent.feeSats!==0||
    evidence?.kind!=='guarded-boarding-not-submitted-v1'||evidence.runId!==a.runId||evidence.operationFingerprint!==record.fingerprint||evidence.scope!==run.scope||
    !same(evidence.sourceHashes,a.sourceHashes)||!closed||closed.closed!==true||closed.reopenedOriginalProfile!==true||closed.profileKey!==profileKey||
    !Number.isFinite(Date.parse(closed.observedAt))||Date.parse(closed.observedAt)<Date.parse(record.updatedAt)||
    !b||!/^[-a-zA-Z0-9]{1,100}$/.test(b.id??'')||b.profileId!==a.gameProfileId||b.network!==a.network||b.status!=='not-submitted'||b.phase!=='prepared'||b.intentId!==undefined||b.commitmentTxid!==undefined||
    !Number.isSafeInteger(b.createdAt)||b.createdAt<Date.parse(record.createdAt)||b.createdAt>Date.parse(record.updatedAt)||
    b.quote.profileId!==a.gameProfileId||b.quote.amountSats!==a.amountSats||b.quote.fingerprint!==run.plan?.quote?.fingerprint||
    !Array.isArray(b.inputs)||!same(points(b.inputs),[...run.plan.outpoints].sort()))throw denied();
  for(const path of ['funded-workflow-live','funded-workflow-lifecycle','funded-workflow-boarding'])
    if(!/^[a-f0-9]{64}$/.test(a.sourceHashes?.[`BIS/packages/bis-server/scripts/${path}.ts`]??''))throw denied();
  if(run.successfulServerSigns?.length||run.providerRequests?.length||run.providerStages?.length||run.originalRegistration||run.originalCommitment||run.originalSubmit||
    run.sessionPublicKey||run.planToken||run.batchToken||run.batchId||run.guardFailures?.length&&!reviewedAbort||!Array.isArray(run.serverRequests)||![1,2].includes(run.serverRequests.length))throw denied();
  if(reviewedAbort&&run.serverRequests.length!==2)throw denied();
  const request=run.serverRequests[0],body=request.body;
  if(request.path!=='player/challenge'||request.grant!==undefined||body?.gameId!=='stealth-and-steel'||body.network!==a.network||body.profileId!==a.gameProfileId||
    !/^[a-zA-Z0-9-]{1,100}$/.test(body.operationId??'')||!/^0[23][a-f0-9]{64}$/.test(body.playerPublicKey??'')||
    createHash('sha256').update(Buffer.from(body.playerPublicKey,'hex')).digest('hex')!==a.playerProfileId)throw denied();
  if(run.serverRequests.length===2){
    const next=run.serverRequests[1],auth=next.body;
    if(next.path!=='player/authenticate'||next.grant!==undefined||auth?.gameId!==body.gameId||auth.network!==body.network||auth.profileId!==body.profileId||auth.operationId!==body.operationId||
      typeof auth.challenge!=='string'||!auth.challenge||auth.challenge.length>4096||!/^([a-f0-9]{2}){64}$/.test(auth.signature??''))throw denied();
  }
  const proof={kind:evidence.kind,runId:evidence.runId,operationFingerprint:evidence.operationFingerprint,scope:evidence.scope,sourceHashes:{...evidence.sourceHashes},
    closedBrowser:{profileKey:closed.profileKey,observedAt:closed.observedAt,reopenedOriginalProfile:true,closed:true},
    browserRecord:{id:b.id,profileId:b.profileId,network:b.network,status:b.status,phase:b.phase,createdAt:b.createdAt,inputs:b.inputs.map(({txid,vout})=>({txid,vout})),
      quote:{fingerprint:b.quote.fingerprint,profileId:b.quote.profileId,amountSats:b.quote.amountSats}},requestPaths:run.serverRequests.map((row:any)=>row.path),
    ...(reviewedAbort?{reviewedPreDispatchAbort:{kind:'remote-only-pre-dispatch-abort-2026-10-29',sourceCommit:'b64244146387c5b15c6ade2cef86d61fca24a939',
      originalInspectionStartedAt:new Date(run.originalInspectionStartedAt).toISOString(),guardFailure:{stage:'transport',path:'other',observedAt:new Date(run.guardFailures[0].observedAt).toISOString()}}}:{}),financialDispatches:0,successfulSignatures:0};
  const resolution={kind:'verified-guarded-boarding-non-submission',previousState:'unknown',previousUpdatedAt:record.updatedAt,networkOutcome:'not-submitted',verified:true,exposureSats:0,proof};
  return {...resolution,digest:hash(resolution)};
}

/** Only this verified zero-dispatch disposition has zero cost. Ordinary failed,
 * cancelled, abandoned and unresolved operations retain their full budget cost.
 */
export function hasVerifiedBoardingNonSubmission(record:any):boolean{
  const r=record?.resolution;if(!r)return false;
  const {digest,...body}=r;
  return record.state==='cancelled'&&record.providerId===undefined&&record.intent?.kind==='btc-send'&&record.fingerprint===hash(record.intent)&&!!record.intent.serverSource&&
    r.kind==='verified-guarded-boarding-non-submission'&&r.previousState==='unknown'&&r.networkOutcome==='not-submitted'&&r.verified===true&&r.exposureSats===0&&
    r.proof?.operationFingerprint===record.fingerprint&&r.proof?.runId+'-board'===record.intent.id&&r.proof?.financialDispatches===0&&r.proof?.successfulSignatures===0&&digest===hash(body);
}
