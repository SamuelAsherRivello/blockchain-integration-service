import { createRoot } from 'react-dom/client';
import { ItemList } from '../../integration/src/ui/ItemList';
import { CompactItemRow, StatusTypeIcon } from '../../integration/src/ui/StatusTypeIcon';
import '@bis/integration/style.css';

const host=document.getElementById('host')!,result=document.getElementById('result')!;
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);};
const kinds=['Assets','Contracts','Transactions'] as const;
let rowCount=5;
let root:ReturnType<typeof createRoot>|undefined;

function items(kind:string) {
  return Array.from({length:rowCount},(_,index)=>({
    id:`${kind}-${index}`,
    onSelect:()=>{},
    content:<CompactItemRow status={index%2?'info':'success'} leading={<StatusTypeIcon type={index%2?'info':'success'}/>} fields={[
      {icon:'⚙️',label:'Type',value:`${kind} ${index+1}`},{icon:'🪙',label:'Amount',value:'1,000 sats'},
      {icon:'📡',label:'Network',value:'Off-chain'},{icon:'✅',label:'Status',value:'Ready'},
      {icon:'🎯',label:'Purpose',value:'Long fixture value that must stay contained'},{icon:'📅',label:'Time',value:'Today'},
    ]}/>,
  }));
}

function render() {
  root?.unmount();
  root=createRoot(host);
  root.render(<div className="bis-layer bis-layer-open" style={{display:'flex',alignItems:'flex-start',gap:16,padding:16}}>
    {kinds.map(kind=><ItemList key={kind} title={kind} body={`${kind} fixture.`} fieldLabel={kind} report={`${kind} report`} items={items(kind)} listLabel={kind} onRefresh={()=>{}} onBack={()=>{}} />)}
  </div>);
}

async function frame() { await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))); }
async function inspect() {
  await frame();
  const cards=[...host.querySelectorAll<HTMLElement>('.bis-item-list')];
  const lists=[...host.querySelectorAll<HTMLElement>('.bis-collection-list')];
  const rows=[...host.querySelectorAll<HTMLElement>('.bis-collection-item')];
  check(cards.length===3,'three collection cards render');
  check(lists.length===3,'three collection lists render');
  check(new Set(cards.map(card=>Math.round(card.getBoundingClientRect().height))).size===1,'collection cards share one height');
  check(cards.every(card=>Math.round(card.getBoundingClientRect().height)===456),'collection cards leave room for the persistent Back footer');
  check(lists.every(list=>Math.round(list.getBoundingClientRect().height)===276),'lists reserve 276px for 3.5 rows');
  check(lists.every(list=>getComputedStyle(list).overflowY==='scroll'),'lists always use a persistent scrollbar');
  check(lists.every(list=>getComputedStyle(list).scrollbarGutter==='stable'),'lists reserve a stable scrollbar gutter');
  check(new Set(rows.map(row=>`${Math.round(row.getBoundingClientRect().width)}x${Math.round(row.getBoundingClientRect().height)}`)).size===1,'all item rows share width and height');
  check(rows.every(row=>Math.round(row.getBoundingClientRect().height)===72),'all item rows use 72px height');
  check(cards.every(card=>{const cardBox=card.getBoundingClientRect(),back=card.querySelector<HTMLButtonElement>('.bis-back')!.getBoundingClientRect();return back.top>=cardBox.top&&back.bottom<=cardBox.bottom;}),'Back buttons stay inside every collection card');
  check(cards.every(card=>{const list=card.querySelector<HTMLElement>('.bis-collection-list')!.getBoundingClientRect(),back=card.querySelector<HTMLButtonElement>('.bis-back')!.getBoundingClientRect();return back.top-list.bottom>=12;}),'collection footer keeps vertical separation above the three-dot separator');
  check(host.scrollWidth<=host.clientWidth && host.scrollHeight<=host.clientHeight,'fixture has no outer overflow');
}

async function run() {
  try { render(); await inspect(); result.textContent='PASS: equal 384px cards, 276px persistent-scrollbar lists, and 72px shared rows.'; }
  catch(error) { result.textContent=`FAIL: ${error instanceof Error?error.message:'layout checks'}`; }
}

for(const [count,id] of [[0,'rows-0'],[1,'rows-1'],[2,'rows-2'],[5,'rows-5']] as const) document.getElementById(id)!.onclick=()=>{rowCount=count;render();};
document.getElementById('run')!.onclick=()=>void run();
window.addEventListener('pagehide',()=>root?.unmount());
