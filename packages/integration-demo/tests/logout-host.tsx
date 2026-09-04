import { createRoot } from 'react-dom/client';
import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import { GamePreview } from '../src/preview/GamePreview';
import '@bis/integration/style.css';

// Dedicated test-only fixture. Never imported by the demo application.
// All journal reads use an in-memory storage double, never real browser storage.
const pendingCount = new URLSearchParams(location.search).has('pending') ? 5 : 0;
const journal = new Map<string,string>();
Object.defineProperty(window, 'localStorage', {configurable:true, value:{
  get length(){return journal.size;}, key:(i:number)=>[...journal.keys()][i]??null,
  getItem:(key:string)=>journal.get(key)??null,
}});
function seedPending() {
  journal.clear();
  if(pendingCount)journal.set('bis-signet-mints-v1:component-test',JSON.stringify({operations:Array.from({length:pendingCount},(_,i)=>({request:{operationId:String(i)},status:'pending'}))}));
}
seedPending();
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
      const target=targets[i], f=fixtures[i];seedPending();
      button(target,'Log Out').click();await tick();
      let check=target.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      assert(!check.checked && button(target,'Log Out').disabled,'unchecked gate');
      assert(check.labels?.[0]?.textContent?.includes('I have backed up my wallet'),'checkbox label');
      assert(!target.querySelector('.bis-recovery') && !target.textContent?.includes('Copy to Clipboard'),'no recovery access');
      check.click();await tick();
      let pendingCheck=target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1];
      assert(!!pendingCheck === (pendingCount>0),'pending checkbox visibility');
      if(pendingCount){
        assert(pendingCheck.labels?.[0]?.textContent==='I accept losing my (5) pending transactions.','exact pending label');
        assert(button(target,'Log Out').disabled,'pending consent required');pendingCheck.click();await tick();
      }
      assert(!button(target,'Log Out').disabled,'checked gate');
      check.click();await tick();assert(button(target,'Log Out').disabled,'unchecked again');
      check.click();await tick();button(target,'Back').click();await tick();
      assert(f.clears()===0 && f.context.getState().phase==='active','cancel preserves account');
      button(target,'Log Out').click();await tick();
      check=target.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      assert(!check.checked,'reopening resets acknowledgement');
      check.click();await tick();
      pendingCheck=target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1];
      if(pendingCount){assert(!pendingCheck.checked,'pending acknowledgement resets');pendingCheck.click();await tick();}
      f.failNext();button(target,'Log Out').click();await tick();
      assert(f.context.getState().phase==='logout-error' && target.querySelector('.bis-pending-dialog'),'error prompt');
      button(target,'OK').click();await tick();
      assert(f.context.getState().phase==='active' && !target.querySelector('.bis-pending-dialog'),'OK closes failed logout page');
      button(target,'Log Out').click();await tick();target.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();await tick();
      if(pendingCount){target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click();await tick();}
      button(target,'Log Out').click();await tick();
      assert(!f.context.getState().hasProfile && f.clears()===1,'confirmed success');
      assert(!target.querySelector('[role="dialog"]') && !button(target,'⚡ Create Account') && !button(target,'⚡ Restore Account'),'success closes without chooser');
      assert(button(target,'⚡ Account'),'prior host destination');
    }
    output.textContent=`PASS: ${targets.length} host(s), ${pendingCount} pending — checkbox, cancellation, reopening, failure/OK, fresh confirmation, success, destination, no recovery access.`;
  }catch(error){output.textContent=`FAIL: ${error instanceof Error?error.message:'component checks'}`;}
};
