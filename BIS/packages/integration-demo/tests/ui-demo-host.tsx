import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { createContext, type BisContext } from '../../integration/src/core/context';
import type { AccountSecret } from '../../integration/src/arkade/account';
import '../src/style.css';
const account={phrase:Array.from({length:12},(_,i)=>`placeholder-${i}`).join(' '),profileId:'ui-demo-fixture'};
let stored:AccountSecret|null=null, context:BisContext;
const assets=[{assetId:'a'.repeat(68),quantity:'9007199254740993',name:'Fixture asset',ticker:'FIX',decimals:0}];
let assetRows=assets;
let transactionRows=[{id:'fixture-tx',amountSats:42,direction:'Incoming',status:'Confirmed',identifier:'fixture-tx'}];
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{},readText:async()=>account.phrase}});
const root=createRoot(document.getElementById('root')!);
function factory() {
 context=createContext({load:async()=>({account:stored,generation:0}),save:async value=>{stored=value;},reset:async()=>{throw Error('Unexpected reset');},subscribe:()=>()=>{}},async()=>account,async()=>account.profileId,undefined,
 async()=>({availableSats:100,totalSats:150,bitcoinSats:50,arkadeSats:100}),undefined,async()=>({bitcoinAddress:'tb1fixture',arkadeAddress:'tark1fixture'}),
 async(_account,signal,publish)=>{publish(transactionRows);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));},undefined,
 {list:async()=>assetRows,mint:async()=>{throw Error('Unexpected mint');}});
 context.checkAccountSend=async()=>({status:'idle'});context.getSendSpendable=async()=>100;
 context.quoteAccountSend=async(recipient,amount=100)=>({id:'fixture',profileId:account.profileId,recipient,amountSats:amount,feeSats:0,totalSats:amount,maxSats:100,expiresAt:Date.now()+60000,fingerprint:'fixture'});
 context.checkAccountTransfer=async()=>({status:'idle'});
 context.quoteAccountTransfer=async(amount=50,direction='to-arkade')=>({profileId:account.profileId,direction,amountSats:amount,feeSats:0,netSats:amount,maxSats:50,bitcoinAfterSats:0,arkadeAfterSats:150,totalAfterSats:150,expiresAt:Date.now()+60000,fingerprint:'fixture'});
 context.confirmAccountSend=async()=>{throw Error('Unexpected send');};context.confirmAccountTransfer=async()=>{throw Error('Unexpected transfer');};
 return context;
}
root.render(<App contextFactory={factory}/>);
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
const wait=async(test:()=>boolean)=>{for(let i=0;i<150;i++){if(test())return;await tick();}throw Error('Demo UI timeout');};
const click=async(label:string)=>{const button=[...host().querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent?.replace('⚡','').trim())===label)!;button.click();await tick();};
const host=()=>document.querySelector<HTMLElement>('.runtime-container')!;
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
function geometry() {
 const card=host().querySelector<HTMLElement>('.bis-card')!;
 check(card.scrollWidth<=card.clientWidth,'No horizontal overflow');
 const title=host().querySelector('h2')!;
 check(card.getAttribute('aria-labelledby')===title.id,'Dialog title association');
}
function recoveryGeometry(title:string) {
 check(host().querySelector('h2')?.textContent===title,'Recovery title');geometry();
 const heading=host().querySelector('.bis-recovery-heading h3')!.getBoundingClientRect();
 for(const button of host().querySelectorAll('.bis-recovery-heading button')) {
  const rect=button.getBoundingClientRect();check(Math.abs(rect.top+rect.height/2-heading.top-heading.height/2)<2,'Seed controls aligned at demo scale');
 }
 check(host().querySelector('.bis-visibility-toggle')?.getAttribute('aria-pressed')==='false','New recovery session masked');
}
document.getElementById('run')!.onclick=async()=>{
 const result=document.getElementById('result')!;result.textContent='Running';
 try{
  await wait(()=>!!context);await context.ready();
  for(const scale of ['1','0.5','0.25']) {
   const previous=context;stored=null;root.render(<App key={scale} contextFactory={factory}/>);await wait(()=>context!==previous);await context.ready();
   const select=document.querySelector<HTMLSelectElement>('.preview-scale')!;select.value=scale;select.dispatchEvent(new Event('change',{bubbles:true}));await tick();
   context.openAccountDialog();context.openRestoreAccount();await tick();recoveryGeometry('Restore Account');check(host().querySelectorAll('.bis-word-input input').length===12,'Restore input grid');context.closeAccount();await tick();
   if(!stored){context.openAccountDialog();await context.createAccount();await tick();recoveryGeometry('Set Recovery Phrase');await context.continueAccount();await tick();}
   await click('Accounts Details');
   check(host().querySelector('h2')?.textContent==='Accounts Details','Account Details title');
   check(host().querySelectorAll('input').length===4,'Account ID and three balance fields share Account Details');
   check([...host().querySelectorAll('.bis-actions button')].map(b=>b.textContent).join('|')==='Assets|Contracts|Transactions|Get Recovery Phrase|Back','Details actions include collections, recovery and Back');
   for(const destination of ['Assets','Contracts','Transactions']) {
    await click(destination);await wait(()=>!host().querySelector('.bis-pending-dialog'));await tick();geometry();
    check(host().querySelector('h2')?.textContent===destination,'Detail destination');
    await click('Back');check(host().querySelector('h2')?.textContent==='Accounts Details','Detail Back returns to submenu');
   }
   await click('Back');check(host().querySelector('h2')?.textContent==='Account'&&!!host().querySelector('.bis-transfer-actions'),'Submenu Back returns to main account');
   context.openAccountDetails();await wait(()=>context.getState().balance.status==='ready');context.openAccountRecovery();await wait(()=>context.getState().recoveryStatus==='ready');await tick();recoveryGeometry('Get Recovery Phrase');
   host().querySelector<HTMLButtonElement>('.bis-visibility-toggle')!.click();await tick();context.closeAccount();await tick();context.closeAccount();await tick();
   context.openAccountReceive();await wait(()=>context.getState().addresses.status==='ready');await tick();geometry();context.closeAccount();await tick();
   context.openAccountSend();await wait(()=>!host().querySelector('.bis-pending-dialog'));await tick();geometry();
   const recipient=host().querySelector<HTMLInputElement>('[aria-label="Recipient address"]')!;
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(recipient,'tark1fixture');recipient.dispatchEvent(new Event('input',{bubbles:true}));await tick();
   await click('Max');await click('Review Send');geometry();check(host().querySelectorAll('.bis-review-details dt').length===6,'Send review rows');context.closeAccount();await tick();
   context.openAccountTransfer();await wait(()=>!host().querySelector('.bis-pending-dialog'));await tick();geometry();await click('Max');await click('Review Transfer');geometry();check(host().querySelectorAll('.bis-review-details dt').length===6,'Transfer review rows');context.closeAccount();await tick();context.closeAccount();await tick();
   context.openAccountAssets();await wait(()=>context.getState().assets.status==='ready');await tick();geometry();
   check(host().querySelector('.bis-asset-list-heading h3')?.textContent==='Assets','Assets copy heading');
   host().querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();geometry();
   check(host().querySelector('h2')?.textContent==='Asset Detail','Asset detail title');
   [...host().querySelectorAll('button')].find(b=>b.textContent==='Back')!.click();await tick();
   assetRows=[];await context.refreshAssets();await tick();const emptyAssets=host().querySelector<HTMLElement>('.bis-asset-list')!;
   check(emptyAssets.clientHeight>0&&getComputedStyle(emptyAssets).overflowY==='scroll'&&!host().textContent?.includes('No assets found.'),'Empty asset list retains scrollbar');context.closeAccount();await tick();assetRows=assets;
   transactionRows=[];context.openAccountActivity();await wait(()=>context.getState().activity.status==='ready');await tick();geometry();
   const emptyTransactions=host().querySelector<HTMLElement>('.bis-transaction-list')!;
   check(emptyTransactions.clientHeight>0&&getComputedStyle(emptyTransactions).overflowY==='scroll'&&!host().textContent?.includes('No transactions found.'),'Empty transaction list retains scrollbar');context.closeAccount();await tick();

  }
  context.openAccountDetails();await wait(()=>context.getState().balance.status==='ready');context.openAccountRecovery();await wait(()=>context.getState().recoveryStatus==='ready');await tick();
  result.textContent='PASS: demo scales, recovery alignment/masking, titles, Restore, Receive, Send/Transfer reviews, asset list/detail and empty list scrollbars; isolated storage only.';
 }catch(e){result.textContent=`FAIL: ${e instanceof Error?e.message:'demo checks'}`;}
};
document.getElementById('restore')!.onclick=async()=>{const previous=context;stored=null;root.render(<App key="restore" contextFactory={factory}/>);await wait(()=>context!==previous);await context.ready();context.openAccountDialog();context.openRestoreAccount();};
