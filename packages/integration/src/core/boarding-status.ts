import type { BoardingRecord } from './boarding-record.ts';
import type { BisTransferStatus } from './context.ts';

/** A public-data projection, never a serialization of wallet or provider state. */
export function formatTransferRecoveryReport(status: BisTransferStatus): string {
  if (status.status !== 'pending') return '';
  const uuid = (value?: string) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : 'Unknown';
  const phase = status.phase === 'registered' ? 'Registered' : status.phase === 'submitting' ? 'Submission may have reached the operator' : status.phase === 'prepared' ? 'Prepared' : 'Unknown';
  const diagnostic = status.diagnostic === 'registration-unconfirmed' ? 'Registration response unconfirmed' : status.diagnostic === 'deadline-exceeded' ? 'Processing time limit reached' : status.diagnostic === 'settlement-interrupted' ? 'Processing interrupted' : 'Not recorded';
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
    '',
    'This is a status snapshot, not proof of cancellation or failure. Refresh Account Activity and reopen Recovery Info for the latest available details.',
    'Do not resubmit. Log Out and Reset remain blocked while the transfer is unresolved.',
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
  return Object.freeze({status:record?.status??'idle',amountSats:record?.quote.amountSats,commitmentTxid:record?.commitmentTxid,operationId:record?.id,intentId:record?.intentId,direction:record?.quote.direction,phase:record?.phase,diagnostic:record?.diagnostic,verification});
}
