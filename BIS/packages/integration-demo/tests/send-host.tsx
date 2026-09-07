import {createContext} from '../../integration/src/core/context';
import {createBisUi} from '@bis/integration';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!;
const tick=()=>new Promise(r=>setTimeout(r,60));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
let cleanup=()=>{};
document.getElementById('run')!.onclick=async()=>{
 cleanup();result.textContent='Running';let submissions=0;
 const account={phrase:'isolated-placeholder',profileId:'test-profile'};
 const c=createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error();},reset:async()=>{throw Error();},subscribe:()=>()=>{}},undefined,async()=>account.profileId);
 c.checkAccountSend=async()=>({status:'idle'});c.getSendSpendable=async()=>1000;
 c.quoteAccountSend=async(recipient,amount=1000)=>({id:'fixture',profileId:account.profileId,recipient,amountSats:amount,feeSats:0,totalSats:amount,maxSats:1000,expiresAt:Date.now()+60000,fingerprint:'a'.repeat(64)});
 c.confirmAccountSend=async(q)=>{submissions++;return {status:'succeeded',transactionId:'b'.repeat(64),amountSats:q.amountSats,recipient:q.recipient};};
 const ui=createBisUi(c);ui.mount(host);cleanup=()=>{ui.unmount();c.dispose();};
 const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.replace('⚡','').trim()===text||b.getAttribute('aria-label')===text)!;
 const input=(label:string)=>host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
 function fill(label:string,value:string){const el=input(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}
 try {
  await c.ready();c.openAccountDialog();c.openAccountSend();await tick();
  check(!host.textContent?.includes('Coming soon'),'Placeholder removed');check(!host.querySelector('select')&&!host.querySelector('input[type="radio"]'),'No unsupported source choices');
  check(button('Review Send').disabled,'Empty review disabled');
  check(!!host.querySelector('.bis-amount-chooser'),'Shared amount chooser');
  button('Increase amount').click();await tick();check(input('Amount (sats)').value==='1','Increase by one');
  button('Decrease amount').click();await tick();check(input('Amount (sats)').value==='0'&&button('Decrease amount').disabled,'Decrease stops at zero');
  check(!!button('Paste from Clipboard').querySelector('svg'),'Clipboard icon');
  let pasted:(s:string)=>void=()=>{};const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:()=>new Promise<string>(r=>{pasted=r;})}});
  button('Paste from Clipboard').click();fill('Recipient address','tark1newer');await tick();pasted('tark1older');await tick();check(input('Recipient address').value==='tark1newer','Late clipboard preserves edits');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>{throw Error('denied');}}});button('Paste from Clipboard').click();await tick();check(host.textContent?.includes('Clipboard unavailable'),'Clipboard denial has manual fallback');
  if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else Reflect.deleteProperty(navigator,'clipboard');
  fill('Recipient address','tark1'+'q'.repeat(120));fill('Amount (sats)','500');await tick();button('Review Send').click();await tick();
  check(host.textContent?.includes('Review Send')&&host.textContent?.includes('500 sats'),'Review exact terms');check(document.activeElement?.textContent==='Review Send','Review focus');
  button('Back').click();await tick();check(input('Amount (sats)').value==='500','Back preserves draft');
  button('Max').click();await tick();check(input('Amount (sats)').value==='1000','Max amount');
  button('Review Send').click();await tick();button('Confirm Send').click();button('Confirm Send')?.click();await tick();
  check(submissions===1,'No duplicate click submission');check(!!host.querySelector('.bis-send-status')&&!host.textContent?.includes('Send completed'),'Prepared result without completion banner');
  button('New Send').click();await tick();
  c.confirmAccountSend=async()=>({status:'pending',transactionId:'c'.repeat(64),amountSats:500,recipient:'tark1test',verification:'unavailable'});
  fill('Recipient address','tark1'+'q'.repeat(120));fill('Amount (sats)','500');await tick();button('Review Send').click();await tick();button('Confirm Send').click();await tick();
  check(!button('Confirm Send')&&host.textContent?.includes('Do not send again'),'Pending prevents new payment');
  c.closeAccount();c.checkAccountSend=async()=>({status:'pending',transactionId:'c'.repeat(64),amountSats:500,recipient:'tark1test'});c.openAccountSend();await tick();check(host.textContent?.includes('Do not send again'),'Reopening pending');
  const card=host.querySelector('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'No overflow');
  result.textContent='PASS: entry, no unsupported routes, clipboard race/denial, exact review, focus, Back, Max, duplicate click, success, pending/reopen, 320px layout. Isolated test doubles; no live payment.';
 }catch(e){result.textContent='FAIL: '+(e instanceof Error?e.message:'Send checks');}
};
