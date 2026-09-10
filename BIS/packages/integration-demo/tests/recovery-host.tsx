import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';
const host=document.getElementById('host')!,result=document.getElementById('result')!;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
const waitFor=async(predicate:()=>boolean)=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error('UI update timed out');await tick();}};
document.getElementById('run')!.onclick=async()=>{
  (document.getElementById('run') as HTMLButtonElement).disabled=true;
  // Invalid placeholders, using isolated in-memory storage and a stub clipboard.
  const account={phrase:Array.from({length:12},(_,i)=>`placeholder-${i+1}`).join(' '),profileId:'test-profile'};
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');let copied='',copyFail=false;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{if(copyFail)throw Error('denied');copied=value;}}});
  const c=createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('Unexpected write');},reset:async()=>{throw Error('Unexpected reset');},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0}));
  const ui=createBisUi(c);ui.mount(host);
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.replace(/[⚡✓]/g,'').trim()===label)!;
  const click=async(label:string)=>{check(!!button(label),`Missing ${label}`);button(label).click();await tick();};
  try {
    await c.ready();c.openAccountDialog();await waitFor(()=>!!button('Accounts Details'));await click('Accounts Details');
    const labels=[...host.querySelectorAll('.bis-actions button')].map(b=>b.textContent?.replace('⚡','').trim());
    check(labels.join('|')==='Assets|Contracts|Transactions|Get Recovery Phrase|Back','Account Details actions');
    await click('Get Recovery Phrase');await waitFor(()=>host.querySelectorAll('.bis-recovery li').length===12);
    check(host.querySelector('h2')?.textContent==='Get Recovery Phrase','Get title');
    for(const width of [280,360]) {
      host.style.width=`${width}px`;await tick();
      const heading=host.querySelector('.bis-recovery-heading h3')!.getBoundingClientRect();
      for(const icon of host.querySelectorAll('.bis-recovery-heading button')) {const bounds=icon.getBoundingClientRect();check(Math.abs(bounds.top+bounds.height/2-heading.top-heading.height/2)<2,'Recovery controls share a line');}
    }
    check(host.querySelector('.bis-recovery-heading h3')?.textContent==='Seed words','Seed words heading');
    const copy=host.querySelector<HTMLButtonElement>('.bis-recovery-heading [aria-label="Copy Seed words"]')!;
    const eye=host.querySelector<HTMLButtonElement>('.bis-recovery-heading [aria-label="Show seed words"]')!;
    check(!!copy&&!!eye&&eye.getAttribute('aria-pressed')==='false','Inline copy and eye off');
    check(!button('Show Recovery Phrase')&&!button('Copy Recovery Phrase'),'No separate recovery actions');
    check([...host.querySelectorAll('.bis-recovery-word')].every(word=>word.textContent?.startsWith('*')),'Words masked');
    copy.click();await waitFor(()=>!!host.textContent?.includes('Copied to clipboard.'));check(copied===account.phrase,'Exact copy');
    copyFail=true;copy.click();await waitFor(()=>!!host.textContent?.includes('Could not copy.'));
    eye.click();await tick();check(eye.getAttribute('aria-pressed')==='true'&&!!host.querySelector('[aria-label="Hide seed words"]'),'Eye reveals words');
    const card=host.querySelector('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'Narrow layout');
    await click('Back');await click('Get Recovery Phrase');await waitFor(()=>!!host.querySelector('[aria-label="Show seed words"]'));check([...host.querySelectorAll('.bis-recovery-word')].every(word=>word.textContent?.startsWith('*')),'Masked again');
    await click('Back');await click('Back');await click('Log Out');
    check(!button('View Recovery Phrase'),'No recovery button in logout');
    check(host.querySelector('h2')?.textContent==='Account Log Out','Logout dialog');
    check((host.querySelector('input[type=checkbox]') as HTMLInputElement).checked===false,'Fresh backup acknowledgement');
    check(!host.querySelector('.bis-recovery'),'Secret removed');
    await click('Back');await click('Accounts Details');await click('Get Recovery Phrase');await waitFor(()=>!!host.querySelector('[aria-label="Show seed words"]'));
    host.querySelector<HTMLButtonElement>('[aria-label="Show seed words"]')!.click();await tick();
    ui.unmount();ui.mount(host);await waitFor(()=>!!host.querySelector('[aria-label="Show seed words"]'));
    check([...host.querySelectorAll('.bis-recovery-word')].every(word=>word.textContent?.startsWith('*')),'Unmount remasks words');
    result.textContent='PASS: menu order, immediate numbered layout, Seed words controls, default mask, reveal, copy, copy failure, narrow layout, Back/reopen, no logout recovery button, unmount cleanup.';
  } catch(error){result.textContent=`FAIL: ${error instanceof Error?error.message:'recovery checks'}`;}
  finally {ui.unmount();c.dispose();if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
