import { useRef, useLayoutEffect, type ReactNode, type Ref, type UIEventHandler } from 'react';
import { AccountCard } from './AccountCard';
import { CopyFieldLabel } from './CopyFieldLabel';
import { ReportTextArea } from './ReportTextArea';
import { useClipboardCopy } from './useClipboardCopy';

export type ItemListItem = Readonly<{ id:string; content:ReactNode; selected?:boolean; onSelect():void; buttonRef?:Ref<HTMLButtonElement> }>;
export type ItemListProps = {
  title:string;body:ReactNode;fieldLabel:string;report:string;items:readonly ItemListItem[];
  detail?:ReactNode;notice?:ReactNode;actions?:ReactNode;overlay?:ReactNode;onBack():void;backDisabled?:boolean;loading?:boolean;
  listLabel:string;headingActions?:ReactNode;listRef?:Ref<HTMLUListElement>;onScroll?:UIEventHandler<HTMLUListElement>;
};
/** Item List: the same fixed-height list page for assets, contracts and transactions. */
export function ItemList(props:ItemListProps) { return <ItemListFrame {...props} mode="list"/>; }
/** Item List Detail: the shared detail page for an item from any of those lists. */
export function ItemListDetail(props:ItemListProps) { return <ItemListFrame {...props} mode="detail"/>; }
function ItemListFrame({title,body,fieldLabel,report,items,detail,notice,actions,overlay,onBack,backDisabled=false,loading=false,listLabel,headingActions,listRef,onScroll,mode}: ItemListProps & {mode:'list'|'detail'}) {
  const heading=useRef<HTMLHeadingElement>(null);
  const copy=useClipboardCopy(()=>report,report,loading);
  useLayoutEffect(()=>{heading.current?.focus();},[title]);
  return <AccountCard title={title} description={body} headingRef={heading} headingActions={headingActions} className={` bis-card-collection ${mode==='list'?'bis-item-list':'bis-item-list-detail'}`}>
    <div className="bis-collection" aria-busy={loading}>
      <CopyFieldLabel label={fieldLabel} copied={copy.status==='copied'} disabled={!report||loading||copy.status==='copying'} onCopy={()=>void copy.copy()} />
      <span className="bis-sr-only" role="status">{copy.status==='copied'?`${fieldLabel} copied.`:''}</span>
      {copy.status==='failed'&&<><p role="status">Could not copy. Select the text below and copy it manually.</p><ReportTextArea aria-label={`${fieldLabel} for manual copy`} rows={3} value={report}/></>}
      {mode==='detail' ? <div className="bis-collection-scroll bis-collection-detail">{detail}{notice}</div> : <ul ref={listRef} onScroll={onScroll} className="bis-collection-scroll bis-collection-list" aria-label={listLabel}>
        {items.map(item=><li key={item.id}><button ref={item.buttonRef} type="button" className="bis-collection-item" aria-pressed={item.selected} onClick={item.onSelect}>{item.content}</button></li>)}
        {notice&&<li className="bis-item-list-notice">{notice}</li>}
      </ul>}
    </div>
    <div className="bis-actions bis-collection-actions">{actions}<button className="bis-button bis-back" disabled={backDisabled} onClick={onBack}>Back</button></div>
    {overlay}
  </AccountCard>;
}
