import {useEffect,useId,useRef,useState} from 'react';
import type {BisContext} from '../core/context';
import type {BisSendQuote,BisSendStatus} from '../core/sending';
import {SendError} from '../core/sending';
import {BoardingBlockedError} from '../core/boarding-record';

import {AmountChooserRow} from './AmountChooserRow';

export function AccountSend({context}:{context:BisContext}) {
 const [recipient,setRecipient]=useState(''),[amount,setAmount]=useState(''),[funds,setFunds]=useState<number>();
 const [quote,setQuote]=useState<BisSendQuote>(),[status,setStatus]=useState<BisSendStatus>({status:'idle'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[expired,setExpired]=useState(false);
 const alive=useRef(true),revision=useRef(0),working=useRef(false),heading=useRef<HTMLHeadingElement>(null),recipientInput=useRef<HTMLInputElement>(null);
 const recipientId=useId();
 const sats=(n:number)=>`${n.toLocaleString('en-US')} sats`;
 const fail=(e:unknown)=>e instanceof SendError||e instanceof BoardingBlockedError?e.message:'Send information could not be verified. Check Status and try again.';
 async function check(fresh=false) {
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setError('');setFunds(undefined);
  try {
   const next=await context.checkAccountSend();if(!alive.current||request!==revision.current)return;
   setStatus(fresh&&next.status==='succeeded'?{status:'idle'}:next);
   if(next.status!=='pending'){const n=await context.getSendSpendable();if(alive.current&&request===revision.current)setFunds(n);}
  }catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{working.current=false;if(alive.current&&request===revision.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void check();return()=>{alive.current=false;revision.current++;};},[context]);
 useEffect(()=>{if(quote)heading.current?.focus();},[quote]);
 useEffect(()=>{setExpired(false);if(!quote)return;const timer=setTimeout(()=>setExpired(true),Math.max(0,quote.expiresAt-Date.now()));return()=>clearTimeout(timer);},[quote]);
 function edit(value:string,field:'recipient'|'amount'){revision.current++;setQuote(undefined);setError('');if(field==='recipient')setRecipient(value);else setAmount(value);}
 async function paste(){const current=revision.current;try {const text=await navigator.clipboard.readText();if(alive.current&&current===revision.current&&!working.current)edit(text.trim(),'recipient');}catch {if(alive.current&&current===revision.current)setError('Clipboard unavailable. Enter the address manually.');}}
 async function review(max=false){
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setError('');setQuote(undefined);
  try {const q=await context.quoteAccountSend(recipient,max?undefined:Number(amount));if(alive.current&&request===revision.current){setAmount(String(q.amountSats));if(!max)setQuote(q);}}
  catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{working.current=false;if(alive.current&&request===revision.current)setBusy(false);}
 }
 async function confirm(){
  if(!quote||expired||working.current)return;working.current=true;const request=++revision.current;setBusy(true);setError('');
  try{const next=await context.confirmAccountSend(quote);if(alive.current&&request===revision.current){setStatus(next);setQuote(undefined);setFunds(undefined);}}
  catch(e){if(alive.current&&request===revision.current){setQuote(undefined);setError(fail(e));setFunds(undefined);try{const next=await context.checkAccountSend();if(alive.current&&request===revision.current)setStatus(next);}catch{/* Keep confirmation unavailable until checked. */}}}
  finally{working.current=false;if(alive.current&&request===revision.current)setBusy(false);}
 }
 const validAddress=recipient.trim().startsWith('tark1'),validAmount=/^\d+$/.test(amount)&&Number.isSafeInteger(Number(amount))&&Number(amount)>0&&funds!==undefined&&Number(amount)<=funds;
 const pending=status.status==='pending',done=status.status==='succeeded';
 return <div className="bis-send">
  {pending||done?<div className="bis-send-status" role="status">
   <h3>{done?'Send completed':'Send pending verification'}</h3>
   {status.amountSats!==undefined&&<p>{sats(status.amountSats)}</p>}
   {status.recipient&&<p className="bis-send-address">To: {status.recipient}</p>}
   <p className="bis-send-address">Transaction: {status.transactionId}</p>
   {pending&&<p>Do not send again. Check Status verifies this transaction. Spending, Log Out and Reset stay blocked while the outcome is unknown.</p>}
   {status.verification==='unavailable'&&<p>Verification is unavailable; the recorded transaction is preserved.</p>}
  </div>:quote?<div className="bis-transfer-review">
   <h3 tabIndex={-1} ref={heading}>Review Send</h3>
   <p>You are sending {sats(quote.amountSats)} with a fee of {sats(quote.feeSats)}.</p>
   <dl><div><dt>Amount</dt><dd>{sats(quote.amountSats)}</dd></div><div><dt>From</dt><dd>Arkade balance</dd></div><div><dt>Payment type</dt><dd>Arkade</dd></div><div><dt>Network</dt><dd>Signet</dd></div><div><dt>Fee</dt><dd>{sats(quote.feeSats)}</dd></div><div><dt>Total deducted</dt><dd>{sats(quote.totalSats)}</dd></div></dl>
   <p>Send to</p><p className="bis-send-address">{quote.recipient}</p>
   {expired&&<p role="status">Quote expired. Go Back for a fresh review.</p>}
  </div>:<div className="bis-send-form">
   <p>From: Arkade balance · Spendable: {funds===undefined?'Unavailable':sats(funds)}</p>
   <div className="bis-copy-field-heading"><label htmlFor={recipientId}>Recipient address</label><button type="button" className="bis-copy-icon" aria-label="Paste from Clipboard" title="Paste from Clipboard" disabled={busy} onClick={()=>void paste()}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M12 10v8m-3-3 3 3 3-3"/></svg></button></div>
   <input id={recipientId} ref={recipientInput} aria-label="Recipient address" autoComplete="off" spellCheck={false} disabled={busy} value={recipient} onChange={e=>edit(e.target.value,'recipient')}/>
   <AmountChooserRow value={amount} onChange={value=>edit(value,'amount')} onMax={()=>void review(true)} disabled={busy} maxDisabled={!validAddress||!funds}/>
   {recipient&&!validAddress&&<p role="status">Enter an Arkade test address.</p>}
  </div>}
  {error&&<p className="bis-warning" role="alert">{error}</p>}
  {busy&&<div className="bis-progress" role="status"><span className="bis-lightning" aria-hidden="true">⚡</span><span>Checking send…</span></div>}
  <div className="bis-actions">
   {!pending&&!done&&(quote?<button className="bis-button bis-primary" disabled={busy||expired} onClick={()=>void confirm()}>⚡ Confirm Send</button>:<button className="bis-button bis-primary" disabled={busy||!validAddress||!validAmount} onClick={()=>void review()}>⚡ Review Send</button>)}
   {done&&<button className="bis-button bis-primary" disabled={busy} onClick={()=>{setRecipient('');setAmount('');setQuote(undefined);void check(true);}}>New Send</button>}
   {(pending||error)&&<button className="bis-button" disabled={busy} onClick={()=>void check()}>Check Status</button>}
   <button className="bis-button" onClick={()=>{if(quote&&!busy){setQuote(undefined);requestAnimationFrame(()=>recipientInput.current?.focus());}else context.closeAccount();}}>Back</button>
  </div>
 </div>;
}
