import { useEffect, useRef, useState } from 'react';
import type { BisContext } from '../core/context';
import { formatOperationRecovery, type WalletOperation, type WalletOperationsReport } from '../core/activity-operations';

export type RecoveryContext = Pick<BisContext, 'getWalletOperations' | 'checkAccountTransfer' | 'checkAccountSend' | 'getContinueStatus' | 'discardPreparedTransfer' | 'refreshActivity'>;

export function TransactionRecovery({operations, context, onReport}: {
  operations: readonly WalletOperation[]; context: Partial<RecoveryContext>; onReport(report: WalletOperationsReport): void;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const active = useRef(true);
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
  async function copy() {
    try {
      await navigator.clipboard.writeText(operations.map(formatOperationRecovery).join('\n\n'));
      if (active.current) setMessage('Recovery details copied.');
    } catch { if (active.current) setMessage('Select the transaction report to copy recovery details.'); }
  }
  return <>
    <button className="bis-button" disabled={busy || !context.getWalletOperations} onClick={() => void run()}>Check Status</button>
    <button className="bis-button" onClick={() => void copy()}>Copy Recovery Details</button>
    {operations.filter(op => op.canDiscard && op.id.startsWith('transfer:')).map(op =>
      <button key={op.id} className="bis-button" disabled={busy || !context.discardPreparedTransfer} onClick={() => void run(op)}>Discard unsent draft</button>)}
    {message && <p role="status">{message}</p>}
  </>;
}
