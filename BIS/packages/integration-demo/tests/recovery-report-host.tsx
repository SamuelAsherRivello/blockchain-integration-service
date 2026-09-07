import { createRoot } from 'react-dom/client';
import { TransferRecoveryDetails } from '../../integration/src/ui/TransferRecoveryDetails';
import type { BisTransferStatus } from '../../integration/src/core/context';
import { formatTransferRecoveryReport } from '../../integration/src/core/boarding-status';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!,root=createRoot(host);
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
document.getElementById('run')!.onclick=async()=>{
 result.textContent='Running';let copied='',denied=false,delayed=false,release:(()=>void)|undefined;
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if(delayed)await new Promise<void>(resolve=>release=resolve);if(denied)throw Error('denied');copied=text;}}});
 const status:BisTransferStatus={status:'pending',phase:'registered',direction:'to-bitcoin',amountSats:1000,operationId:'11111111-1111-4111-8111-111111111111',intentId:'22222222-2222-4222-8222-222222222222',verification:'live'};
 const render=async(value=status,busy=false)=>{root.render(<div className="bis-layer"><div className="bis-card"><TransferRecoveryDetails status={value} busy={busy}/></div></div>);await tick();};
 const copy=()=>host.querySelector<HTMLButtonElement>('[aria-label="Copy recovery details"]')!;
 try{
  await render();check(host.querySelector('details')?.open,'Standalone report expanded');check(host.querySelector('textarea')?.readOnly,'Selectable report');
  copy().click();await tick();check(copied===formatTransferRecoveryReport(status)&&host.textContent?.includes('Recovery details copied.'),'Exact report copy');
  denied=true;copy().click();await tick();check(host.textContent?.includes('copy manually'),'Manual fallback');denied=false;
  delayed=true;copy().click();await tick();await render({...status,verification:'unavailable'});await render();release!();await tick();delayed=false;
  check(copy().title==='Copy recovery details'&&!host.textContent?.includes('Recovery details copied.'),'A B A ignores stale success');
  await render(status,true);check(copy().disabled,'Busy disables copy');await render({...status,status:'succeeded'});check(!host.querySelector('details'),'Terminal report absent');
  await render();check(copy().title==='Copy recovery details','Reopen resets copy');
  const card=host.querySelector('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'Narrow layout');
  result.textContent='PASS: standalone public report, exact copy, denial/manual fallback, A B A stale copy, busy, terminal/reopen and layout. No context or wallet operations.';
 }catch(e){result.textContent=`FAIL: ${e instanceof Error?e.message:'report checks'}`;}
 finally{if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
