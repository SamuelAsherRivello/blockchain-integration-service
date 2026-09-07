import { ReportTextArea } from './ReportTextArea';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { formatTransactionDetail, formatTransactions, transactionExplorerUrl, type BisActivity } from '../core/activity';
import { shortAssetId } from '../core/asset-presentation';
import { useClipboardCopy } from './useClipboardCopy';
import { CopyableTextArea } from './CopyableTextArea';
import { CopyFieldLabel } from './CopyFieldLabel';
import type { BisContext } from '../core/context';
import { openRecoveryWindow } from './recovery-window';

export function AccountActivity({ activity, onDetailChange, context }: { activity: BisActivity; onDetailChange: (open: boolean) => void; context?: Pick<BisContext, 'checkAccountTransfer' | 'closeAccount' | 'refreshActivity'> }) {
  const id = useId();
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const rows = activity.status === 'ready' || activity.status === 'unavailable' ? activity.transactions ?? [] : [];
  const selected = rows.find(row => row.id === selectedId);
  const opened = detailOpen ? selected : undefined;
  const text = opened ? formatTransactionDetail(opened) : formatTransactions(rows);
  const explorerUrl = opened ? transactionExplorerUrl(opened) : undefined;
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
      <CopyableTextArea id={id} label="Transaction" rows={12} value={text} copy={copy} />
      {status === 'failed' && <p role="status">Could not copy. Select the text and copy it manually.</p>}
      <div className="bis-actions bis-transaction-back">
        {opened.transfer?.status === 'pending' && <button type="button" className="bis-button" onClick={() => setRecoveryBlocked(!openRecoveryWindow(opened.transfer!))}>View Recovery Info</button>}
        <button type="button" className="bis-button" disabled={!explorerUrl} aria-describedby={!explorerUrl ? `${id}-explorer-unavailable` : undefined} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open On Explorer</button>
        <button className="bis-button" onClick={() => {
        const previous = opened.id;
        setDetailOpen(false); onDetailChange(false);
        requestAnimationFrame(() => buttons.current.get(previous)?.focus());
      }}>Back</button></div>
      {recoveryBlocked && <p role="status">Allow pop-up windows to view recovery info, then try again.</p>}
      {!explorerUrl && <p id={`${id}-explorer-unavailable`}>Explorer unavailable: no transaction ID has been reported yet.</p>}
    </> : <>
      <CopyFieldLabel label="Transactions" copied={status === 'copied'} disabled={!text || loading || status === 'copying'} onCopy={() => void copyAll()} />
      <span className="bis-sr-only" role="status">{status === 'copied' ? 'Copied all transactions.' : ''}</span>
      {status === 'failed' && <>
        <p role="status">Could not copy. Select the text below and copy it manually.</p>
        <ReportTextArea aria-label="All transactions for manual copy" rows={3} value={text} />
      </>}
      {activity.status === 'unavailable' && rows.length > 0 && <p role="status">Showing available records. Full transaction history could not be refreshed. Use Refresh to retry.</p>}
      <ul className="bis-transaction-list" aria-label="Transactions" aria-busy={loading}>

        {rows.map(row => <li key={row.id}><button type="button" className="bis-transaction-row" aria-pressed={selectedId === row.id} ref={element => { if (element) buttons.current.set(row.id, element); else buttons.current.delete(row.id); }} onClick={() => {
          setSelectedId(row.id); setRecoveryBlocked(false);
          setDetailOpen(true);
        }}><strong>{row.satsUnknown?'Sats unknown':`${row.amountSats.toLocaleString('en-US')} sats`} · {row.direction}</strong><span>{row.status}</span><code title={row.identifier}>{shortAssetId(row.identifier)}</code></button></li>)}
      </ul>
      {activity.status === 'unavailable' && !rows.length && <p role="status">Transactions unavailable. Use Refresh to retry.</p>}
    </>}
  </div>;
}
