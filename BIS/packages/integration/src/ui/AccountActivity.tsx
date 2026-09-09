import { ReportTextArea } from './ReportTextArea';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { formatTransactionDetail, formatTransactions, transactionRowPresentation, transactionExplorerUrl, type BisActivity } from '../core/activity';
import { shortAssetId } from '../core/asset-presentation';
import { useClipboardCopy } from './useClipboardCopy';
import { CopyableTextArea } from './CopyableTextArea';
import { CopyFieldLabel } from './CopyFieldLabel';
import type { BisContext } from '../core/context';
import { RecoveryInfoDialog } from './recovery-window';
import { formatOperationRecovery, operationMatches, withWalletOperationActivity, type WalletOperationsReport } from '../core/activity-operations';
import type { RecoveryContext } from './TransactionRecovery';
import { formatTransferRecoveryReport } from '../core/boarding-status';

export function AccountActivity({ activity, onDetailChange, context }: { activity: BisActivity; onDetailChange: (open: boolean) => void; context?: Pick<BisContext, 'checkAccountTransfer' | 'closeAccount' | 'refreshActivity'> & Partial<RecoveryContext> }) {
  const id = useId();
  const [recoveryDialog, setRecoveryDialog] = useState<{ report: string; trigger: HTMLButtonElement }>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [report, setReport] = useState<WalletOperationsReport>();
  const [reportError, setReportError] = useState(false);
  useEffect(() => {
    if (!context?.getWalletOperations) return;
    let active = true;
    void context.getWalletOperations().then(value => { if (active) { setReport(value); setReportError(false); } })
      .catch(() => { if (active) { setReport(undefined); setReportError(true); } });
    return () => { active = false; };
  }, [context, activity]);
  const rows = withWalletOperationActivity(activity.status === 'ready' || activity.status === 'unavailable' ? activity.transactions ?? [] : [], report?.operations ?? []);
  const selected = rows.find(row => row.id === selectedId);
  const opened = detailOpen ? selected : undefined;
  const recovery = opened ? report?.operations.filter(op => operationMatches(opened, op)) ?? [] : [];
  const funds = report && recovery.length ? [
    `Wallet total: ${report.totalSats === undefined ? 'Unavailable' : `${report.totalSats} sats`}`,
    `Wallet reserved inputs: ${report.reservedInputSats === undefined ? 'Unavailable' : `${report.reservedInputSats} sats`}`,
    `Available for independent payments: ${report.availableSats === undefined ? 'Unavailable' : `${report.availableSats} sats`}`,
    ...(report.reason ? [report.reason] : []),
  ].join('\n') : '';
  const text = opened ? [formatTransactionDetail(opened), ...recovery.map(formatOperationRecovery), ...(funds ? [funds] : [])].join('\n\n') : formatTransactions(rows);
  const explorerUrl = opened ? transactionExplorerUrl(opened) : undefined;
  const recoveryText = [opened?.transfer ? formatTransferRecoveryReport(opened.transfer) : '', ...recovery.map(formatOperationRecovery), funds].filter(Boolean).join('\n\n');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => { onDetailChange(detailOpen); }, [detailOpen, onDetailChange]);
  useLayoutEffect(() => { if (activity.status==='ready' && !selected) { setSelectedId(undefined); setDetailOpen(false); } }, [selected?.id,activity.status]);
  useEffect(() => () => onDetailChange(false), [onDetailChange]);
  const loading = activity.status === 'idle' || activity.status === 'loading';
  const foreground=useRef(true);
  if(loading)foreground.current=true;
  if(activity.status==='ready')foreground.current=false;
  usePendingNotice(loading,'Loading...', foreground.current && !rows.length && activity.status==='unavailable'?'Transactions could not be loaded.':undefined,()=>{
    if(detailOpen){setDetailOpen(false);setSelectedId(undefined);void context?.refreshActivity();}
    else context?.closeAccount();
  });
  const copy = useClipboardCopy(() => text, text, loading);
  const { status, copy: copyAll } = copy;
  return <div className="bis-activity">
    {opened ? <>
      <CopyableTextArea id={id} label="Transaction" rows={12} value={text} copy={copy} scrollable />
      {status === 'failed' && <p role="status">Could not copy. Select the text and copy it manually.</p>}
      <div className="bis-actions bis-transaction-back">
        <button type="button" className="bis-button" disabled={!recoveryText} onClick={event => setRecoveryDialog({ report: recoveryText, trigger: event.currentTarget })}>View Recovery Info</button>
        <button type="button" className="bis-button" disabled={!explorerUrl} title={!explorerUrl ? 'Explorer unavailable: no supported transaction ID has been reported yet.' : undefined} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open On Explorer</button>
        <button className="bis-button bis-back" onClick={() => {
        const previous = opened.id;
        setDetailOpen(false); onDetailChange(false);
        requestAnimationFrame(() => buttons.current.get(previous)?.focus());
      }}>Back</button></div>
      {recoveryDialog && <RecoveryInfoDialog {...recoveryDialog} onBack={() => setRecoveryDialog(undefined)} />}
    </> : <>
      <CopyFieldLabel label="Transactions" copied={status === 'copied'} disabled={!text || loading || status === 'copying'} onCopy={() => void copyAll()} />
      {reportError && <p role="status">Pending recovery details unavailable. Use Refresh to retry.</p>}
      <span className="bis-sr-only" role="status">{status === 'copied' ? 'Copied all transactions.' : ''}</span>
      {status === 'failed' && <>
        <p role="status">Could not copy. Select the text below and copy it manually.</p>
        <ReportTextArea aria-label="All transactions for manual copy" rows={3} value={text} />
      </>}
      {activity.status === 'unavailable' && rows.length > 0 && <p role="status">Showing available records. Full transaction history could not be refreshed. Use Refresh to retry.</p>}
      <ul className="bis-transaction-list" aria-label="Transactions" aria-busy={loading}>

        {rows.map(row => { const presentation = transactionRowPresentation(row); return <li key={row.id}><button type="button" className="bis-transaction-row" aria-pressed={selectedId === row.id} ref={element => { if (element) buttons.current.set(row.id, element); else buttons.current.delete(row.id); }} onClick={() => {
          setSelectedId(row.id); setRecoveryDialog(undefined);
          setDetailOpen(true);
        }}><strong>{presentation.heading}</strong><span>{presentation.network}</span><code title={row.identifier}>{shortAssetId(presentation.identifier)}</code></button></li>; })}
      </ul>
      {activity.status === 'unavailable' && !rows.length && <p role="status">Transactions unavailable. Use Refresh to retry.</p>}
    </>}
  </div>;
}
