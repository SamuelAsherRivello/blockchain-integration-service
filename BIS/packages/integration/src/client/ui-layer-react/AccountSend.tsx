import { ReviewDetails, formatSats as sats } from './ReviewDetails';
import { useQuoteExpiry } from './useQuoteExpiry';
import { FieldHeading } from './FieldHeading';
import { PasteButton } from './IconButton';
import { readWithRetry } from '../state-layer-core/pending-read';
import { usePendingNotice } from './PendingOperationDialog';
import {useEffect,useId,useRef,useState} from 'react';
import type {BisContext} from '../state-layer-core/context';
import type {BisSendQuote} from '../state-layer-core/sending';
import {SendError} from '../state-layer-core/sending';
import {BoardingBlockedError} from '../state-layer-core/boarding-record';
import { networkLabel } from '../state-layer-core/test-network';

import {AmountChooserRow} from './AmountChooserRow';
import {CopyableValueField} from './CopyableValueField';
import {BalanceTooltip, formatBalanceSats} from './BalanceTooltip';

export function AccountSend({context}:{context:BisContext}) {
 const [recipient,setRecipient]=useState(''),[amount,setAmount]=useState(''),[funds,setFunds]=useState<number>();
 const [quote,setQuote]=useState<BisSendQuote>(),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [clipboardError,setClipboardError]=useState('');
 const [operationLabel,setOperationLabel]=useState('Loading ...');
 const [sendPageReady,setSendPageReady]=useState(false);
 const readController=useRef(new AbortController());
 const alive=useRef(true),revision=useRef(0),working=useRef(false),initialLoad=useRef(true),heading=useRef<HTMLHeadingElement>(null),recipientInput=useRef<HTMLInputElement>(null);
 const recipientId=useId();
 const expired = useQuoteExpiry(quote?.expiresAt);
 const fail=(e:unknown)=>e instanceof SendError||e instanceof BoardingBlockedError?e.message:'Send information could not be verified. Try again.';
 async function loadFunds(initial=false) {
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setOperationLabel(initial?'Loading ...':'Refreshing ...');setError('');setFunds(undefined);
  try {const n=await readWithRetry(()=>context.getSendSpendable(),readController.current.signal);if(alive.current&&request===revision.current)setFunds(n);}
  catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{if(alive.current&&request===revision.current){if(initial)initialLoad.current=false;working.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  alive.current=true;initialLoad.current=true;setSendPageReady(false);readController.current=new AbortController();void loadFunds(true);
  // The Send page should get one paint before its initial loading surface covers it.
  const timer=window.setTimeout(()=>setSendPageReady(true),100);
  return()=>{alive.current=false;revision.current++;working.current=false;readController.current.abort();window.clearTimeout(timer);};
 },[context]);
 useEffect(()=>{if(quote)heading.current?.focus();},[quote]);
 function edit(value:string,field:'recipient'|'amount'){revision.current++;setQuote(undefined);setError('');if(field==='recipient')setRecipient(value);else setAmount(value);}
 async function paste(){setClipboardError('');const current=revision.current;try {const text=await navigator.clipboard.readText();if(alive.current&&current===revision.current&&!working.current)edit(text.trim(),'recipient');}catch {if(alive.current&&current===revision.current)setClipboardError('Clipboard unavailable. Enter the address manually.');}}
 async function review(max=false){
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setOperationLabel('Preparing...');setError('');setQuote(undefined);
  try {const q=await readWithRetry(()=>context.quoteAccountSend(recipient,max?undefined:Number(amount)),readController.current.signal);if(alive.current&&request===revision.current){setAmount(String(q.amountSats));if(!max)setQuote(q);}}
  catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{if(alive.current&&request===revision.current){working.current=false;setBusy(false);}}
 }
 async function confirm(){
  if(!quote||expired||working.current)return;working.current=true;const request=++revision.current;setBusy(true);setOperationLabel('Sending...');setError('');
  let refresh=false;
  try{const next=await context.confirmAccountSend(quote);if(alive.current&&request===revision.current){setRecipient('');setAmount('');setQuote(undefined);setFunds(undefined);refresh=next.status==='succeeded'||next.status==='pending';}}
  catch(e){if(alive.current&&request===revision.current){setQuote(undefined);setError(fail(e));setFunds(undefined);}}
  finally{if(alive.current&&request===revision.current){working.current=false;setBusy(false);if(refresh)void loadFunds();}}
 }
 const network=networkLabel(context.getState().network);
 const validAddress=recipient.trim().startsWith('tark1'),validAmount=/^\d+$/.test(amount)&&Number.isSafeInteger(Number(amount))&&Number(amount)>0&&funds!==undefined&&Number(amount)<=funds;
 usePendingNotice(busy && (!initialLoad.current || sendPageReady),operationLabel,error||undefined,()=>context.closeAccount());
 return <div className="bis-send">
  {quote?<div className="bis-review">
   <h3 tabIndex={-1} ref={heading} data-bis-autofocus>Review Send</h3>
   <p>You are sending {sats(quote.amountSats)} with a fee of {sats(quote.feeSats)}.</p>
   <ReviewDetails rows={[
    ['Amount', sats(quote.amountSats)], ['From', 'Arkade balance'], ['Payment type', 'Arkade'], ['Network', network], ['Fee', sats(quote.feeSats)], ['Total deducted', sats(quote.totalSats)],
   ]} />
   <p>Send to</p><p className="bis-send-address">{quote.recipient}</p>
   {expired&&<p role="status">Quote expired. Go Back for a fresh review.</p>}
  </div>:<div className="bis-send-form">
   <CopyableValueField label="Arkade balance" value={funds===undefined?'':sats(funds)} disabled={funds===undefined} tooltipName="Arkade balance" tooltip={<BalanceTooltip title="Arkade balance" balance={formatBalanceSats(funds)} available={formatBalanceSats(funds)} />} />
   <FieldHeading htmlFor={recipientId} label="Recipient address"><PasteButton disabled={busy} onClick={() => void paste()} /></FieldHeading>
   <input id={recipientId} ref={recipientInput} aria-label="Recipient address" autoComplete="off" spellCheck={false} disabled={busy} value={recipient} onChange={e=>edit(e.target.value,'recipient')}/>
   <AmountChooserRow value={amount} onChange={value=>edit(value,'amount')} onMax={()=>void review(true)} disabled={busy} maxDisabled={!validAddress||!funds}/>
   {recipient&&!validAddress&&<p role="status">Enter an Arkade test address.</p>}
  </div>}
  {clipboardError&&<p role="status">{clipboardError}</p>}
  <div className="bis-actions">
   {quote?<button className="bis-button bis-primary" disabled={busy||expired} onClick={()=>void confirm()}>⚡ Confirm Send</button>:<button className="bis-button bis-primary" disabled={busy||!validAddress||!validAmount} onClick={()=>void review()}>⚡ Review Send</button>}
   <button className="bis-button bis-back" onClick={()=>{if(quote&&!busy){setQuote(undefined);requestAnimationFrame(()=>recipientInput.current?.focus());}else context.closeAccount();}}>Back</button>
  </div>
 </div>;
}
