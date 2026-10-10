import { useRef, useLayoutEffect, type ReactNode, type Ref, type UIEventHandler } from 'react';
import { AccountDialogShell } from './AccountCard';
import { IconButton } from './IconButton';
import { FormValue } from './FormValue';
import { useClipboardCopy } from './useClipboardCopy';

export type CollectionListItem = Readonly<{ id:string; content:ReactNode; selected?:boolean; onSelect():void; buttonRef?:Ref<HTMLButtonElement> }>;
export type CollectionViewProps = {
  title:string;body:ReactNode;fieldLabel:string;report:string;items:readonly CollectionListItem[];
  notice?:ReactNode;actions?:ReactNode;overlay?:ReactNode;onBack():void;backDisabled?:boolean;loading?:boolean;
  network?:string;
  listLabel:string;onRefresh():void|Promise<void>;refreshDisabled?:boolean;listRef?:Ref<HTMLUListElement>;onScroll?:UIEventHandler<HTMLUListElement>;
};
/** Item List: the same fixed-height list page for assets, contracts and transactions. */
export function CollectionListView(props:CollectionViewProps) { return <CollectionViewFrame {...props} mode="list"/>; }
/**
 * Item List Detail: the shared detail page for an item from any of those lists.
 *
 * Policy for this component:
 * - All instances must use the shared detail shell and shared style.
 * - Instances must not add/remove container DOM inside CollectionDetailView.
 * - Instances must not add instance-level class names or inline style to this container.
 */
export function CollectionDetailView(props:CollectionViewProps) { return <CollectionViewFrame {...props} mode="detail"/>; }
function CollectionViewFrame({title,body,fieldLabel,report,items,notice,actions,overlay,onBack,backDisabled=false,loading=false,network,listLabel,onRefresh,refreshDisabled=false,listRef,onScroll,mode}: CollectionViewProps & {mode:'list'|'detail'}) {
  const heading=useRef<HTMLHeadingElement>(null);
  const copy=useClipboardCopy(()=>report,report);
  useLayoutEffect(()=>{heading.current?.focus();},[title]);
  return <AccountDialogShell network={network} title={title} description={body} headingRef={heading} headingActions={<IconButton className="bis-title-icon" label={`Refresh ${title}`} disabled={loading||refreshDisabled} onClick={()=>void onRefresh()}><span className="bis-refresh-image" aria-hidden="true" /></IconButton>} className={` bis-card-collection ${mode==='list'?'bis-item-list':'bis-item-list-detail'}`}>
    <div className="bis-collection" aria-busy={loading}>
      {mode==='detail' ? <div className="bis-collection-detail">
        <FormValue label={title} aria-label={fieldLabel} value={report} copyable copy={copy} multiline rows={12} />
        {notice}
      </div> : <>
      <FormValue label={title} value={report} copyable copy={copy} aria-label={`${title} raw data preview`} />
      <ul ref={listRef} onScroll={onScroll} className="bis-collection-scroll bis-collection-list" aria-label={listLabel}>
        {items.map(item=><li key={item.id}><button ref={item.buttonRef} type="button" className="bis-collection-item" aria-pressed={item.selected} onClick={item.onSelect}>{item.content}</button></li>)}
        {notice&&<li className="bis-item-list-notice">{notice}</li>}
      </ul></>}
    </div>
    <div className="bis-actions bis-collection-actions">{actions}<button className="bis-button bis-back" disabled={backDisabled} onClick={onBack}>Back</button></div>
    {overlay}
  </AccountDialogShell>;
}
