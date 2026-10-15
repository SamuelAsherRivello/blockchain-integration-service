import { useEffect, useRef, useState } from 'react';
import type { BisContext } from '../state-layer-core/context';
import { formatOperationRecovery, type WalletOperation, type WalletOperationsReport } from '../state-layer-core/activity-operations';
import { CopyButton } from './IconButton';
import { useClipboardCopy } from './useClipboardCopy';

export type RecoveryContext = Pick<BisContext, 'getWalletOperations' | 'checkAccountTransfer' | 'checkAccountSend' | 'getContinueStatus' | 'discardPreparedTransfer' | 'refreshActivity'>;

export function TransactionRecovery({operations, context, onReport}: {
  operations: readonly WalletOperation[]; context: Partial<RecoveryContext>; onReport(report: WalletOperationsReport): void;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const active = useRef(true);
  const copy = useClipboardCopy(() => operations.map(formatOperationRecovery).join('\n\n'), operations.map(op => op.id).join('|'), busy);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function run(discard?: WalletOperation) {
    setBusy(true); setMessage('');
    try {
      if (discard) await context.discardPreparedTransfer?.(discard.id.slice(9));
      else {
        const kinds = new Set(operations.map(op => op.id.split(':')[0]));
        if (kinds.has('transfer')) await context.checkAccountTransfer?.();
        if (kinds.has('send')) await context.checkAccountSend?.();
        for (const op of operations.filter(op => op.id.startsWith('continue:'))) await context.getContinueStatus?.(op.id.slice(9));
      }
      const report = await context.getWalletOperations?.();
      if (!active.current) return;
      if (report) onReport(report);
      setMessage(discard ? 'Unsent draft discarded.' : 'Status checked. Unverified outcomes remain pending.');
      void context.refreshActivity?.();
    } catch { if (active.current) setMessage('Status could not be verified. Recovery records are preserved.'); }
    finally { if (active.current) setBusy(false); }
  }
  return <>
    <button className="bis-button" disabled={busy || !context.getWalletOperations} onClick={() => void run()}>Check Status</button>
    <CopyButton label="Recovery Details" copied={copy.status === 'copied'} disabled={busy || copy.status === 'copying' || !operations.length} onClick={() => void copy.copy()} />
    {operations.filter(op => op.canDiscard && op.id.startsWith('transfer:')).map(op =>
      <button key={op.id} className="bis-button" disabled={busy || !context.discardPreparedTransfer} onClick={() => void run(op)}>Discard unsent draft</button>)}
    {message && <p role="status">{message}</p>}
    {copy.status === 'failed' && <p role="status">Select the transaction report to copy recovery details.</p>}
  </>;
}
