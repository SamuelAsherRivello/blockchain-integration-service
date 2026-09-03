import { useId, useRef, useState } from 'react';
import { formatTransactions, type BisActivity } from '../core/activity';
import { CopyFieldLabel } from './CopyFieldLabel';

export function AccountActivity({ activity }: { activity: BisActivity }) {
  const id = useId();
  const text = activity.status === 'ready' ? formatTransactions(activity.transactions) : '';
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
    <CopyFieldLabel htmlFor={id} label="Transactions" copied={status === 'copied'} disabled={!text || status === 'copying'} onCopy={()=>void copyAll()} />
    <textarea id={id} readOnly wrap="off" rows={9} value={loading ? 'Loading...' : text} aria-busy={loading} />
    {!loading && (activity.status === 'unavailable' || !text || status === 'copied' || status === 'failed') && <p role="status">{activity.status === 'unavailable' ? 'Transactions unavailable. Use Refresh to retry.' : !text ? 'No transactions found.' : status === 'copied' ? 'Transactions copied.' : 'Could not copy. Select the text and copy it manually.'}</p>}
  </div>;
}
