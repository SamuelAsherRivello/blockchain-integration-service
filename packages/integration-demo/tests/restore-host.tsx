import { createBisContext, createBisUi } from '@bis/integration';
import { createContext, type BisContext } from '../../integration/src/core/context';
import type { AccountSecret } from '../../integration/src/arkade/account';
import { createAccount } from '../../integration/src/arkade/account';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { validRecovery } from '../../integration/src/core/recovery-validation';

// Verification-only host. Secrets remain inside this page and never enter output.
const host=document.getElementById('host')!;
const result=document.getElementById('result')!;
let context: BisContext | undefined;
let ui: ReturnType<typeof createBisUi> | undefined;
const tick=()=>new Promise(resolve=>setTimeout(resolve,40));
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);};
const action=(text:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===text)!;
const fields=()=>Array.from(host.querySelectorAll<HTMLInputElement>('.bis-word-input input'));
const show=()=>host.querySelector<HTMLInputElement>('.bis-show-check input')!;
function input(index:number,value:string){const field=fields()[index];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));}
async function mount(next:BisContext){ui?.unmount();context?.dispose();context=next;ui=createBisUi(next);ui.mount(host);await next.ready();next.openAccountDialog();await tick();}
async function waitFor(predicate:()=>boolean){for(let i=0;i<1000;i++){if(predicate())return;await tick();}throw Error('Operation did not finish');}
document.getElementById('run')!.onclick=async()=>{
  result.textContent='Running isolated checks';
  let account:AccountSecret|null=null,connects=0,saves=0,fail=true;
  let clipboard=generateMnemonic(wordlist),denied=false,delay:Promise<void>|undefined;
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>{if(delay)await delay;if(denied)throw Error('denied');return clipboard;}}});
  try{
    const c=createContext({load:async()=>({account,generation:0}),save:async a=>{account=a;saves++;},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=> 'isolated-public-id',async phrase=>{connects++;if(fail)throw Error('unavailable');return {phrase,profileId:'isolated-public-id'};});
    await mount(c);c.openRestoreAccount();await tick();
    check(fields().length===12&&!show().checked,'Initial grid');check(action('⚡ Restore').disabled,'Empty disabled');
    input(3,'blah blah');await tick();check(fields()[3].value==='blah'&&fields()[4].value==='blah'&&fields()[2].value==='', 'Sequential words start at selected input');
    input(11,'too many');await tick();check(fields()[11].value===''&&host.textContent?.includes('Only 1 word fields remain'),'Overflow preserves words');
    input(3,'');input(4,'');await tick();
    input(0,'wrongword');await tick();check(host.querySelectorAll('.bis-word-invalid').length===1,'Invalid red');
    input(0,wordlist[0]);await tick();check(host.querySelectorAll('.bis-word-valid').length===1,'Valid green');
    show().click();await tick();check(fields()[0].type==='text','Show reveals');
    action('Paste from Clipboard').click();await tick();check(!show().checked&&fields().every(f=>f.type==='password'),'Paste hides');check(!action('⚡ Restore').disabled,'Valid paste enables');
    check(Array.from(host.querySelectorAll('.bis-word-mask')).every((e,i)=>e.textContent==='*'.repeat(fields()[i].value.length)),'One asterisk per character');
    const words=clipboard.split(' ');let i=0;do{words[11]=wordlist[i++];}while(validRecovery(words.join(' ')));
    clipboard=words.join(' ');action('Paste from Clipboard').click();await tick();
    check(host.querySelectorAll('.bis-word-valid').length===12&&action('⚡ Restore').disabled&&host.textContent?.includes('do not form'),'Checksum error with green words');
    clipboard='wrong count';action('Paste from Clipboard').click();await tick();check(fields().every((f,i)=>f.value===words[i]),'Wrong count preserves grid');
    denied=true;action('Paste from Clipboard').click();await tick();check(host.textContent?.includes('Could not read'),'Clipboard denial');denied=false;
    let release!:()=>void;delay=new Promise<void>(r=>release=r);clipboard=generateMnemonic(wordlist);action('Paste from Clipboard').click();await tick();input(0,'manualedit');await tick();release();await tick();check(fields()[0].value==='manualedit','Late paste cannot overwrite edit');delay=undefined;
    action('Paste from Clipboard').click();await tick();action('⚡ Restore').click();await waitFor(()=>c.getState().phase==='restore-error');await tick();
    check(!show().checked&&saves===0&&fields().length===12,'Failure retains hidden entry');fail=false;action('Retry').click();await waitFor(()=>c.getState().phase==='active');await tick();
    check(connects===2&&saves===1&&host.textContent?.includes('You are now logged in asAccount ID: isol…c-id.')&&!host.querySelector('.bis-restore-grid'),'Immediate Account destination');
    // New isolated client verifies Back clears entry and never affects real storage.
    const empty=createContext({load:async()=>({account:null,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}});
    await mount(empty);empty.openRestoreAccount();await tick();input(0,'discard');await tick();action('Back').click();await empty.ready();empty.openRestoreAccount();await tick();check(fields().every(f=>f.value===''),'Back clears entry');
    result.textContent='PASS: grid, masking, validation, checksum, atomic paste, denial, stale paste, network Retry, Account destination, Back clearing.';
  }catch{result.textContent='FAIL: isolated restoration checks';}
  finally{clipboard='';if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
document.getElementById('live')!.onclick=async()=>{
  result.textContent='Running live Signet restore';
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  let candidate:AccountSecret|undefined;
  try{
    const c=createBisContext();await mount(c);
    check(!c.getState().hasProfile,'Use a fresh browser profile; existing account is preserved');
    candidate=await createAccount(new AbortController().signal);
    const expected=candidate.profileId;let events=0;c.onEvent(e=>{if(e.type==='accountConnected'&&e.profileId===expected)events++;});
    // A2 adapter-created identity, never displayed or committed before restoration.
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>candidate!.phrase}});
    c.openRestoreAccount();await tick();action('Paste from Clipboard').click();await tick();action('⚡ Restore').click();
    await waitFor(()=>['active','restore-error'].includes(c.getState().phase));await tick();
    check(c.getState().phase==='active'&&c.getState().profileId===expected&&events===1,'Real same-identity restoration');
    candidate=undefined;
    await mount(createBisContext());check(context!.getState().profileId===expected,'Persistent independent context');
    sessionStorage.setItem('bis-a3-public-expected-id',expected);
    result.textContent='PASS: live Signet creation/restoration, same public profile, one event, persistent independent host. Reload/restart then Open saved account.';
  }catch{result.textContent='FAIL: live restoration; saved accounts preserved. Inspect non-secret UI status.';}
  finally{candidate=undefined;if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
document.getElementById('reopen')!.onclick=async()=>{
  await mount(createBisContext());const expected=sessionStorage.getItem('bis-a3-public-expected-id');
  result.textContent=context!.getState().hasProfile&&(!expected||context!.getState().profileId===expected)?'PASS: persisted account reopened.':'FAIL: no matching saved account.';
};
