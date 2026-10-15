import type { BisTransferStatus } from '../state-layer-core/context';
import { formatTransferRecoveryReport } from '../state-layer-core/boarding-status';
import { useClipboardCopy } from './useClipboardCopy';
import { FormValue } from './FormValue';

export function TransferRecoveryDetails({ status, busy }: { status: BisTransferStatus; busy: boolean }) {
  const text = formatTransferRecoveryReport(status);
  // Changing reports remounts the copy state, preventing even A -> B -> A races.
  return text ? <details className="bis-recovery-details" open>
    <summary>Recovery details</summary>
    <RecoveryReport key={text} text={text} busy={busy} />
  </details> : null;
}

function RecoveryReport({ text, busy }: { text: string; busy: boolean }) {
  const copy = useClipboardCopy(() => text, text, busy);
  return <div className="bis-activity" aria-busy={busy}>
    <p>These public IDs reveal transaction-related information. Share only with trusted support. Nothing is sent automatically.</p>
    <FormValue label="recovery details" rows={12} wrap="soft" value={text} copyable multiline copy={copy} disabled={busy} />
    {busy && <p role="status">Checking status; report update pending.</p>}
    {!busy && copy.status === 'failed' && <p role="status">Could not copy. Select the report text and copy manually.</p>}
  </div>;
}
