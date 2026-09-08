import type { BoardingRecord } from './boarding-record.ts';
import type { BisTransferStatus } from './context.ts';
import { boardingWorkerActive } from './boarding-execution.ts';
export function settlementDiagnostic(error:unknown):NonNullable<BoardingRecord['diagnostic']> {
  if(error instanceof Error&&error.name==='ServerResponseMismatchError')return 'response-mismatch';
  if(error instanceof Error&&error.message==='event stream closed')return 'event-stream-closed';
  return 'settlement-interrupted';
}
export function transferProgressLines(status:BisTransferStatus):string[] {
  const stages:Record<string,string>={registered:'Registered; awaiting batch participation','batch-selected':'Batch participation confirmed',signing:'Signing','signatures-submitted':'Signatures submitted',broadcast:'Commitment reported; awaiting confirmation',confirmed:'Confirmed receipt verified'};
  const executions:Record<string,string>={running:'Processing in this session','awaiting-confirmation':'Awaiting receipt verification',interrupted:'Processing interrupted; recovery needed',unknown:'Active processing cannot be confirmed',complete:'Complete'};
  const actions:Record<string,string>={'confirm-registration':'Confirm batch participation','tree-nonces':'Submit signing nonces','tree-signatures':'Submit tree signatures','forfeit-signatures':'Submit final signatures','event-stream':'Read settlement updates',settlement:'Settle transfer','validate-tree':'Validate proposed transaction tree','validate-finalization':'Validate final transaction'};
  const stage=stages[status.stage??''],execution=executions[status.execution??''],action=actions[status.action??''];
  const time=new Date(Number.isSafeInteger(status.observedAt)&&status.observedAt!>0?status.observedAt!:NaN);
  return [`Progress: ${typeof stage==='string'?stage:'Unknown'}`,`Processing: ${typeof execution==='string'?execution:'Active processing cannot be confirmed'}`,
    ...(typeof action==='string'?[`Last signing action attempted: ${action}`]:[]),
    ...(Number.isFinite(time.getTime())?[`Progress observed by this app (UTC): ${time.toISOString()}`]:[])];
}

/** A public-data projection, never a serialization of wallet or provider state. */
export function formatTransferRecoveryReport(status: BisTransferStatus): string {
  if (status.status !== 'pending') return '';
  const uuid = (value?: string) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : 'Unknown';
  const phase = status.phase === 'registered' ? 'Registered' : status.phase === 'submitting' ? 'Submission may have reached the operator' : status.phase === 'prepared' ? 'Prepared' : 'Unknown';
  const diagnostic = status.diagnostic === 'registration-unconfirmed' ? 'Registration response unconfirmed' : status.diagnostic === 'deadline-exceeded' ? 'Processing time limit reached' : status.diagnostic === 'settlement-interrupted' ? 'Processing interrupted' : status.diagnostic==='response-mismatch'?'SDK rejected a mismatching operator response':status.diagnostic==='event-stream-closed'?'Settlement event stream closed':status.diagnostic==='batch-failed'?'Operator reported the selected batch failed':'Not recorded';
  return [
    'Transfer recovery report',
    'Network: Signet',
    'Status: Pending; completion has not been verified',
    `Direction: ${status.direction === 'to-bitcoin' ? 'Arkade → Bitcoin' : status.direction === 'to-arkade' ? 'Bitcoin → Arkade' : 'Unknown'}`,
    `Amount: ${Number.isSafeInteger(status.amountSats) && status.amountSats! > 0 ? `${status.amountSats} sats` : 'Unknown'}`,
    `Transfer ID: ${uuid(status.operationId)}`,
    `Operator intent: ${uuid(status.intentId)}`,
    `Bitcoin transaction: ${typeof status.commitmentTxid === 'string' && /^[a-f0-9]{64}$/i.test(status.commitmentTxid) ? status.commitmentTxid : 'Not recorded'}`,
    `Recorded phase: ${phase}`,
    `Verification: ${status.verification === 'unavailable' ? 'Unavailable' : status.verification === 'live' ? 'Latest check returned; completion remains unverified' : 'Unknown'}`,
    `Diagnostic: ${diagnostic}`,
    ...transferProgressLines(status),
    '',
    'This is a status snapshot, not proof of cancellation or failure. Refresh Transactions and reopen Recovery Info for the latest available details.',
    'Do not replay this transfer. Its inputs remain reserved while the outcome is unresolved; independent funds may be transferred after confirmation.',
    'Status checks cannot resume interrupted signing. Copying this report does not cancel the transfer or contact the operator.',
    '',
    'Questions for trusted operator support:',
    'Please investigate the intent above and provide its batch/commitment outcome.',
    'If it failed, provide authoritative evidence tied to this intent that it cannot subsequently settle.',
    'If cancellation is required, confirm exact-intent targeting and how cancellation excludes an already-selected settlement.',
    '',
    'These public IDs reveal transaction-related information. Share only with trusted support. Never share recovery phrases, private keys or signed proofs.',
  ].join('\n');
}

export function settlementTimeoutMs(session: {sessionDuration: bigint; scheduledSession?: {nextEndTime: bigint}}, now = Date.now()) {
  const duration=Number(session.sessionDuration)*1000;
  const end=Number(session.scheduledSession?.nextEndTime??0n)*1000;
  if(!Number.isSafeInteger(duration)||duration<0||!Number.isSafeInteger(end)||end<0)throw Error('The operator settlement schedule could not be verified.');
  // Cover scheduled waiting plus two session durations and a network grace minute.
  const timeout=Math.max(180000,Math.max(0,end-now)+2*duration+60000);
  if(!Number.isSafeInteger(timeout)||timeout>2147483647)throw Error('The operator settlement schedule could not be verified.');
  return timeout;
}

export function transferStatus(record?: BoardingRecord, verification: 'live' | 'unavailable' = 'live') {
  const stage=record?.status==='succeeded'?'confirmed':record?.progress?.stage??(record?.commitmentTxid?'broadcast':record?.phase==='registered'?'registered':undefined);
  const execution=record?.status==='succeeded'?'complete':record?.commitmentTxid||record?.progress?.execution==='awaiting-confirmation'?'awaiting-confirmation':record?.progress?.execution==='interrupted'||record?.diagnostic?'interrupted':record&&boardingWorkerActive(record.profileId,record.id)?'running':'unknown';
  return Object.freeze({status:record?.status??'idle',amountSats:record?.quote.amountSats,commitmentTxid:record?.commitmentTxid,operationId:record?.id,intentId:record?.intentId,direction:record?.quote.direction,phase:record?.phase,diagnostic:record?.diagnostic,verification,stage,execution,observedAt:record?.progress?.observedAt,action:record?.progress?.action});
}
