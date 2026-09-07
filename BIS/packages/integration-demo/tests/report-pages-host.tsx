import { createRoot } from 'react-dom/client';
import { CopyableTextArea } from '../../integration/src/ui/CopyableTextArea';
import { useClipboardCopy } from '../../integration/src/ui/useClipboardCopy';
import '@bis/integration/style.css';
const value=Array.from({length:80},(_,i)=>`${i}: A long report line ${'abcdef0123456789'.repeat(5)} 🟢\n`).join('');
let copied='';
function Report(){const copy=useClipboardCopy(()=>value,value);return <div className="bis-layer"><div className="bis-card bis-card-activity"><div className="bis-activity"><CopyableTextArea label="Report" value={value} copy={copy}/></div><button>Back</button></div></div>;}
createRoot(document.getElementById('host')!).render(<Report/>);
const tick=()=>new Promise(resolve=>setTimeout(resolve,60));
const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
document.getElementById('run')!.onclick=async()=>{
 const result=document.getElementById('result')!;
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 try{
  for(const width of [280,240,360]){
   document.getElementById('host')!.style.width=`${width}px`;await tick();
   const previous=document.querySelector<HTMLButtonElement>('.bis-report-pages button')!;
   while(!previous.disabled){previous.click();await tick();}
   let collected='';const next=document.querySelector<HTMLButtonElement>('.bis-report-pages button:last-child')!;
   do{
    const field=document.querySelector('textarea')!;
    check(field.scrollHeight<=field.clientHeight&&field.scrollWidth<=field.clientWidth,'No report scrolling');
    collected+=field.value;
    if(next.disabled)break;
    next.click();await tick();
   }while(true);
   check(collected===value,'Every character appears exactly once');
   const card=document.querySelector('.bis-card')!;
   check(card.scrollHeight<=card.clientHeight&&card.scrollWidth<=card.clientWidth,'No card scrolling');
  }
  document.querySelector<HTMLButtonElement>('[aria-label="Copy Report"]')!.click();await tick();
  check(copied===value,'Copy includes every page');
  result.textContent='PASS: long Unicode report, every character, all pages, complete copy, resize, no report/card scrolling at 240/280/360px';
 }catch(e){result.textContent=`FAIL: ${e instanceof Error?e.message:'report'}`;}
 finally{if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
};
