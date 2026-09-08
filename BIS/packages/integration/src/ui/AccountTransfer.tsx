import { ReviewDetails, formatSats as sats } from './ReviewDetails';
import { useQuoteExpiry } from './useQuoteExpiry';
import { readWithRetry } from '../core/pending-read';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useId, useRef, useState } from 'react';
import type { BisBalance, BisContext, BisTransferStatus } from '../core/context';
import { boardingSubmissionEnabled, type BoardingQuote } from '../core/boarding-quote';
import { AccountBalances } from './AccountBalances';
import { AmountChooserRow } from './AmountChooserRow';
import { PendingTransferConfirmationError } from '../core/boarding-record';

export function AccountTransfer({ context, balance, onBack }: { context: BisContext; balance: BisBalance; onBack(): void }) {
  const [direction, setDirection] = useState<'to-arkade' | 'to-bitcoin'>('to-arkade');
  const [amount, setAmount] = useState('0');
  const [review, setReview] = useState(false);
  const [quote, setQuote] = useState<BoardingQuote>();
  const [busy, setBusy] = useState(true);
  const [foreground, setForeground] = useState(true);
  const [operationLabel,setOperationLabel] = useState('Loading...');
  const readController=useRef(new AbortController());
  const [statusChecked, setStatusChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BisTransferStatus>({status:'idle'});
  const [error, setError] = useState('');
  const [submitted,setSubmitted]=useState(false);
  const [warning,setWarning]=useState<readonly BisTransferStatus[]>();
  const acknowledged=useRef<readonly string[]>([]);
  const expired = useQuoteExpiry(quote?.expiresAt);
  const alive = useRef(true);
  const request = useRef(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);
  const amountId = useId();
  const numeric = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(numeric) && numeric > 0;
  const label = direction === 'to-arkade' ? 'Bitcoin → Arkade' : 'Arkade → Bitcoin';
  const pending = status.status === 'pending';
  const blocked = !statusChecked;
  function failure(cause: unknown) {
    const message = cause instanceof Error ? cause.message : '';
    return /^(Choose an eligible|Leave at least|The operator fee schedule changed|The operator settlement schedule|Transfer details changed|Transfer status could not be verified|Review a fresh|A transfer is unresolved|Another wallet operation|No confirmed eligible|No spendable|No eligible)/.test(message) ? message : 'Transfer information could not be verified. Choose Check Status before reviewing again.';
  }
  async function check(clearError=true, background=false) {
    const current=++request.current;if(!background)setBusy(true);
    if(!background){setForeground(true);setOperationLabel('Checking...');if(clearError)setError('');}
    try {
      const next=await readWithRetry(()=>context.checkAccountTransfer(),readController.current.signal);
      if(!alive.current||current!==request.current)return;
      setStatus(next);setStatusChecked(true);
      if(next.status==='succeeded'&&!background)await context.refreshBalance();
    } catch(cause) {
      if(alive.current&&current===request.current){setStatusChecked(false);setStatus(previous=>previous.status==='pending'?{...previous,verification:'unavailable'}:previous);if(!background)setError(failure(cause));}
    } finally {if(alive.current&&current===request.current){setBusy(false);setForeground(false);}}
  }
  useEffect(()=>{
    alive.current=true;readController.current=new AbortController();
    try {
      const records=context.getPendingAccountTransfers();
      if(records.length){setStatus(records[records.length-1]);setStatusChecked(true);setBusy(false);setForeground(false);}
      else void check();
    }catch(cause){setError(failure(cause));setBusy(false);setForeground(false);}
    return()=>{alive.current=false;request.current++;readController.current.abort();};
  },[context]);
  useEffect(()=>{
    if(!pending||review||warning||submitted)return;
    const timer=setInterval(()=>{if(!busy)void check(false,true);},10000);
    return()=>clearInterval(timer);
  },[pending,busy,review,warning,submitted]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (review) reviewHeading.current?.focus(); else amountInput.current?.focus();
  }, [review]);
  function edit(value:string) {request.current++;setQuote(undefined);setReview(false);setError('');setAmount(value);}
  function reviewTransfer() {
    try {
      const transfers=context.getPendingAccountTransfers();
      acknowledged.current=[];
      if(transfers.length){setWarning(transfers);return;}
      void loadQuote();
    }catch(cause){setError(failure(cause));}
  }
  function acceptWarning() {
    acknowledged.current=warning!.flatMap(r=>r.operationId?[r.operationId]:[]);
    setWarning(undefined);void loadQuote();
  }
  async function loadQuote(max=false) {
    const current=++request.current;setBusy(true);setForeground(true);setOperationLabel('Preparing...');setError('');setQuote(undefined);
    try {
      const next=await readWithRetry(()=>context.quoteAccountTransfer(max?undefined:numeric,direction),readController.current.signal);
      if(!alive.current||current!==request.current)return;
      setQuote(next);setAmount(String(next.amountSats));setReview(!max);setStatus({status:'idle'});
    }catch(cause){if(alive.current&&current===request.current)setError(failure(cause));}
    finally{if(alive.current&&current===request.current){setBusy(false);setForeground(false);}}
  }
  async function confirm() {
    if(!boardingSubmissionEnabled||!quote||busy||blocked||expired)return;
    const current=++request.current;setBusy(true);setForeground(true);setOperationLabel('Transferring...');setSubmitting(true);setStatusChecked(false);setError('');
    try {
      const next=await context.confirmAccountTransfer(quote,acknowledged.current);
      if(!alive.current||current!==request.current)return;
      setStatus(next);setQuote(undefined);setStatusChecked(true);
      if(next.status==='succeeded')await context.refreshBalance();
      else if(next.status==='pending')setSubmitted(true);
      else setError('Transfer was not submitted. Review a fresh transfer.');
    }catch(cause){if(alive.current&&current===request.current){
      if(cause instanceof PendingTransferConfirmationError){setStatusChecked(true);setWarning(context.getPendingAccountTransfers());}
      else setError(failure(cause));
      setQuote(undefined);
    }}
    finally{if(alive.current&&current===request.current){setSubmitting(false);setBusy(false);setForeground(false);setReview(false);}}
  }
  usePendingNotice(foreground,operationLabel,error||undefined,warning?()=>setWarning(undefined):onBack,
    warning?{title:'Pending transfer',message:`You already have a transfer of ${sats(warning.reduce((total,r)=>total+(r.amountSats??0),0))} pending. Are you sure you want to send another?`,confirm:acceptWarning}
    :submitted?{title:'Transfer pending.',message:'You can view progress in Transactions.'}:undefined);
  return <>
    <div className="bis-transfer-balances"><AccountBalances balance={balance} directionControl={
      <button type="button" className="bis-button bis-balance-direction" disabled={busy||blocked||review}
        aria-label={`${label}. Toggle transfer direction`} title={`${label}. Toggle transfer direction`}
        onClick={() => {edit(amount);setDirection(current => current === 'to-arkade' ? 'to-bitcoin' : 'to-arkade');}}>
        {direction === 'to-arkade' ? '→' : '←'}
      </button>
    } /></div>
    {review ? <div className="bis-review">
      <h3 ref={reviewHeading} tabIndex={-1} data-bis-autofocus>Review: {label}</h3>
      <ReviewDetails rows={[
        ['Amount', sats(numeric)], ['Fee', quote ? sats(quote.feeSats) : 'Unavailable'],
        [`Added to ${direction === 'to-arkade' ? 'Arkade' : 'Bitcoin'}`, quote ? sats(quote.netSats) : 'Unavailable'],
      ]} />
      {quote && <><h3>After transfer (estimate)</h3><ReviewDetails rows={[
        ['Total balance', sats(quote.totalAfterSats)], ['Bitcoin balance', sats(quote.bitcoinAfterSats)], ['Arkade balance', sats(quote.arkadeAfterSats)],
      ]} /></>}
      {expired && <p role="status">Quote expired. Go Back for a fresh review.</p>}
    </div> : <div className="bis-transfer-form">
      <AmountChooserRow value={amount} onChange={edit} onMax={()=>void loadQuote(true)} disabled={busy||blocked} maxDisabled={balance.status!=='ready'} inputRef={amountInput} describedBy={amount !== '0' && !valid ? `${amountId}-help` : undefined} />
      {amount !== '0' && !valid && <p id={`${amountId}-help`} className="bis-transfer-help">Enter a positive whole number of sats.</p>}
    </div>}
    {direction==='to-bitcoin' && <p className="bis-transfer-help bis-transfer-direction-help">Bitcoin returns to this account's boarding address. It stays Bitcoin until you choose to transfer it back to Arkade.</p>}
    {!boardingSubmissionEnabled && <p className="bis-warning">Quotes are available. Confirmation is disabled while interrupted-transfer recovery is being verified.</p>}
    {pending && <p className="bis-transfer-help" role="status">Check Transactions for updates on pending transfers.</p>}
    {status.status==='not-submitted' && <p role="status">Transfer was not submitted. Review again to start a new transfer.</p>}
    {direction==='to-arkade' && balance.status==='ready' && balance.bitcoinSats===0 && <p className="bis-transfer-help bis-transfer-direction-help" role="status">No Bitcoin funds to transfer.</p>}
    <div className="bis-actions">
      {review ? <button className="bis-button bis-primary" disabled={!boardingSubmissionEnabled||!quote||expired||busy||blocked} onClick={()=>void confirm()}>Confirm Transfer</button>
        : <button className="bis-button bis-primary" disabled={!valid||busy||blocked||balance.status!=='ready'} onClick={reviewTransfer}>Review Transfer</button>}
      {error && !pending && <button className="bis-button" disabled={busy} onClick={()=>void check()}>Check Status</button>}
      <button className="bis-button" onClick={() => review ? (setReview(false),setQuote(undefined)) : onBack()}>Back</button>
    </div>
  </>;
}
