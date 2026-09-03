import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import { formatTransactions, type BisTransaction } from '../../integration/src/core/activity';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!;
const tick=()=>new Promise(r=>setTimeout(r,0));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
const wait=async(test:()=>boolean)=>{const end=Date.now()+2500;while(!test()){if(Date.now()>end)throw Error('UI update timed out');await tick();}};
let cleanup=()=>{};
document.getElementById('run')!.onclick=async()=>{
  cleanup();result.textContent='Running';
  let copied='',copyFail=false,rejectRead:(error:Error)=>void=()=>{};
  const rows: readonly BisTransaction[]=Array.from({length:24},(_,i)=>({id:String(i),amountSats:100+i,direction:i%2?'Outgoing':'Incoming',status:i===0?'Pending':'Confirmed',identifier:'a'.repeat(64)+':'+i,createdAt:24-i}));
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if(copyFail)throw Error('denied');copied=text;}}});
  let data=rows;
  const account={phrase:'isolated-placeholder',profileId:'1234567890abcdef'};
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('unexpected write');},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,async(_,signal,publish)=>{
    await tick();if(signal.aborted)return;publish(data);await new Promise<void>((resolve,reject)=>{rejectRead=reject;signal.addEventListener('abort',()=>resolve(),{once:true});});
  });
  const ui=createBisUi(c);ui.mount(host);
  cleanup=()=>{ui.unmount();c.dispose();if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');};
  try{
    await c.ready();c.openAccountDialog();await tick();
    const buttons=[...host.querySelectorAll('button')];const details=buttons.findIndex(b=>b.textContent?.includes('Account Details'));
    check(buttons[details+1]?.textContent?.includes('Account Activity'),'menu order');buttons[details+1].click();
    await wait(()=>host.querySelector('textarea')?.value===formatTransactions(rows));
    check(host.querySelectorAll('textarea').length===1,'one text area');check(host.querySelector('h2')?.textContent==='Account Activity','exact title');
    check(host.textContent?.includes('Account ID:'),'account identifier');
    const copy=host.querySelector<HTMLButtonElement>('[aria-label="Copy Transactions"]')!;
    copy.click();await wait(()=>host.textContent?.includes('Transactions copied.')===true);check(copied===formatTransactions(rows),'copy all exact');
    copyFail=true;copy.click();await wait(()=>host.textContent?.includes('Could not copy.')===true);
    const card=host.querySelector('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'no horizontal card overflow');
    rejectRead(Error('private failure'));await wait(()=>c.getState().activity.status==='unavailable');await tick();
    check(host.querySelector('textarea')?.value==='' && copy.disabled,'clear stale text');
    data=[];void c.refreshActivity();await wait(()=>host.textContent?.includes('No transactions found.')===true);check(copy.disabled,'empty copy disabled');
    c.closeAccount();await tick();check(!host.querySelector('textarea'),'Back to menu');
    data=rows;c.openAccountActivity();await wait(()=>host.querySelector('textarea')?.value===formatTransactions(rows));
    result.textContent='PASS: exact menu/title, single text area, all lines, Copy-all, clipboard failure, empty/unavailable/retry, Back, reopen, 360px layout. Fixtures only.';
  }catch(error){result.textContent='FAIL: '+(error instanceof Error?error.message:'checks');}
};
window.addEventListener('pagehide',()=>cleanup());
