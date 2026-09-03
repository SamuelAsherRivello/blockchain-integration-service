import { createRoot } from 'react-dom/client';
import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import { GamePreview } from '../src/preview/GamePreview';
import '@bis/integration/style.css';

// Dedicated test-only fixture. Never imported by the demo application.
function fixture() {
  let account: {phrase:string;profileId:string} | null = {phrase:'not-a-wallet',profileId:'component-test'};
  let generation=0, fail=false, clears=0;
  const context=createContext({
    load:async()=>({account,generation}),
    save:async()=>{throw Error('Creation outside this fixture');},
    reset:async(expected)=>{
      if(fail){fail=false;throw Error('test failure');}
      if(expected!==generation)throw Error('stale');
      account=null;generation++;clears++;
    },
    subscribe:()=>()=>{},
  },async()=>{throw Error('Creation outside this fixture');},async()=>'component-test');
  return {context, failNext:()=>{fail=true;},clears:()=>clears};
}
const plainOnly=new URLSearchParams(location.search).has('plain');
if(!plainOnly)await import('../src/style.css');
// Mount after the actual preview component has assigned its container ref.
const previewRef={current:null as HTMLDivElement|null};
if(!plainOnly)createRoot(document.getElementById('preview')!).render(<GamePreview containerRef={previewRef} />);
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,30));
await tick();
const targets=plainOnly?[document.getElementById('plain')!]:[previewRef.current!,document.getElementById('plain')!];
const fixtures=targets.map(target=>{
  const f=fixture(); const ui=createBisUi(f.context);ui.mount(target);
  void f.context.ready().then(()=>{ui.showAccountButton();f.context.openAccountDialog();});
  return f;
});
const button=(target:HTMLElement,name:string)=>[...target.querySelectorAll('button')].find(b=>b.textContent?.trim()===name)!;
function assert(value:unknown,message:string){if(!value)throw Error(message);}
document.getElementById('run')!.onclick=async()=>{
  const output=document.getElementById('result')!;
  try {
    for(let i=0;i<targets.length;i++){
      const target=targets[i], f=fixtures[i];
      button(target,'⚡ Log Out').click();await tick();
      let check=target.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      assert(!check.checked && button(target,'⚡ Log Out').disabled,'unchecked gate');
      assert(check.labels?.[0]?.textContent?.includes('I have backed up my wallet'),'checkbox label');
      assert(!target.querySelector('.bis-recovery') && !target.textContent?.includes('Copy to Clipboard'),'no recovery access');
      check.click();await tick();assert(!button(target,'⚡ Log Out').disabled,'checked gate');
      check.click();await tick();assert(button(target,'⚡ Log Out').disabled,'unchecked again');
      check.click();await tick();button(target,'Back').click();await tick();
      assert(f.clears()===0 && f.context.getState().phase==='active','cancel preserves account');
      button(target,'⚡ Log Out').click();await tick();
      check=target.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      assert(!check.checked,'reopening resets acknowledgement');
      check.click();await tick();f.failNext();button(target,'⚡ Log Out').click();await tick();
      assert(f.context.getState().phase==='logout-error' && button(target,'Retry'),'error retry');
      button(target,'Retry').click();await tick();
      assert(!f.context.getState().hasProfile && f.clears()===1,'confirmed success');
      assert(button(target,'⚡ Restore Account').disabled && button(target,'⚡ Create Account'),'chooser destination');
      button(target,'Back').click();await tick();assert(button(target,'⚡ Account'),'prior host destination');
    }
    output.textContent=`PASS: ${targets.length} host(s) — checkbox, cancellation, reopening, failure/Retry, success, destination, no recovery access.`;
  }catch(error){output.textContent=`FAIL: ${error instanceof Error?error.message:'component checks'}`;}
};
