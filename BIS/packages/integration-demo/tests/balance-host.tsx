import {createContext} from '../../integration/src/core/context';
import {createBisUi} from '@bis/integration';
import '@bis/integration/style.css';

const host=document.getElementById('host')!, result=document.getElementById('result')!;
const tick=()=>new Promise(r=>setTimeout(r,0));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
let cleanup=()=>{};
document.getElementById('run')!.onclick=async()=>{
  cleanup();result.textContent='Running';
  let writes=0,calls=0;
  let resolve!: (value:{availableSats:number;totalSats:number})=>void;
  let reject!: (reason:Error)=>void;
  const account={phrase:'isolated-test-placeholder',profileId:'1234567890abcdef'};
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{writes++;},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,()=>{calls++;return new Promise((yes,no)=>{resolve=yes;reject=no;});});
  const ui=createBisUi(c);ui.mount(host);cleanup=()=>{ui.unmount();c.dispose();};
  const button=(name:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name)!;
  try{
    await c.ready();c.openAccountDialog();await tick();await tick();
    check(calls===0 && !!button('⚡ Account Details') && !!button('⚡ Log Out') && !button('⚡ Refresh'),'Menu only');
    button('⚡ Account Details').click();await tick();await tick();
    check(host.querySelector('h2')?.textContent==='Account Details' && !button('⚡ Log Out'),'Details title and actions');
    check(button('⚡ Refresh').disabled && !button('Back').disabled,'Pending controls');
    check(host.textContent?.includes('Network: Signet')&&host.textContent.includes('Loading balance...'),'Loading');
    resolve({availableSats:1000,totalSats:1500});await tick();await tick();
    check(host.textContent?.includes('1,000 sats')&&host.textContent.includes('Total balance: 1,500 sats'),'Amounts');
    button('⚡ Refresh').focus();button('⚡ Refresh').click();await tick();
    check(!host.textContent?.includes('1,000'),'No previous value during refresh');reject(Error('private failure'));await tick();await tick();
    check(host.textContent?.includes('Balance unavailable')&&!host.textContent.includes('1,500')&&!button('⚡ Refresh').disabled,'Failure hides old values');
    button('⚡ Refresh').click();await tick();resolve({availableSats:0,totalSats:0});await tick();await tick();
    check(host.textContent?.includes('0 sats'),'Real zero presentation');
    button('Back').click();await tick();check(!host.textContent?.includes('sats'),'Close clears');
    button('⚡ Account Details').click();await tick();await tick();check(calls===4&&c.getState().balance.status==='loading','Reopen fetches');
    button('Back').click();await tick();button('⚡ Log Out').click();await tick();check(host.textContent?.includes('Back up your recovery phrase. Logout clears transaction recovery data but does not cancel transactions.'),'Logout available');
    resolve({availableSats:999,totalSats:999});await tick();check(!host.textContent?.includes('999'),'Late result ignored');
    button('Back').click();await tick();check(calls===4,'Logout returns to menu without fetching');button('⚡ Account Details').click();await tick();await tick();resolve({availableSats:1000,totalSats:1500});await tick();await tick();
    check(writes===0,'No persistence');
    result.textContent='PASS: loading, amounts, refresh, failure without stale values, zero, Back, reopen, logout cancellation, race isolation, no storage writes.';
  }catch(error){result.textContent=`FAIL: ${error instanceof Error?error.message:'balance checks'}`;}
};
