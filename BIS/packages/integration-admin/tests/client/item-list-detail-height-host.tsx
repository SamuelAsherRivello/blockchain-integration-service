import { createRoot } from 'react-dom/client';
import { CollectionDetailView } from '../../../integration/src/client/ui-layer-react/ItemList';
import { FormValue } from '../../../integration/src/client/ui-layer-react/FormValue';
import '@bis/integration/style.css';

const host=document.getElementById('host')!,result=document.getElementById('result')!;
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);};
let root:ReturnType<typeof createRoot>|undefined;
document.getElementById('run')!.onclick=async()=>{
  root?.unmount();root=createRoot(host);result.textContent='Running';
  root.render(<div className="bis-layer bis-layer-open"><CollectionDetailView title="Transaction Detail" body="Inspect this transaction." fieldLabel="Transaction" report="Fixture report" items={[]} listLabel="Transactions" onRefresh={()=>{}} onBack={()=>{}} detail={<FormValue aria-label="Transaction" label="Transaction" multiline rows={12} value={'Transaction detail\n'.repeat(48)}/>}/></div>);
  try {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    const card=host.querySelector<HTMLElement>('.bis-card')!,detail=host.querySelector<HTMLElement>('.bis-collection-detail')!,field=host.querySelector<HTMLTextAreaElement>('textarea')!;
    check(card.getBoundingClientRect().height>500,'shared detail card uses available vertical space');
    check(detail.getBoundingClientRect().height>128&&field.getBoundingClientRect().height>128,'detail report grows beyond the compact report height');
    check(getComputedStyle(field).overflowY==='scroll','detail report keeps its scrollbar');
    result.textContent='PASS: shared item detail fills available height and expands its scrollable report.';
  } catch(error) {result.textContent=`FAIL: ${error instanceof Error?error.message:'layout checks'}`;}
};
window.addEventListener('pagehide',()=>root?.unmount());
