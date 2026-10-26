const deny=()=>Error('Original V4 funding is not eligible for the one exact refund recovery.');
export type RefundRecoveryRun=Readonly<{artifactVersion:unknown;network:unknown;scenario:unknown;pair:unknown;sourceSha256:unknown;phase:unknown;
  outcome:unknown;game:unknown;deadlineMs:unknown;reconciliationAtMs:unknown;fundingTxid:unknown;binding?:unknown;stage?:unknown;spendTxid?:unknown;receipt?:unknown}>;
export type RefundRecoveryOperation=Readonly<{state:string;providerId?:string;intent:Readonly<{id:string;kind:string;amountSats:number;feeSats:number|null}>}>;

/** Narrow admission policy for refunding only the accidentally stranded B2
 * funding output. This does not qualify the original B2 claim or permit replay. */
export function assertV4RefundRecoveryAdmission(input:{
  runId:string;now:number;run:RefundRecoveryRun|undefined;fundingOperation:RefundRecoveryOperation|undefined;
  refundOperation:RefundRecoveryOperation|undefined;gameProfileId:string;hasConflictingOperation:boolean;
}){
  const {run,runId,now,fundingOperation,refundOperation,gameProfileId,hasConflictingOperation}=input;
  if(!run||run.artifactVersion!==4||run.network!=='mutinynet'||run.scenario!=='b2'||run.pair!=='treasure-empty-game-mutinynet'||
    run.sourceSha256!=='f702ab5e51b7e2836d95dbb9f01a0d402ec087974a707ad77d34d6c72f813bae'||
    run.phase!=='stopped-fund'||run.outcome!=='original-unresolved'||run.game!==gameProfileId||
    !Number.isSafeInteger(run.deadlineMs)||(run.deadlineMs as number)>now||!Number.isSafeInteger(run.reconciliationAtMs)||
    typeof run.fundingTxid!=='string'||!/^[a-f0-9]{64}$/.test(run.fundingTxid)||run.binding!==undefined||run.stage!==undefined||
    run.spendTxid!==undefined||run.receipt!==undefined||hasConflictingOperation)throw deny();
  if(!fundingOperation||fundingOperation.state!=='settled'||fundingOperation.providerId!==run.fundingTxid||
    !fundingOperation.intent||fundingOperation.intent.id!==`${runId}-fund`||fundingOperation.intent.kind!=='arkade-send'||
    fundingOperation.intent.amountSats!==1000||fundingOperation.intent.feeSats!==0)throw deny();
  if(refundOperation&&(!refundOperation.intent||refundOperation.intent.id!==`${runId}-refund`||
    refundOperation.intent.kind!=='refund'||refundOperation.intent.amountSats!==1000||refundOperation.intent.feeSats!==0||
    refundOperation.state!=='prepared'||refundOperation.providerId!==undefined))throw deny();
  return Object.freeze({runId,fundingTxid:run.fundingTxid as string,operationId:`${runId}-refund`,deadlineMs:run.deadlineMs as number});
}
