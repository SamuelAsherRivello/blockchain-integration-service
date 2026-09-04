import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Notice = { label: string; error?: string; dismiss(): void };
type Register = (id: string, notice?: Notice) => void;
const PendingContext = createContext<Register | undefined>(undefined);

/** Child layout effects publish before paint, including the initial page render. */
export function usePendingNotice(busy: boolean, label: string, error: string | undefined, dismiss: () => void) {
  const register = useContext(PendingContext);
  const id = useId();
  const action = useRef(dismiss); action.current = dismiss;
  useLayoutEffect(() => {
    register?.(id, busy || error ? {label, error: busy ? undefined : error, dismiss:()=>action.current()} : undefined);
    return () => register?.(id);
  }, [register, id, busy, label, error]);
}

/** A host-local modal: document-level showModal would also disable the Admin panel. */
export function PendingOperations({children}: {children: ReactNode}) {
  const [notices,setNotices] = useState<Map<string,Notice>>(()=>new Map());
  const register = useCallback<Register>((id,notice)=>setNotices(previous=>{
    if(!notice && !previous.has(id))return previous;
    const next=new Map(previous);if(notice)next.set(id,notice);else next.delete(id);return next;
  }),[]);
  const entries=[...notices.values()];
  const waiting=entries.filter(entry=>!entry.error);
  const failure=waiting.length ? undefined : entries.find(entry=>entry.error);
  const pending=waiting.find(entry=>entry.label!=='Loading...') ?? waiting[0];
  const label=useRef('Loading...');
  if(pending && (pending.label!=='Loading...' || !notices.size))label.current=pending.label;
  if(!pending)label.current='Loading...';
  const current=failure ?? pending;
  const content=useRef<HTMLDivElement>(null), dialog=useRef<HTMLDivElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  const open=!!current, failed=!!failure;
  useLayoutEffect(()=>{
    if(!open)return;
    previousFocus.current=document.activeElement as HTMLElement|null;
    return ()=>{
      const previous=previousFocus.current;
      const destination=content.current?.querySelector<HTMLElement>('[data-bis-autofocus]');
      if(destination)destination.focus({preventScroll:true});
      else if(previous?.isConnected && !previous.closest('[inert]'))previous.focus({preventScroll:true});
      else content.current?.querySelector<HTMLElement>('h2, button')?.focus({preventScroll:true});
    };
  },[open]);
  useLayoutEffect(()=>{
    if(open)(dialog.current?.querySelector('button') ?? dialog.current)?.focus({preventScroll:true});
  },[open,failed]);
  const title=useId(), description=useId();
  return <PendingContext.Provider value={register}>
    <div className="bis-runtime">
      <div ref={content} className="bis-runtime-content" inert={open} aria-hidden={open || undefined} aria-busy={!!pending}>{children}</div>
      {current && <div className="bis-pending-backdrop" onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}
        if(event.key==='Tab'){
          event.preventDefault();(dialog.current?.querySelector('button') ?? dialog.current)?.focus();
        }
      }}>
        <div ref={dialog} tabIndex={-1} className="bis-pending-dialog" role={failed?'alertdialog':'dialog'} aria-label="Pending Operation Dialog" aria-labelledby={title} aria-describedby={failed?description:undefined}>
          <h2 id={title} aria-live="polite" aria-atomic="true">{failed?'Operation unavailable':label.current}</h2>
          {failed ? <><p id={description}>{failure.error}</p><button className="bis-button" onClick={()=>failure.dismiss()}>OK</button></>
            : <span className="bis-lightning" aria-hidden="true">⚡</span>}
        </div>
      </div>}
    </div>
  </PendingContext.Provider>;
}
