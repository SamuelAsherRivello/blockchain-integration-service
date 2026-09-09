import {createContext} from '../../integration/src/core/context';
import {createBisUi} from '@bis/integration';
import type {OnboardingAdapter} from '../../integration/src/core/onboarding-service';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!;
const pause=()=>new Promise(r=>setTimeout(r,20));
const wait=async(check:()=>boolean)=>{for(let i=0;i<150;i++){if(check())return;await pause();}throw Error('UI timeout');};
let cleanup=()=>{};
document.getElementById('run')!.onclick=async()=>{
 cleanup();result.textContent='Running';let funded=false,reads=0;
 const account={phrase:'unused-ui-placeholder',profileId:'onboarding-ui-fixture'},bitcoinAddress='tb1-public-onboarding-fixture';
 const adapter:OnboardingAdapter={inspect:async()=>{reads++;return {address:bitcoinAddress,independent:[],transactions:funded?[{txid:'1'.repeat(64),value:100,kind:'incoming',confirmed:true},{txid:'2'.repeat(64),value:200,kind:'incoming',confirmed:false}]:[],snapshot:{profileId:account.profileId,network:'signet',operator:'https://signet.arkade.sh',complete:true,unresolvedOnboarding:false,bitcoinScript:'5120',arkadeScript:'5120',boarding:funded?[{txid:'1'.repeat(64),vout:0,value:100,confirmed:true,expired:false,reserved:false}]:[],spendable:[],policy:{zeroFees:true,arkadeMinimum:330,bitcoinMinimum:330,arkadeMaximum:0,bitcoinMaximum:0}}};},submit:async()=>{throw Error('Fixture never signs');}};
 const context=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0}),undefined,async()=>({bitcoinAddress,arkadeAddress:'tark-fixture'}),async()=>{},undefined,{list:async()=>({status:'ready',assets:[]}),mint:async()=>{throw Error('Unused');}},undefined,undefined,undefined,undefined,undefined,async()=>{},()=>adapter);
 const ui=createBisUi(context);ui.mount(host);cleanup=()=>{ui.unmount();context.dispose();};
 const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
 try{
  await context.ready();await wait(()=>context.getState().onboarding?.status==='start');check(reads===1,'Automatic activation without page visit');context.openAccountDialog();context.openAccountDetails();await wait(()=>context.getState().balance.status==='ready');await pause();
  const entry=button('Onboarding: Start?');check(entry?.nextElementSibling?.textContent==='Get Recovery Phrase','Entry placement');entry.click();await pause();check(host.querySelector('h2')?.textContent==='Onboarding','Details title');check(host.querySelectorAll('.bis-onboarding-step').length===5,'Five stages');await wait(()=>!host.querySelector('.bis-pending-dialog'));check(!host.querySelector('.bis-pending-dialog'),'No blocking loader');
  const faucet=host.querySelector<HTMLAnchorElement>('a[href*="google"]');check(faucet?.href==='https://www.google.com/search?q=signet+bitcoin+faucet','Minimal faucet URL');
  funded=true;context.refreshOnboarding?.();await wait(()=>context.getState().onboarding?.transactions.length===2);await pause();check(host.querySelectorAll('.bis-onboarding-confirmed').length===1&&host.querySelectorAll('.bis-onboarding-unconfirmed').length===1,'Independent confirmations');
  const panel=host.querySelector<HTMLElement>('.bis-onboarding-transactions')!;check(getComputedStyle(panel).overflowY==='scroll'&&getComputedStyle(panel).maxHeight==='100px','Compact transaction output');
  check(host.textContent?.includes('Next check in'),'Actual countdown');button('Back').click();await pause();check(context.getState().accountDetails&&!context.getState().accountOnboarding,'Back to Balance');context.openAccountOnboarding();await pause();
  result.textContent='PASS: automatic activation, exact entry placement, five stages, faucet URL, mixed confirmations, scrolling, countdown, nonblocking details and Back.';
 }catch(error){result.textContent=`FAIL: ${error instanceof Error?error.message:'UI verification'}`;}
};
