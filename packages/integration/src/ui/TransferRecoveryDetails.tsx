import { useEffect, useId, useRef, useState } from 'react';
import type { BisTransferStatus } from '../core/context';
import { formatTransferRecoveryReport } from '../core/boarding-status';
import { CopyFieldLabel } from './CopyFieldLabel';

export function TransferRecoveryDetails({ status, busy }: { status: BisTransferStatus; busy: boolean }) {
  const text = formatTransferRecoveryReport(status);
  // Changing reports remounts the copy state, preventing even A -> B -> A races.
  return text ? <details className="bis-recovery-details" open>
    <summary>Recovery details</summary>
    <RecoveryReport key={text} text={text} busy={busy} />
  </details> : null;
}

function RecoveryReport({ text, busy }: { text: string; busy: boolean }) {
  const id = useId();
  const alive = useRef(true);
  const copying = useRef(false);
  const [copy, setCopy] = useState<'copying' | 'copied' | 'failed'>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function copyReport() {
    if (busy || copying.current) return;
    copying.current = true;
    setCopy('copying');
    try {
      await navigator.clipboard.writeText(text);
      if (alive.current) setCopy('copied');
    } catch {
      if (alive.current) setCopy('failed');
    } finally { copying.current = false; }
  }
  return <div className="bis-activity" aria-busy={busy}>
    <p>These public IDs reveal transaction-related information. Share only with trusted support. Nothing is sent automatically.</p>
    <CopyFieldLabel htmlFor={id} label="recovery details" copied={copy === 'copied'} disabled={busy || copy === 'copying'} onCopy={() => void copyReport()} />
    <textarea id={id} readOnly rows={12} wrap="soft" value={text} />
    {(busy || copy) && <p role="status">{busy ? 'Checking status; report update pending.' : copy === 'copying' ? 'Copying recovery details…' : copy === 'copied' ? 'Recovery details copied.' : 'Could not copy. Select the report text and copy manually.'}</p>}
  </div>;
}
