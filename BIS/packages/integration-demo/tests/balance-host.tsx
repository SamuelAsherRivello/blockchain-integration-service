import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!;
const tick=()=>new Promise(r=>setTimeout(r,20));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
const wait=async(test:()=>boolean)=>{for(let i=0;i<150;i++){if(test())return;await tick();}throw Error('UI timeout');};
let cleanup=()=>{};
document.getElementById('run')!.onclick=async()=>{
 cleanup();result.textContent='Running';let writes=0,calls=0,fail=false;
 let resolve!:(value:{availableSats:number;totalSats:number;bitcoinSats:number;arkadeSats:number})=>void;
 const account={phrase:'isolated-placeholder',profileId:'1234567890abcdef'};
 const c=createContext({load:async()=>({account,generation:0}),save:async()=>{writes++;},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>{calls++;if(fail)throw Error('private');return new Promise(yes=>{resolve=yes;});});
 const ui=createBisUi(c);ui.mount(host);cleanup=()=>{ui.unmount();c.dispose();};
 const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===label)!;
 const values=()=>[...host.querySelectorAll<HTMLInputElement>('input')].map(input=>input.value);
 const finish=async(n=1000)=>{resolve({availableSats:n,totalSats:n+500,bitcoinSats:500,arkadeSats:n});await wait(()=>c.getState().balance.status==='ready');await tick();};
 try {
  await c.ready();c.openAccountDialog();await tick();check(calls===0&&!!button('Accounts Details')&&!!button('Log Out'),'Menu does not read');
  button('Accounts Details').click();await tick();button('Balance').click();await wait(()=>calls===1);await tick();check(host.querySelector('h2')?.textContent==='Balance'&&!button('Log Out'),'Balance title/actions');
  check(!!host.querySelector('.bis-pending-dialog')&&button('Refresh Balance').disabled,'Pending covered');await finish();
  check(values().join('|')==='1,500 sats|500 sats|1,000 sats','Full balance split');
  button('Refresh Balance').click();await wait(()=>calls===2);await tick();check(values().every(value=>value===''),'Refresh clears stale values');await finish(0);
  check(values().at(-1)==='0 sats','Zero displayed');
  fail=true;await c.refreshBalance();await tick();check(calls===4&&values().every(value=>value==='')&&!!button('OK'),'One retry, final error and no stale values');
  button('OK').click();await tick();check(!host.querySelector('.bis-account-balances'),'OK closes failed source');
  fail=false;button('Balance').click();await wait(()=>calls===5);await finish();button('Back').click();await tick();check(!host.querySelector('.bis-account-balances'),'Back clears view');
  c.openAccountDetails();await wait(()=>calls===6);c.closeAccount();c.openLogoutConfirmation();await tick();
  resolve({availableSats:999,totalSats:999,bitcoinSats:0,arkadeSats:999});await tick();check(!host.textContent?.includes('999'),'Abandoned read ignored');
  check(host.querySelector('h2')?.textContent==='Account Log Out','Logout destination');button('Back').click();await tick();check(calls===6&&writes===0,'No extra reads or persistence');
  result.textContent='PASS: Balance loading/values/zero, refresh clearing, bounded retry and error/OK, Back/reopen, logout and stale read isolation, no persistence.';
 }catch(e){result.textContent=`FAIL: ${e instanceof Error?e.message:'balance checks'}`;}
};
