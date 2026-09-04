import {createRoot} from 'react-dom/client';
import {AccountActivity} from '../../integration/src/ui/AccountActivity';
import {AccountTransfer} from '../../integration/src/ui/AccountTransfer';
import {withTransferActivity} from '../../integration/src/core/activity';
import type {BoardingRecord} from '../../integration/src/core/boarding-record';
import type {BisContext,BisTransferStatus} from '../../integration/src/core/context';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!,root=createRoot(host);
const tick=()=>new Promise(r=>setTimeout(r,40));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
const record={id:'11111111-1111-4111-8111-111111111111',profileId:'fixture',status:'pending',phase:'registered',intentId:'22222222-2222-4222-8222-222222222222',quote:{amountSats:1000,direction:'to-bitcoin'}} as BoardingRecord;
document.getElementById('run')!.onclick=async()=>{
 result.textContent='Running';let checks=0,mutations=0,copied='',fail=false,copyFail=false;
 let next:BisTransferStatus={status:'pending',operationId:record.id,intentId:record.intentId,phase:'registered',amountSats:1000,direction:'to-bitcoin',verification:'unavailable'};
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 const journal=localStorage.getItem('bis-signet-boarding-operation-v1');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if(copyFail)throw Error('denied');copied=text;}}});
 const context={checkAccountTransfer:async()=>{checks++;if(fail)throw Error('PRIVATE_SENTINEL');return next;},refreshBalance:async()=>{},confirmAccountTransfer:async()=>{mutations++;},quoteAccountTransfer:async()=>{mutations++;}} as unknown as BisContext;
 const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===name)!;
 try {
  root.render(<AccountTransfer context={context} balance={{status:'unavailable'}} onBack={()=>{}}/>);await tick();
  check(host.textContent?.includes('A pending transfer is blocking new transfers. Open Account Activity to review it.'),'Transfer has one-line pending notice');
  check(!host.querySelector('details')&&!host.textContent?.includes('Operator intent:')&&!button('Check Status'),'No transfer-page recovery details or actions');
  const initialChecks=checks;
  const rows=withTransferActivity([{id:'ordinary',amountSats:100,direction:'Incoming',status:'Confirmed',identifier:'other'}],record,'fixture');
  root.render(<div className="bis-card"><AccountActivity activity={{status:'unavailable',transactions:rows}} context={context} onDetailChange={()=>{}}/></div>);await tick();
  check(host.querySelectorAll('.bis-transaction-row').length===2,'One pending row alongside history');
  (host.querySelector('.bis-transaction-row') as HTMLButtonElement).click();await tick();
  check(host.querySelector('textarea')?.value.includes(record.id),'One click opens transfer details');
  check(button('Open On Explorer')?.disabled,'Pending operation keeps explorer button visible but disabled');
  check(host.textContent?.includes('Explorer unavailable: no transaction ID has been reported yet.'),'Missing transaction ID is explained');
  check(!button('Check Status')&&!host.querySelector('details'),'No inline recovery actions or report');
  check(!host.textContent?.includes('Completion has not been verified.')&&!host.textContent?.includes('Cancel and undo'),'Removed inline guidance');
  check(!!button('View Recovery Info'),'Pending transfer offers recovery window');
  const originalOpen=window.open;
  let popupDocument:Document|undefined;
  try {
   window.open=()=>null;
   button('View Recovery Info').click();await tick();
   check(host.textContent?.includes('Allow pop-up windows'),'Blocked popup feedback');
   popupDocument=document.implementation.createHTMLDocument();
   const fakePopup={document:popupDocument,opener:window,navigator:{clipboard:{writeText:async(text:string)=>{copied=text;}}}};
   window.open=((url:string,target:string,features:string)=>{check(url==='about:blank'&&target==='_blank'&&features.includes('popup'),'Separate window requested');return fakePopup;}) as typeof window.open;
   button('View Recovery Info').click();await tick();
   check(fakePopup.opener===null,'Popup opener detached');
   check(popupDocument.title==='Recovery Info'&&popupDocument.querySelector('textarea')?.value.includes(record.id),'Selected recovery info in new window');
   popupDocument.querySelector('button')!.click();await tick();
   check(copied.includes(record.id),'Copy recovery info');
  } finally {window.open=originalOpen;}
  button('Back').click();await tick();(host.querySelectorAll('.bis-transaction-row')[1] as HTMLButtonElement).click();await tick();
  check(!button('View Recovery Info'),'Ordinary row has no recovery button');
  check(checks===initialChecks,'Viewing recovery does not check or submit operations');
  check(mutations===0&&localStorage.getItem('bis-signet-boarding-operation-v1')===journal,'No mutation or journal change');
  result.textContent='PASS: pending recovery button, separate window, report copy, blocked popup feedback, no inline recovery text, ordinary rows excluded, no mutation.';
 }catch(e){result.textContent=`FAIL: ${e instanceof Error?e.message:'checks'}`;}
 finally{if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
