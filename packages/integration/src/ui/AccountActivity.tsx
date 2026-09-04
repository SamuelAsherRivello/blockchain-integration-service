import { useEffect, useId, useRef, useState } from 'react';
import { formatTransactionDetail, formatTransactionSummary, type BisActivity } from '../core/activity';
import { CopyFieldLabel } from './CopyFieldLabel';

export function AccountActivity({ activity, onDetailChange }: { activity: BisActivity; onDetailChange: (open: boolean) => void }) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const rows = activity.status === 'ready' || activity.status === 'unavailable' ? activity.transactions ?? [] : [];
  const selected = rows.find(row => row.id === selectedId);
  const opened = detailOpen ? selected : undefined;
  const text = opened ? formatTransactionDetail(opened) : '';
  const field = useRef<HTMLTextAreaElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => { onDetailChange(!!opened); if (opened) field.current?.focus(); }, [opened?.id, onDetailChange]);
  useEffect(() => { if (!selected) { setSelectedId(undefined); setDetailOpen(false); } }, [selected?.id]);
  useEffect(() => () => onDetailChange(false), [onDetailChange]);
  const loading = activity.status === 'idle' || activity.status === 'loading';
  const currentText = useRef(text); currentText.current = text;
  const [copy, setCopy] = useState<{ text: string; status: 'copying' | 'copied' | 'failed' }>();
  async function copyAll() {
    if (!text || (copy?.text === text && copy.status === 'copying')) return;
    const copiedText = text;
    setCopy({ text, status: 'copying' });
    try { await navigator.clipboard.writeText(copiedText); if (currentText.current === copiedText) setCopy({ text: copiedText, status: 'copied' }); }
    catch { if (currentText.current === copiedText) setCopy({ text: copiedText, status: 'failed' }); }
  }
  const status = copy?.text === text ? copy.status : undefined;
  return <div className="bis-activity">
    {opened ? <>
      <CopyFieldLabel htmlFor={id} label="Transaction" copied={status === 'copied'} disabled={status === 'copying'} onCopy={()=>void copyAll()} />
      <textarea ref={field} id={id} readOnly rows={12} value={text} />
      {status === 'copied' && <p role="status">Transaction copied.</p>}
      {status === 'failed' && <p role="status">Could not copy. Select the text and copy it manually.</p>}
      <div className="bis-actions bis-transaction-back"><button className="bis-button" onClick={() => {
        const previous = opened.id;
        setDetailOpen(false); setCopy(undefined); onDetailChange(false);
        requestAnimationFrame(() => buttons.current.get(previous)?.focus());
      }}>Back</button></div>
    </> : <>
      <h3 id={id} className="bis-transactions-heading">Transactions</h3>
      <ul className="bis-transaction-list" aria-labelledby={id} aria-busy={loading}>
        {loading && <li><p role="status">Loading...</p></li>}
        {rows.map(row => <li key={row.id}><button type="button" className="bis-transaction-row" aria-pressed={selectedId === row.id} ref={element => { if (element) buttons.current.set(row.id, element); else buttons.current.delete(row.id); }} onClick={event => {
          setSelectedId(row.id);
          if (selectedId === row.id || event.detail >= 2) setDetailOpen(true);
        }}>{formatTransactionSummary(row)}</button></li>)}
      </ul>
      {!loading && (activity.status === 'unavailable' || !rows.length) && <p role="status">{activity.status === 'unavailable' ? (rows.length ? 'Live transaction history unavailable. Showing saved operation status only. Use Refresh to retry.' : 'Transactions unavailable. Use Refresh to retry.') : 'No transactions found.'}</p>}
    </>}
  </div>;
}
