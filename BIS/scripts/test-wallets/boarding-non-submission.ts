import {createHash} from 'node:crypto';

export type BoardingNonSubmissionEvidence = Readonly<{
  kind:'guarded-boarding-not-submitted-v1'; runId:string; operationFingerprint:string; scope:string;
  sourceHashes:Readonly<Record<string,string>>;
  closedBrowser:{profileKey:string;observedAt:string;reopenedOriginalProfile:true;closed:true};
  browserRecord:{id:string;profileId:string;network:string;status:string;phase:string;createdAt:number;
    inputs:{txid:string;vout:number}[];quote:{fingerprint:string;profileId:string;amountSats:number};intentId?:string;commitmentTxid?:string};
}>;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const points=(rows:{txid:string;vout:number}[])=>rows.map(row=>`${row.txid}:${row.vout}`).sort();
const denied=()=>Error('guarded-boarding-non-submission-unverified');

/** Missing provider observations never prove non-submission. This requires the
 * original durable browser record and a closed, completely intercepted attempt.
 */
export function verifyBoardingNonSubmission(record:any,run:any,evidence:BoardingNonSubmissionEvidence){
  const a=run?.assignment,b=evidence?.browserRecord,closed=evidence?.closedBrowser;
  const profileKey=createHash('sha256').update(`${a?.pair}:${a?.network}:http://127.0.0.1:5174:admin:recovery:life-${a?.runId}`).digest('hex').slice(0,24);
  if(!a||a.workflow!=='boarding'||run.workflow!=='boarding'||run.phase!=='unresolved'||run.originalReconciliations||a.authorizationMode!=='player-proof'||
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
    run.sessionPublicKey||run.planToken||run.batchToken||run.batchId||!Array.isArray(run.serverRequests)||run.serverRequests.length!==1)throw denied();
  const request=run.serverRequests[0],body=request.body;
  if(request.path!=='player/challenge'||request.grant!==undefined||body?.gameId!=='stealth-and-steel'||body.network!==a.network||body.profileId!==a.gameProfileId||
    !/^[a-zA-Z0-9-]{1,100}$/.test(body.operationId??'')||!/^0[23][a-f0-9]{64}$/.test(body.playerPublicKey??'')||
    createHash('sha256').update(Buffer.from(body.playerPublicKey,'hex')).digest('hex')!==a.playerProfileId)throw denied();
  const proof={kind:evidence.kind,runId:evidence.runId,operationFingerprint:evidence.operationFingerprint,scope:evidence.scope,sourceHashes:{...evidence.sourceHashes},
    closedBrowser:{profileKey:closed.profileKey,observedAt:closed.observedAt,reopenedOriginalProfile:true,closed:true},
    browserRecord:{id:b.id,profileId:b.profileId,network:b.network,status:b.status,phase:b.phase,createdAt:b.createdAt,inputs:b.inputs.map(({txid,vout})=>({txid,vout})),
      quote:{fingerprint:b.quote.fingerprint,profileId:b.quote.profileId,amountSats:b.quote.amountSats}},requestPaths:['player/challenge'],financialDispatches:0,successfulSignatures:0};
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
