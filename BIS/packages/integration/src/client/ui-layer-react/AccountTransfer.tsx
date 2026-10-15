import { FormValueList, formatSats as sats } from './FormValueList';
import { useQuoteExpiry } from './useQuoteExpiry';
import { readWithRetry } from '../state-layer-core/pending-read';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useRef, useState } from 'react';
import type { BisBalance, BisContext, BisTransferStatus } from '../state-layer-core/context';
import type { WalletOperationAvailability } from '../state-layer-core/wallet-network-policy';
import { boardingSubmissionEnabled, type BoardingQuote } from '../state-layer-core/boarding-quote';
import { AccountBalancesFormValue } from './AccountBalances';
import { AmountChooserRow } from './AmountChooserRow';
import { PendingTransferConfirmationError } from '../state-layer-core/boarding-record';
import { useEntryLoadingGate, viewLoadingPolicies } from './view-loading';

export function AccountTransferView({ context, balance, onBack }: { context: BisContext; balance: BisBalance; onBack(): void }) {
  const cachedAvailability = context.peekAccountTransferAvailability?.('to-arkade');
  const [direction, setDirection] = useState<'to-arkade' | 'to-bitcoin'>('to-arkade');
  const [amount, setAmount] = useState('0');
  const [review, setReview] = useState(false);
  const [quote, setQuote] = useState<BoardingQuote>();
  const [working, setBusy] = useState(!cachedAvailability);
  const [checking, setChecking] = useState(false);
  const busy = working || checking;
  const [foreground, setForeground] = useState(!cachedAvailability);
  const [operationLabel,setOperationLabel] = useState('Loading ...');
  const readController=useRef(new AbortController());
  const [statusChecked, setStatusChecked] = useState(!!cachedAvailability);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BisTransferStatus>({status:'idle'});
  const [availability,setAvailability]=useState<WalletOperationAvailability | undefined>(cachedAvailability);
  const [error, setError] = useState('');
  const [submitted,setSubmitted]=useState(false);
  const [warning,setWarning]=useState<readonly BisTransferStatus[]>();
  const acknowledged=useRef<readonly string[]>([]);
  const expired = useQuoteExpiry(quote?.expiresAt);
  const alive = useRef(true);
  const request = useRef(0);
  const checkRequest = useRef(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);
  const initialLoading = useRef(!cachedAvailability);
  const numeric = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(numeric) && numeric > 0;
  const label = direction === 'to-arkade' ? 'Bitcoin → Arkade' : 'Arkade → Bitcoin';
  const pending = status.status === 'pending';
  const sourceAvailable = balance.status === 'ready'
    ? direction === 'to-arkade' ? balance.availableBitcoinSats : balance.availableArkadeSats
    : undefined;
  const amountExceedsAvailable = sourceAvailable !== undefined && valid && numeric > sourceAvailable;
  const blocked = !statusChecked || availability === undefined || !availability.available || amountExceedsAvailable;
  const fieldStatus = !boardingSubmissionEnabled ? 'Quotes are available. Confirmation is disabled while interrupted-transfer recovery is being verified.'
      : availability && !availability.available ? availability.message ?? 'Transfer unavailable.'
        : amountExceedsAvailable ? `Amount exceeds the currently available ${direction === 'to-arkade' ? 'Bitcoin' : 'Arkade'} balance.`
          : amount !== '0' && !valid ? 'Enter a positive whole number of sats.'
            : direction === 'to-bitcoin' ? 'Bitcoin returns to this account\'s boarding address. It stays Bitcoin until you choose to transfer it back to Arkade.'
              : balance.status==='ready' && (sourceAvailable ?? 0) > 0 && amount==='0' ? 'Set amount above.' : '';
  function failure(cause: unknown) {
    const message = cause instanceof Error ? cause.message : '';
    return /^(Choose an eligible|Leave at least|The operator fee schedule changed|The operator settlement schedule|Transfer details changed|Transfer status could not be verified|Review a fresh|A transfer is unresolved|Another wallet operation|No confirmed eligible|No spendable|No eligible)/.test(message) ? message : 'Transfer information could not be verified. Choose Check Status before reviewing again.';
  }
  async function check(clearError=true, background=false, initial=false) {
    // Amount edits invalidate quotes, not the selected direction's independent
    // availability read. Separate generations also prevent an older check from
    // clearing the foreground state of a newer quote/submission.
    const current=++checkRequest.current;
    if(!background){setChecking(true);setStatusChecked(false);setAvailability(undefined);}
    if(!background){setForeground(true);setOperationLabel('Loading ...');if(clearError)setError('');}
    try {
      const [next,policy]=await Promise.all([
        readWithRetry(()=>context.checkAccountTransfer(),readController.current.signal),
        readWithRetry(()=>context.getAccountTransferAvailability(direction),readController.current.signal),
      ]);
      if(!alive.current||current!==checkRequest.current)return;
      setStatus(next);setAvailability(policy);setStatusChecked(true);
      if(next.status==='succeeded'&&!background)await context.refreshBalance();
    } catch(cause) {
      if(alive.current&&current===checkRequest.current){setStatusChecked(false);setStatus(previous=>previous.status==='pending'?{...previous,verification:'unavailable'}:previous);if(!background)setError(failure(cause));}
    } finally {if(alive.current&&current===checkRequest.current){if(initial)initialLoading.current=false;setChecking(false);if(!background)setForeground(false);}}
  }
  useEffect(()=>{
    alive.current=true;readController.current=new AbortController();
    try {
      const records=context.getPendingAccountTransfers();
      if(records.length){initialLoading.current=false;setStatus(records[records.length-1]);setStatusChecked(true);setBusy(false);setForeground(false);}
      else {
        // Balance values are presentation data; transfer availability is loaded
        // by the direction effect below before Review Transfer can be enabled.
        initialLoading.current=false;
        setStatus({status:'idle'});
        setStatusChecked(true);
        setBusy(false);
        setForeground(false);
      }
    }catch(cause){initialLoading.current=false;setError(failure(cause));setBusy(false);setForeground(false);}
    return()=>{alive.current=false;request.current++;checkRequest.current++;readController.current.abort();};
  },[context]);
  useEffect(()=>{
    if(!alive.current)return;
    const cached=context.peekAccountTransferAvailability?.(direction);
    if(cached){
      setAvailability(cached);
      setStatusChecked(true);
      setChecking(false);
      setForeground(false);
      return;
    }
    void check(false,false,false);
  },[direction]);
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
    const current=++request.current;setBusy(true);setForeground(true);setOperationLabel('Preparing ...');setError('');setQuote(undefined);
    try {
      const next=await readWithRetry(()=>context.quoteAccountTransfer(max?undefined:numeric,direction),readController.current.signal);
      if(!alive.current||current!==request.current)return;
      setQuote(next);setAmount(String(next.amountSats));setReview(!max);setStatus({status:'idle'});
    }catch(cause){if(alive.current&&current===request.current)setError(failure(cause));}
    finally{if(alive.current&&current===request.current){setBusy(false);setForeground(false);}}
  }
  async function confirm() {
    if(!boardingSubmissionEnabled||!quote||busy||blocked||expired)return;
    const current=++request.current;setBusy(true);setForeground(true);setOperationLabel('Transferring ...');setSubmitting(true);setStatusChecked(false);setError('');
    try {
      const next=await context.confirmAccountTransfer(quote,acknowledged.current);
      if(!alive.current||current!==request.current)return;
      setStatus(next);setQuote(undefined);setStatusChecked(true);
      if(next.status==='succeeded'){context.closeAccount();return;}
      if(next.status==='pending'){setSubmitted(true);return;}
      setError('Transfer was not submitted. Review a fresh transfer.');
    }catch(cause){if(alive.current&&current===request.current){
      if(cause instanceof PendingTransferConfirmationError){setStatusChecked(true);setWarning(context.getPendingAccountTransfers());}
      else setError(failure(cause));
      setQuote(undefined);
    }}
    finally{if(alive.current&&current===request.current){setSubmitting(false);setBusy(false);setForeground(false);setReview(false);}}
  }
  const loadingNotice=useEntryLoadingGate(foreground,initialLoading.current,viewLoadingPolicies.transfer);
  usePendingNotice(loadingNotice,operationLabel,error||undefined,warning?()=>setWarning(undefined):onBack,
    warning?{title:'Pending transfer',message:`You already have a transfer of ${sats(warning.reduce((total,r)=>total+(r.amountSats??0),0))} pending. Are you sure you want to send another?`,confirm:acceptWarning}
    :submitted?{title:'Transfer pending.',message:'See Transactions for any pending transfers.'}:undefined);
  return <>
    <div className="bis-transfer-balances"><AccountBalancesFormValue balance={balance} directionControl={
      <button type="button" className="bis-button bis-balance-direction" disabled={busy||review}
        aria-label={`${label}. Toggle transfer direction`} title={`${label}. Toggle transfer direction`}
        onClick={() => {
          edit(amount);
          setAvailability(context.peekAccountTransferAvailability?.(direction === 'to-arkade' ? 'to-bitcoin' : 'to-arkade'));
          setStatusChecked(!!context.peekAccountTransferAvailability?.(direction === 'to-arkade' ? 'to-bitcoin' : 'to-arkade'));
          setDirection(current => current === 'to-arkade' ? 'to-bitcoin' : 'to-arkade');
        }}>
        {direction === 'to-arkade' ? '→' : '←'}
      </button>
    } /></div>
    {review ? <div className="bis-review" data-bis-quote-fingerprint={quote?.fingerprint} data-bis-quote-expires-at={quote?.expiresAt}>
      <h3 ref={reviewHeading} tabIndex={-1} data-bis-autofocus>Review: {label}</h3>
      <FormValueList rows={[
        ['Amount', sats(numeric)], ['Fee', quote ? sats(quote.feeSats) : 'Unavailable'],
        [`Added to ${direction === 'to-arkade' ? 'Arkade' : 'Bitcoin'}`, quote ? sats(quote.netSats) : 'Unavailable'],
      ]} />
      {quote && <><h3>After transfer (estimate)</h3><FormValueList rows={[
        ['Total balance', sats(quote.totalAfterSats)], ['Bitcoin balance', sats(quote.bitcoinAfterSats)], ['Arkade balance', sats(quote.arkadeAfterSats)],
      ]} /></>}
      {expired && <p role="status">Quote expired. Go Back for a fresh review.</p>}
    </div> : <div className="bis-transfer-form">
      <AmountChooserRow value={amount} onChange={edit} onMax={()=>void loadQuote(true)} disabled={busy} maxDisabled={balance.status!=='ready'} inputRef={amountInput} step={100} />
      {fieldStatus&&<p className="bis-field-status-line" role="status">{fieldStatus}</p>}
    </div>}
    <div className="bis-actions">
      {review ? <button className="bis-button bis-primary" disabled={!boardingSubmissionEnabled||!quote||expired||busy||blocked} onClick={()=>void confirm()}>Confirm Transfer</button>
        : <button className="bis-button bis-primary" disabled={!valid||busy||blocked||balance.status!=='ready'} onClick={reviewTransfer}>Review Transfer</button>}
      {error && !pending && <button className="bis-button" disabled={busy} onClick={()=>void check()}>Check Status</button>}
      <button className="bis-button bis-back" onClick={() => review ? (setReview(false),setQuote(undefined)) : onBack()}>Back</button>
    </div>
  </>;
}
