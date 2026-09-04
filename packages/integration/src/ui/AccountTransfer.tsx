import { useEffect, useId, useRef, useState } from 'react';
import type { BisBalance, BisContext, BisTransferStatus } from '../core/context';
import { boardingSubmissionEnabled, type BoardingQuote } from '../core/boarding-quote';
import { AccountBalances } from './AccountBalances';
import { TransferRecoveryDetails } from './TransferRecoveryDetails';

export function AccountTransfer({ context, balance, onBack }: { context: BisContext; balance: BisBalance; onBack(): void }) {
  const [direction, setDirection] = useState<'to-arkade' | 'to-bitcoin'>('to-arkade');
  const [amount, setAmount] = useState('0');
  const [review, setReview] = useState(false);
  const [quote, setQuote] = useState<BoardingQuote>();
  const [busy, setBusy] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BisTransferStatus>({status:'idle'});
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const alive = useRef(true);
  const request = useRef(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);
  const amountId = useId(), radioName = useId();
  const numeric = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(numeric) && numeric > 0;
  const label = direction === 'to-arkade' ? 'Bitcoin → Arkade' : 'Arkade → Bitcoin';
  const pending = status.status === 'pending';
  const blocked = pending || !statusChecked;
  function failure(cause: unknown) {
    const message = cause instanceof Error ? cause.message : '';
    return /^(Choose an eligible|Leave at least|The operator fee schedule changed|The operator settlement schedule|Transfer details changed|Transfer status could not be verified|Review a fresh|A transfer is unresolved|Another wallet operation|No confirmed eligible|No eligible)/.test(message) ? message : 'Transfer information could not be verified. Choose Check Status before reviewing again.';
  }
  async function check(clearError=true) {
    const current=++request.current;setBusy(true);if(clearError)setError('');
    try {
      const next=await context.checkAccountTransfer();
      if(!alive.current||current!==request.current)return;
      setStatus(next);
      setStatusChecked(true);
      if(next.status==='pending') {if(next.direction)setDirection(next.direction);if(next.amountSats!==undefined)setAmount(String(next.amountSats));setReview(false);setQuote(undefined);}
      if(next.status==='succeeded') {setQuote(undefined);setReview(false);await context.refreshBalance();}
    } catch(cause) {if(alive.current&&current===request.current){setStatusChecked(false);setStatus(previous=>previous.status==='pending'?{...previous,verification:'unavailable'}:previous);setError(failure(cause));}}
    finally {if(alive.current&&current===request.current)setBusy(false);}
  }
  useEffect(()=>{alive.current=true;void check();return()=>{alive.current=false;request.current++;};},[context]);
  useEffect(()=>{
    if(!pending)return;
    const timer=setInterval(()=>{if(!busy)void check();},10000);
    return()=>clearInterval(timer);
  },[pending,busy]);
  useEffect(()=>{
    setExpired(false);
    if(!quote)return;
    const timer=setTimeout(()=>setExpired(true),Math.max(0,quote.expiresAt-Date.now()));
    return()=>clearTimeout(timer);
  },[quote]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (review) reviewHeading.current?.focus(); else amountInput.current?.focus();
  }, [review]);
  function edit(value:string) {request.current++;setQuote(undefined);setReview(false);setError('');setAmount(value);}
  const adjust = (step: number) => edit(String(Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, (Number.isSafeInteger(numeric) ? numeric : 0) + step))));
  async function loadQuote(max=false) {
    const current=++request.current;setBusy(true);setError('');setQuote(undefined);
    try {
      const next=await context.quoteAccountTransfer(max?undefined:numeric,direction);
      if(!alive.current||current!==request.current)return;
      setQuote(next);setAmount(String(next.amountSats));setReview(!max);setStatus({status:'idle'});
    }catch(cause){if(alive.current&&current===request.current)setError(failure(cause));}
    finally{if(alive.current&&current===request.current)setBusy(false);}
  }
  async function confirm() {
    if(!boardingSubmissionEnabled||!quote||busy||blocked||expired)return;
    const current=++request.current;setBusy(true);setSubmitting(true);setStatusChecked(false);setError('');
    try {
      const next=await context.confirmAccountTransfer(quote);
      if(alive.current&&current===request.current){setStatus(next);setQuote(undefined);}
    }catch(cause){if(alive.current&&current===request.current){setError(failure(cause));setQuote(undefined);}}
    finally{if(alive.current&&current===request.current){setSubmitting(false);setBusy(false);setReview(false);void check(false);}}
  }
  const sats=(value:number)=>`${value.toLocaleString('en-US')} sats`;
  return <>
    <AccountBalances balance={balance} />
    {review ? <div className="bis-transfer-review">
      <h3 ref={reviewHeading} tabIndex={-1}>Review: {label}</h3>
      <dl>
        <div><dt>Amount</dt><dd>{sats(numeric)}</dd></div>
        <div><dt>Fee</dt><dd>{quote?sats(quote.feeSats):'Unavailable'}</dd></div>
        <div><dt>Added to {direction === 'to-arkade' ? 'Arkade' : 'Bitcoin'}</dt><dd>{quote?sats(quote.netSats):'Unavailable'}</dd></div>
      </dl>
      {quote && <><h3>After transfer (estimate)</h3><dl>
        <div><dt>Total balance</dt><dd>{sats(quote.totalAfterSats)}</dd></div>
        <div><dt>Bitcoin balance</dt><dd>{sats(quote.bitcoinAfterSats)}</dd></div>
        <div><dt>Arkade balance</dt><dd>{sats(quote.arkadeAfterSats)}</dd></div>
      </dl></>}
      {expired && <p role="status">Quote expired. Go Back for a fresh review.</p>}
    </div> : <div className="bis-transfer-form">
      <fieldset disabled={busy||blocked}>
        <legend>Direction</legend>
        <label><input type="radio" name={radioName} checked={direction === 'to-arkade'} onChange={() => {edit(amount);setDirection('to-arkade');}} /> Bitcoin → Arkade</label>
        <label><input type="radio" name={radioName} checked={direction === 'to-bitcoin'} onChange={() => {edit(amount);setDirection('to-bitcoin');}} /> Arkade → Bitcoin</label>
      </fieldset>
      <label htmlFor={amountId}>Amount (sats)</label>
      <div className="bis-transfer-amount">
        <button type="button" className="bis-button" aria-label="Decrease amount" disabled={busy||blocked||numeric <= 0 || !Number.isSafeInteger(numeric)} onClick={() => adjust(-1)}>−</button>
        <input ref={amountInput} disabled={busy||blocked} id={amountId} inputMode="numeric" autoComplete="off" value={amount} onChange={event => edit(event.target.value)} aria-describedby={`${amountId}-help`} />
        <button type="button" className="bis-button" aria-label="Increase amount" disabled={busy||blocked||numeric >= Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(numeric)} onClick={() => adjust(1)}>+</button>
        <button type="button" className="bis-button" disabled={busy||blocked||balance.status!=='ready'} onClick={()=>void loadQuote(true)}>Max</button>
      </div>
      <p id={`${amountId}-help`} className="bis-transfer-help">{amount !== '0' && !valid ? 'Enter a positive whole number of sats.' : 'Review checks eligible funds and fees before confirmation.'}</p>
    </div>}
    {direction==='to-bitcoin' && <p className="bis-transfer-help">Bitcoin returns to this account's boarding address. It stays Bitcoin until you choose to transfer it back to Arkade.</p>}
    {!boardingSubmissionEnabled && <p className="bis-warning">Quotes are available. Confirmation is disabled while interrupted-transfer recovery is being verified.</p>}
    {pending && <div className="bis-warning bis-transfer-status" role="status">
      <p>{status.verification==='unavailable' ? 'Verification is unavailable. Check Status will retry without submitting another transfer.'
        : status.commitmentTxid ? 'Settlement transaction recorded. Checking Bitcoin confirmation and received amounts.'
        : status.phase==='registered' ? 'Registered with the operator. Transfer completion has not been verified.'
        : status.phase==='prepared' ? 'Transfer preparation is awaiting recovery.'
        : 'Submission outcome is unknown. Check Status will look for completion evidence.'}</p>
      {status.diagnostic && <p>{status.diagnostic==='registration-unconfirmed'?'The registration response was not confirmed.':status.diagnostic==='deadline-exceeded'?'Transfer processing reached its time limit.':'Transfer processing was interrupted.'}</p>}
      <p>Log Out and Reset are blocked until this transfer is resolved. Do not resubmit.</p>
      <p>{status.operationId && <>Transfer ID: {status.operationId}. </>}{status.intentId && <>Operator intent: {status.intentId}. </>}{status.commitmentTxid && <>Bitcoin transaction: {status.commitmentTxid}.</>}</p>
      {!status.commitmentTxid && <p>If status checks cannot verify completion, operator investigation is needed using these IDs. Status checks cannot resume interrupted signing.</p>}
    </div>}
    {pending && <TransferRecoveryDetails status={status} busy={busy} />}
    {status.status==='not-submitted' && <p role="status">Transfer was not submitted. Review again to start a new transfer.</p>}
    {direction==='to-arkade' && balance.status==='ready' && balance.bitcoinSats===0 && <p role="status">No Bitcoin boarding funds. Funds already in Arkade do not need this transfer.</p>}
    {status.status==='succeeded' && <p role="status">Transfer verified. {balance.status==='unavailable'?'Balance refresh failed; use Refresh.':balance.status==='ready'?'Balances are refreshed from the wallet.':'Refreshing balances…'}</p>}
    {error && <p className="bis-warning" role="alert">{error}</p>}
    {busy && <p role="status">{submitting?'Submitting the reviewed transfer. Keep this tab open while the operator completes its session…':'Checking transfer…'}</p>}
    <div className="bis-actions">
      {review ? <button className="bis-button bis-primary" disabled={!boardingSubmissionEnabled||!quote||expired||busy||blocked} onClick={()=>void confirm()}>Confirm Transfer</button>
        : <button className="bis-button bis-primary" disabled={!valid||busy||blocked||balance.status!=='ready'} onClick={()=>void loadQuote()}>Review Transfer</button>}
      {(pending||error) && <button className="bis-button" disabled={busy} onClick={()=>void check()}>Check Status</button>}
      <button className="bis-button" onClick={() => review ? (setReview(false),setQuote(undefined)) : onBack()}>Back</button>
    </div>
  </>;
}
