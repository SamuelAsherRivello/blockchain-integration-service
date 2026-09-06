import { ReviewDetails, formatSats as sats } from './ReviewDetails';
import { useQuoteExpiry } from './useQuoteExpiry';
import { FieldHeading } from './FieldHeading';
import { PasteButton } from './IconButton';
import { readWithRetry } from '../core/pending-read';
import { usePendingNotice } from './PendingOperationDialog';
import {useEffect,useId,useRef,useState} from 'react';
import type {BisContext} from '../core/context';
import type {BisSendQuote,BisSendStatus} from '../core/sending';
import {SendError} from '../core/sending';
import {BoardingBlockedError} from '../core/boarding-record';

import {AmountChooserRow} from './AmountChooserRow';

export function AccountSend({context}:{context:BisContext}) {
 const [recipient,setRecipient]=useState(''),[amount,setAmount]=useState(''),[funds,setFunds]=useState<number>();
 const [quote,setQuote]=useState<BisSendQuote>(),[status,setStatus]=useState<BisSendStatus>({status:'idle'}),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [clipboardError,setClipboardError]=useState('');
 const [operationLabel,setOperationLabel]=useState('Loading...');
 const readController=useRef(new AbortController());
 const alive=useRef(true),revision=useRef(0),working=useRef(false),heading=useRef<HTMLHeadingElement>(null),recipientInput=useRef<HTMLInputElement>(null);
 const recipientId=useId();
 const expired = useQuoteExpiry(quote?.expiresAt);
 const fail=(e:unknown)=>e instanceof SendError||e instanceof BoardingBlockedError?e.message:'Send information could not be verified. Check Status and try again.';
 async function check(fresh=false) {
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setOperationLabel('Checking...');setError('');setFunds(undefined);
  try {
   const next=await readWithRetry(()=>context.checkAccountSend(),readController.current.signal);if(!alive.current||request!==revision.current)return;
   setStatus(fresh&&next.status==='succeeded'?{status:'idle'}:next);
   if(next.status==='pending')setError('Outcome not yet confirmed. The send may still complete. Do not send again.');
   if(next.status!=='pending'){const n=await readWithRetry(()=>context.getSendSpendable(),readController.current.signal);if(alive.current&&request===revision.current)setFunds(n);}
  }catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{if(alive.current&&request===revision.current){working.current=false;setBusy(false);}}
 }
 useEffect(()=>{alive.current=true;readController.current=new AbortController();void check();return()=>{alive.current=false;revision.current++;working.current=false;readController.current.abort();};},[context]);
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
  try{const next=await context.confirmAccountSend(quote);if(alive.current&&request===revision.current){setStatus(next);setQuote(undefined);setFunds(undefined);if(next.status==='pending')setError('Outcome not yet confirmed. The send may still complete. Do not send again.');}}
  catch(e){if(alive.current&&request===revision.current){setQuote(undefined);setError(fail(e));setFunds(undefined);try{const next=await readWithRetry(()=>context.checkAccountSend(),readController.current.signal);if(alive.current&&request===revision.current)setStatus(next);}catch{/* Keep confirmation unavailable until checked. */}}}
  finally{if(alive.current&&request===revision.current){working.current=false;setBusy(false);}}
 }
 const validAddress=recipient.trim().startsWith('tark1'),validAmount=/^\d+$/.test(amount)&&Number.isSafeInteger(Number(amount))&&Number(amount)>0&&funds!==undefined&&Number(amount)<=funds;
 const pending=status.status==='pending',done=status.status==='succeeded';
 usePendingNotice(busy,operationLabel,error||undefined,()=>context.closeAccount());
 return <div className="bis-send">
  {pending||done?<div className="bis-send-status" role="status">
   <h3>{done?'Send':'Recorded send'}</h3>
   {status.amountSats!==undefined&&<p>{sats(status.amountSats)}</p>}
   {status.recipient&&<p className="bis-send-address">To: {status.recipient}</p>}
   <p className="bis-send-address">Transaction: {status.transactionId}</p>
   {pending&&<p>Do not send again. Check Status verifies this transaction. Spending, Log Out and Reset stay blocked while the outcome is unknown.</p>}
   {status.verification==='unavailable'&&<p>Verification is unavailable; the recorded transaction is preserved.</p>}
  </div>:quote?<div className="bis-review">
   <h3 tabIndex={-1} ref={heading} data-bis-autofocus>Review Send</h3>
   <p>You are sending {sats(quote.amountSats)} with a fee of {sats(quote.feeSats)}.</p>
   <ReviewDetails rows={[
    ['Amount', sats(quote.amountSats)], ['From', 'Arkade balance'], ['Payment type', 'Arkade'], ['Network', 'Signet'], ['Fee', sats(quote.feeSats)], ['Total deducted', sats(quote.totalSats)],
   ]} />
   <p>Send to</p><p className="bis-send-address">{quote.recipient}</p>
   {expired&&<p role="status">Quote expired. Go Back for a fresh review.</p>}
  </div>:<div className="bis-send-form">
   <p>From: Arkade balance · Spendable: {funds===undefined?'Unavailable':sats(funds)}</p>
   <FieldHeading htmlFor={recipientId} label="Recipient address"><PasteButton disabled={busy} onClick={() => void paste()} /></FieldHeading>
   <input id={recipientId} ref={recipientInput} aria-label="Recipient address" autoComplete="off" spellCheck={false} disabled={busy} value={recipient} onChange={e=>edit(e.target.value,'recipient')}/>
   <AmountChooserRow value={amount} onChange={value=>edit(value,'amount')} onMax={()=>void review(true)} disabled={busy} maxDisabled={!validAddress||!funds}/>
   {recipient&&!validAddress&&<p role="status">Enter an Arkade test address.</p>}
  </div>}
  {clipboardError&&<p role="status">{clipboardError}</p>}
  <div className="bis-actions">
   {!pending&&!done&&(quote?<button className="bis-button bis-primary" disabled={busy||expired} onClick={()=>void confirm()}>⚡ Confirm Send</button>:<button className="bis-button bis-primary" disabled={busy||!validAddress||!validAmount} onClick={()=>void review()}>⚡ Review Send</button>)}
   {done&&<button className="bis-button bis-primary" disabled={busy} onClick={()=>{setRecipient('');setAmount('');setQuote(undefined);void check(true);}}>New Send</button>}
   {(pending||error)&&<button className="bis-button" disabled={busy} onClick={()=>void check()}>Check Status</button>}
   <button className="bis-button" onClick={()=>{if(quote&&!busy){setQuote(undefined);requestAnimationFrame(()=>recipientInput.current?.focus());}else context.closeAccount();}}>Back</button>
  </div>
 </div>;
}
