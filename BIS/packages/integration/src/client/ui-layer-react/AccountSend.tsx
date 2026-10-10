import { FormValueList, formatSats as sats } from './FormValueList';
import { useQuoteExpiry } from './useQuoteExpiry';
import { FormHeading } from './FormHeading';
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
import {FormValue} from './FormValue';
import {FormTooltip, formatBalanceSats} from './FormTooltip';
import { useEntryLoadingGate, viewLoadingPolicies } from './view-loading';

export function AccountSendView({context}:{context:BisContext}) {
 const [recipient,setRecipient]=useState(''),[amount,setAmount]=useState(''),[funds,setFunds]=useState<number>();
 const [quote,setQuote]=useState<BisSendQuote>(),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [clipboardError,setClipboardError]=useState('');
 const [operationLabel,setOperationLabel]=useState('Loading ...');
 const readController=useRef(new AbortController());
 const alive=useRef(true),revision=useRef(0),working=useRef(false),initialLoad=useRef(true),heading=useRef<HTMLHeadingElement>(null),recipientInput=useRef<HTMLInputElement>(null);
 const recipientId=useId();
 const expired = useQuoteExpiry(quote?.expiresAt);
 const fail=(e:unknown)=>e instanceof SendError||e instanceof BoardingBlockedError?e.message:'Send information could not be verified. Try again.';
 async function readInitialArkBalance(signal:AbortSignal) {
  const cached=context.getCachedArkBalance?.();
  if(cached!==undefined)return cached;
  await context.refreshBalance();
  const immediate=context.getCachedArkBalance?.();
  if(immediate!==undefined)return immediate;
  await new Promise<void>((resolve,reject)=>{
   const unsubscribe=context.subscribe(()=>{
    const value=context.getCachedArkBalance?.();
    if(value!==undefined){unsubscribe();resolve();}
    else if(['unavailable','error'].includes(context.getState().balance.status as string)){unsubscribe();reject(new SendError('Arkade balance could not be verified.'));}
   });
   const onAbort=()=>{unsubscribe();reject(signal.reason??new DOMException('Aborted','AbortError'));};
   signal.addEventListener('abort',onAbort,{once:true});
   if(signal.aborted)onAbort();
  });
  const value=context.getCachedArkBalance?.();
  if(value===undefined)throw new SendError('Arkade balance could not be verified.');
  return value;
 }
 async function loadFunds(initial=false) {
  if(working.current)return;working.current=true;const request=++revision.current;setBusy(true);setOperationLabel(initial?'Loading ...':'Refreshing ...');setError('');setFunds(undefined);
  try {const n=await readWithRetry(()=>initial ? readInitialArkBalance(readController.current.signal) : context.getSendSpendable(),readController.current.signal);if(alive.current&&request===revision.current)setFunds(n);}
  catch(e){if(alive.current&&request===revision.current)setError(fail(e));}
  finally{if(alive.current&&request===revision.current){if(initial)initialLoad.current=false;working.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  alive.current=true;initialLoad.current=true;readController.current=new AbortController();void loadFunds(true);
  return()=>{alive.current=false;revision.current++;working.current=false;readController.current.abort();};
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
 const loadingNotice=useEntryLoadingGate(busy,initialLoad.current,viewLoadingPolicies.send);
 usePendingNotice(loadingNotice,operationLabel,error||undefined,()=>context.closeAccount());
 return <div className="bis-send">
  {quote?<div className="bis-review">
   <h3 tabIndex={-1} ref={heading} data-bis-autofocus>Review Send</h3>
   <p>You are sending {sats(quote.amountSats)} with a fee of {sats(quote.feeSats)}.</p>
   <FormValueList rows={[
    ['Amount', sats(quote.amountSats)], ['From', 'Arkade balance'], ['Payment type', 'Arkade'], ['Network', network], ['Fee', sats(quote.feeSats)], ['Total deducted', sats(quote.totalSats)],
   ]} />
   <p>Send to</p><p className="bis-send-address">{quote.recipient}</p>
   {expired&&<p role="status">Quote expired. Go Back for a fresh review.</p>}
  </div>:<div className="bis-send-form">
   <FormValue label="Arkade balance" value={funds===undefined?'':sats(funds)} copyable disabled={funds===undefined} tooltipName="Arkade balance" tooltip={<FormTooltip title="Arkade balance" balance={formatBalanceSats(funds)} available={formatBalanceSats(funds)} />} />
   <FormHeading htmlFor={recipientId} label="Recipient address"><PasteButton disabled={busy} onClick={() => void paste()} /></FormHeading>
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
