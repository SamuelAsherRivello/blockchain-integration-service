import { createRoot } from 'react-dom/client';
import { CollectionDetailView } from '../../../integration/src/client/ui-layer-react/ItemList';
import '@bis/integration/style.css';

const host=document.getElementById('host')!,result=document.getElementById('result')!;
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);};
let root:ReturnType<typeof createRoot>|undefined;
document.getElementById('run')!.onclick=async()=>{
  root?.unmount();root=createRoot(host);result.textContent='Running';
  root.render(<div className="bis-layer bis-layer-open"><CollectionDetailView title="Transaction Detail" body="Inspect this transaction." fieldLabel="Transaction" report={'Transaction detail\n'.repeat(48)} items={[]} listLabel="Transactions" onRefresh={()=>{}} onBack={()=>{}} actions={<><button className="bis-button">View Recovery Info</button><button className="bis-button">Open On Explorer</button></>}/></div>);
  try {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    const card=host.querySelector<HTMLElement>('.bis-card')!,detail=host.querySelector<HTMLElement>('.bis-collection-detail')!,field=host.querySelector<HTMLTextAreaElement>('textarea')!;
    check(host.querySelectorAll('textarea').length===1&&!host.querySelector('input'),'one multiline report without a duplicate preview');
    check(host.querySelector('[aria-label="Copy Transaction Detail"]'),'shared field includes a copy button');
    check(field.getBoundingClientRect().height===192,'report matches the approved field height');
    check(field.scrollHeight>field.clientHeight,'long reports overflow within the field');
    check(detail.scrollHeight<=detail.clientHeight+1,'detail container does not add a nested scrollbar');
    check(card.scrollHeight<=card.clientHeight+1,'card fits without overflow');
    check(Array.from(host.querySelectorAll('.bis-actions button')).map(button=>button.textContent).join('|')==='View Recovery Info|Open On Explorer|Back','existing actions retain their order');
    check(getComputedStyle(field).overflowY==='scroll','detail report keeps its scrollbar');
    result.textContent='PASS: one shared copyable report with bounded height, internal scrolling and preserved actions.';
  } catch(error) {result.textContent=`FAIL: ${error instanceof Error?error.message:'layout checks'}`;}
};
window.addEventListener('pagehide',()=>root?.unmount());
