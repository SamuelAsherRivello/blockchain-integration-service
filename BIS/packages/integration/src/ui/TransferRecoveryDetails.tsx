import type { BisTransferStatus } from '../core/context';
import { formatTransferRecoveryReport } from '../core/boarding-status';
import { useClipboardCopy } from './useClipboardCopy';
import { CopyableTextArea } from './CopyableTextArea';

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
    <CopyableTextArea label="recovery details" rows={12} wrap="soft" value={text} copy={copy} disabled={busy} />
    {(busy || copy.status !== 'idle') && <p role="status">{busy ? 'Checking status; report update pending.' : copy.status === 'copying' ? 'Copying recovery details…' : copy.status === 'copied' ? 'Recovery details copied.' : 'Could not copy. Select the report text and copy manually.'}</p>}
  </div>;
}
