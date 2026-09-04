import { createRoot } from 'react-dom/client';
import { AccountTransfer } from '../../integration/src/ui/AccountTransfer';
import type { BisContext, BisTransferStatus } from '../../integration/src/core/context';
import '@bis/integration/style.css';

const host=document.getElementById('host')!, result=document.getElementById('result')!;
const root=createRoot(host);
const tick=()=>new Promise(resolve=>setTimeout(resolve,40));
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
document.getElementById('run')!.onclick=async()=>{
 result.textContent='Running';
 const initial=localStorage.getItem('bis-signet-boarding-operation-v1');
 const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 let writes=0,mutations=0,failCopy=false,failCheck=false,copied='',releaseCopy:(()=>void)|undefined,delayCopy=false;
 let next:BisTransferStatus={status:'pending',phase:'registered',direction:'to-bitcoin',amountSats:1000,operationId:'11111111-1111-4111-8111-111111111111',intentId:'22222222-2222-4222-8222-222222222222',verification:'live'};
 const context={checkAccountTransfer:async()=>{if(failCheck)throw Error('PRIVATE_SENTINEL');return next;},refreshBalance:async()=>{},confirmAccountTransfer:async()=>{mutations++;throw Error('unexpected mutation');},quoteAccountTransfer:async()=>{mutations++;throw Error('unexpected quote');}} as unknown as BisContext;
 const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===name)!;
 const report=()=>host.querySelector('textarea') as HTMLTextAreaElement;
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{writes++;if(failCopy)throw Error('denied');if(delayCopy)await new Promise<void>(resolve=>releaseCopy=resolve);copied=text;}}});
 try {
  root.render(<div className="bis-card"><AccountTransfer context={context} balance={{status:'ready',totalSats:1500,availableSats:1000,bitcoinSats:500,arkadeSats:1000}} onBack={()=>{}} /></div>);await tick();
  const details=host.querySelector('details');check(details,'Pending transfer offers Recovery details');
  (details!.querySelector('summary') as HTMLElement).click();await tick();
  check(report().readOnly&&report().value.includes(next.intentId!),'Selectable public report');check(writes===0,'No automatic clipboard access');
  button('Copy recovery details').click();await tick();
  check(copied===report().value&&host.textContent?.includes('Recovery details copied.'),'Exact clipboard success');
  failCopy=true;button('Copy recovery details').click();await tick();
  check(host.textContent?.includes('copy manually')&&report().value===copied,'Denied clipboard manual fallback');failCopy=false;
  delayCopy=true;button('Copy recovery details').click();await tick();
  next={...next,verification:'unavailable'};button('Check Status').click();await tick();releaseCopy?.();await tick();delayCopy=false;
  check(report().value.includes('Verification: Unavailable')&&!host.textContent?.includes('Recovery details copied.'),'Late clipboard result cannot report stale success');
  next={...next,verification:'live'};button('Check Status').click();await tick();failCheck=true;button('Check Status').click();await tick();
  check(report().value.includes('Verification: Unavailable')&&!host.textContent?.includes('PRIVATE_SENTINEL'),'Thrown check invalidates previous live status');failCheck=false;
  check(button('Review Transfer').disabled&&host.textContent?.includes('Log Out and Reset are blocked'),'Report leaves guard presentation unchanged');
  const card=host.querySelector('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'No horizontal overflow at 360px');
  next={...next,status:'succeeded',commitmentTxid:'a'.repeat(64)};button('Check Status').click();await tick();check(!host.querySelector('details'),'Resolved report disappears');
  root.render(<div />);await tick();root.render(<div className="bis-card"><AccountTransfer context={context} balance={{status:'unavailable'}} onBack={()=>{}} /></div>);await tick();check(!host.querySelector('details'),'Remount does not retain pending report');
  next={...next,status:'pending',verification:'unavailable'};
  root.render(<div />);await tick();root.render(<div className="bis-card"><AccountTransfer context={context} balance={{status:'unavailable'}} onBack={()=>{}} /></div>);await tick();
  (host.querySelector('summary') as HTMLElement).click();await tick();
  check(mutations===0&&localStorage.getItem('bis-signet-boarding-operation-v1')===initial,'No wallet mutation or journal change');
  result.textContent='PASS: report, exact copy, denied clipboard fallback, stale copy, unavailable check, guards, terminal/remount, 360px layout; no wallet mutation or journal change. Isolated doubles only.';
 }catch(error){result.textContent=`FAIL: ${error instanceof Error?error.message:'recovery checks'}`;}
 finally{if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else Reflect.deleteProperty(navigator,'clipboard');}
};
