import {createContext, getControls} from '../../integration/src/core/context';
import {createBisUi} from '@bis/integration';
import type {BisAsset} from '../../integration/src/core/assets';
import '@bis/integration/style.css';

const host=document.getElementById('host')!, result=document.getElementById('result')!;
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,20));
const wait=async(test:()=>boolean)=>{for(let i=0;i<150;i++){if(test())return;await tick();}throw Error('Timed out waiting for UI');};
const assert=(test:unknown,message:string)=>{if(!test)throw Error(message);};
const button=(name:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent?.replace('⚡','').trim()===name || b.getAttribute('aria-label')===name);if(!b)throw Error('Missing button '+name);return b;};
const dialog=()=>host.querySelector<HTMLElement>('.bis-pending-dialog');
const covered=()=>!!dialog() && host.querySelector<HTMLElement>('.bis-runtime-content')?.inert;
const asset:BisAsset={assetId:'a'.repeat(68),quantity:'3',decimals:0,name:'Fixture Asset',ticker:'TEST'};
const account={phrase:'isolated-placeholder',profileId:'pending-fixture'};
let cleanup=()=>{}, finishRead:((value:BisAsset[])=>void)|undefined, finishBurn:(()=>void)|undefined;
let mode:'ready'|'pending'|'fail'|'once'='ready', reads=0, burns=0, data=[asset];
function setup() {
  cleanup();mode='ready';reads=0;burns=0;data=[asset];
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,
    async()=>({availableSats:10,totalSats:10,bitcoinSats:0,arkadeSats:10}),undefined,
    async()=>({bitcoinAddress:'fixture-bitcoin',arkadeAddress:'fixture-arkade'}),
    async(_a,signal,publish)=>{publish([{id:'fixture-tx',amountSats:5,direction:'Incoming',status:'Pending',identifier:'fixture-record'}]);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));},undefined,
    {list:async()=>{reads++;if(mode==='fail')throw Error('fixture');if(mode==='once'){mode='ready';throw Error('first attempt');}if(mode==='pending')return new Promise<BisAsset[]>(resolve=>{finishRead=resolve;});return data;},mint:async()=>{throw Error('No mint in fixture');}});
  c.burnAsset=async request=>{burns++;await new Promise<void>(resolve=>{finishBurn=resolve;});data=[];return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'b'.repeat(64)};};
  const ui=createBisUi(c);ui.mount(host);cleanup=()=>{ui.unmount();c.dispose();};
  return c;
}
document.getElementById('admin')!.onclick=event=>{(event.currentTarget as HTMLElement).textContent='Admin clicked';};
document.getElementById('loading')!.onclick=async()=>{const c=setup();await c.ready();mode='pending';c.openAccountDialog();c.openAccountAssets();};
document.getElementById('failure')!.onclick=async()=>{const c=setup();await c.ready();mode='fail';c.openAccountDialog();c.openAccountAssets();};
document.getElementById('burning')!.onclick=async()=>{const c=setup();await c.ready();c.openAccountDialog();c.openAccountAssets();await wait(()=>!dialog()&&!!host.querySelector('.bis-asset-row'));host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();button('Burn').click();await tick();button('OK').click();};
document.getElementById('run')!.onclick=async()=>{
  result.textContent='Running';const checks:string[]=[];
  try {
    const c=setup();await c.ready();c.openAccountDialog();mode='pending';c.openAccountAssets();
    await wait(()=>!!finishRead && !!dialog());
    assert(covered(),'Initial page is covered and inert');assert(dialog()?.textContent?.includes('Loading...'),'Loading label');
    assert(!host.querySelector('.bis-runtime-content')?.textContent?.includes('Loading...'),'No inline loading');
    assert(!dialog()?.querySelector('button'),'Pending is noninteractive');
    button('Back').focus();assert(document.activeElement!==button('Back'),'Inert controls cannot take focus');
    dialog()!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(covered(),'Escape does not dismiss');
    document.getElementById('admin')!.click();assert(document.getElementById('admin')?.textContent==='Admin clicked','Admin remains usable');
    checks.push('Immediate cover, inert controls, no inline loading, Escape, Admin scope');
    finishRead!([asset]);await wait(()=>!dialog());assert(!!host.querySelector('.bis-asset-row'),'Ready list revealed');
    mode='once';const before=reads;await c.refreshAssets();await wait(()=>!dialog());assert(reads===before+2,'Exactly one automatic read retry');
    mode='fail';const failedBefore=reads;await c.refreshAssets();await wait(()=>!!dialog()?.querySelector('button'));assert(reads===failedBefore+2,'No third read');
    assert(dialog()?.querySelectorAll('button').length===1&&dialog()?.querySelector('button')?.textContent==='OK','Only OK on error');
    button('OK').click();await wait(()=>!dialog());assert(!c.getState().accountAssets,'OK closes failed source page');checks.push('One retry, final error, OK closes source');
    mode='ready';c.openAccountAssets();await wait(()=>!dialog()&&!!host.querySelector('.bis-asset-row'));host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();
    button('Burn').click();await tick();button('Cancel').click();await tick();assert(burns===0,'Confirmation cancel does not submit');
    button('Burn').click();await tick();button('OK').click();await wait(()=>burns===1&&!!dialog());assert(dialog()?.textContent?.includes('Burning...'),'Burn label');
    mode='pending';finishBurn!();await wait(()=>reads>failedBefore+2&&c.getState().assets.status==='loading');await tick();
    assert(dialog()?.textContent?.includes('Burning...'),'Burning stays through refresh');assert(!host.textContent?.includes('Asset burned.'),'No completion message');
    finishRead!([]);await wait(()=>!dialog());assert(host.textContent?.includes('No assets found.'),'Fresh empty holdings revealed');assert(burns===1,'Single submission');checks.push('Burn confirmation, one submission, continuous refresh, clean success');
    mode='ready';data=[asset];await c.refreshAssets();await wait(()=>!dialog());host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();
    button('Burn').click();await tick();button('OK').click();await wait(()=>burns===2&&!!dialog());
    const beforeFailedRefresh=reads;mode='fail';finishBurn!();await wait(()=>!!dialog()?.querySelector('button'));
    assert(reads===beforeFailedRefresh+2&&burns===2,'Failed post-burn refresh retries only the read');
    mode='ready';button('OK').click();await wait(()=>!dialog());assert(c.getState().accountAssets&&host.querySelector('h2')?.textContent==='Assets','Failed burn preparation returns to prepared parent Assets');
    checks.push('Post-burn failure retries reads only and closes original detail');
    data=[asset];await c.refreshAssets();await wait(()=>!dialog());host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();
    c.burnAsset=async()=>({status:'error',code:'outcome-unknown',message:'Fixture uncertain'});
    button('Burn').click();await tick();button('OK').click();await wait(()=>!!dialog()?.querySelector('button'));assert(dialog()?.textContent?.includes('Outcome not yet confirmed'),'Truthful unknown outcome');
    button('OK').click();await wait(()=>!dialog());assert(host.querySelector('h2')?.textContent==='Assets','Failed detail returns to Assets');checks.push('Unknown burn outcome and parent navigation');
    host.style.width='280px';host.style.height='360px';mode='pending';void c.refreshAssets();await wait(()=>!!dialog());
    const a=host.getBoundingClientRect(),b=dialog()!.getBoundingClientRect();assert(b.left>=a.left&&b.right<=a.right&&b.bottom<=a.bottom,'Narrow dialog fits host');
    c.closeAccount();await wait(()=>!dialog());finishRead!([asset]);await tick();assert(!dialog()&&!c.getState().accountAssets,'Late callback ignored');checks.push('Narrow host and obsolete response');
    host.style.width='360px';host.style.height='640px';mode='ready';c.openAccountActivity();await wait(()=>!dialog()&&!!host.querySelector('.bis-transaction-row'));assert(c.getState().activity.status==='ready','History revealed before subscription ends');checks.push('Activity first-result readiness');
    c.closeAccount();c.openAccountReceive();await wait(()=>!dialog()&&!!host.querySelector('input'));assert(host.querySelector<HTMLInputElement>('input')?.value==='fixture-bitcoin','Receive prepared');
    c.closeAccount();c.openAccountDetails();await wait(()=>!dialog()&&!!host.querySelector('.bis-account-balances'));checks.push('Receive and balances prepared');
    c.openAccountRecovery();await wait(()=>!dialog()&&c.getState().recoveryStatus==='ready');getControls(c).hideRecovery();c.closeAccount();checks.push('Recovery preparation');
    result.textContent='PASS\n'+checks.join('\n')+'\nFixtures only; no live wallet mutations.';
  } catch(error) {result.textContent='FAIL: '+(error instanceof Error?error.message:String(error))+'\n'+checks.join('\n');}
};
window.addEventListener('pagehide',()=>cleanup());

document.getElementById('lifecycle')!.onclick=async()=>{
  cleanup();result.textContent='Running lifecycle checks';
  let stored: typeof account | null=null, gate: (()=>void)|undefined;
  let step='hydrate';
  const pause=()=>new Promise<void>(resolve=>{gate=resolve;});
  const c=createContext({
    load:async()=>{if(step==='hydrate'){step='idle';await pause();}return {account:stored,generation:0};},
    save:async value=>{await pause();stored=value;},
    reset:async()=>{await pause();stored=null;},subscribe:()=>()=>{},
  },async()=>{await pause();return account;},async()=>account.profileId,async()=>{await pause();return account;});
  const ui=createBisUi(c);ui.mount(host);ui.showAccountButton();cleanup=()=>{ui.unmount();c.dispose();};
  async function expectLabel(label:string){await wait(()=>!!gate && dialog()?.textContent?.includes(label)===true);assert(covered(),label+' covers runtime');}
  function release(){const done=gate;gate=undefined;done?.();}
  try {
    await expectLabel('Loading...');release();await c.ready();await wait(()=>!dialog());
    c.openAccountDialog();void c.createAccount();await expectLabel('Creating...');release();await wait(()=>!dialog()&&c.getState().phase==='recovery');
    void c.continueAccount();await expectLabel('Saving...');release();await wait(()=>!dialog()&&c.getState().phase==='active');
    c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);void c.confirmLogout();await expectLabel('Logging out...');release();await wait(()=>!dialog()&&!c.getState().hasProfile);
    c.openRestoreAccount();
    // Public BIP39 test vector, consumed only by a fixture adapter; never a real wallet.
    void getControls(c).restore('abandon '.repeat(11)+'about');await expectLabel('Restoring...');release();await expectLabel('Saving...');release();await wait(()=>!dialog()&&c.getState().phase==='active');
    void getControls(c).reset();await expectLabel('Resetting...');release();await wait(()=>!dialog()&&c.getState().view==='empty');
    result.textContent='PASS: delayed hydration, creation, saving, logout, restoration, restore-saving and visible Reset all stay covered. In-memory fixture only; no real wallet or browser storage cleanup.';
  }catch(error){result.textContent='FAIL: '+(error instanceof Error?error.message:String(error));}
};
