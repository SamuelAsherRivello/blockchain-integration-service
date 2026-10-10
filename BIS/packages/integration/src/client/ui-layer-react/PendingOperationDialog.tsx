import { useVisibleViewport } from './useVisibleViewport';
import { useFitTextButtons } from './FitTextButton';
import { FormValue } from './FormValue';
import type { BisContext } from '../state-layer-core/context';
import { accountLoadingModalAllowed } from './view-loading';
import { useClipboardCopy } from './useClipboardCopy';
import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

export type BisPendingDiagnostic = Readonly<{code:string;message:string;recoverable:boolean;submitted:boolean;operationId?:string;itemName?:string}>;
type NoticeInfo = {title:string;message:string;confirm?:()=>void};
type Notice = { label: string; host?: true; error?: string; diagnostic?:BisPendingDiagnostic; info?:NoticeInfo; errorAction?: {label:string;run:()=>void}; dismiss(): void };
type Register = (id: string, notice?: Notice) => void;
export type HostLoading = Readonly<{subscribe(listener: () => void): () => void; getSnapshot(): boolean}>;
const PendingContext = createContext<Register | undefined>(undefined);
// Temporary bolt pivot preview: set false to restore normal loading behavior.
const PREVIEW_LOADING_FOREVER = false;
const PENDING_NOTICE_GAP_GRACE_MS = 250;

/** Child layout effects publish before paint, including the initial page render. */
export function usePendingNotice(busy: boolean, label: string, error: string | undefined, dismiss: () => void, info?:NoticeInfo, errorAction?: {label:string;run:()=>void}, diagnostic?:BisPendingDiagnostic) {
  const register = useContext(PendingContext);
  const id = useId();
  const action = useRef(dismiss); action.current = dismiss;
  const confirmation=useRef(info?.confirm);confirmation.current=info?.confirm;
  const infoTitle=info?.title,infoMessage=info?.message,hasConfirmation=!!info?.confirm;
  const errorActionRun=useRef(errorAction?.run);errorActionRun.current=errorAction?.run;
  const errorActionLabel=errorAction?.label;
  useLayoutEffect(() => {
    register?.(id, busy || error || infoTitle ? {label, error: busy ? undefined : error, diagnostic:!busy&&error?diagnostic:undefined, errorAction:!busy&&error&&errorActionLabel?{label:errorActionLabel,run:()=>errorActionRun.current?.()}:undefined, info:!busy&&infoTitle?{title:infoTitle,message:infoMessage!,...(hasConfirmation?{confirm:()=>confirmation.current?.()}:{})}:undefined, dismiss:()=>action.current()} : undefined);
  }, [register, id, busy, label, error,diagnostic,infoTitle,infoMessage,hasConfirmation,errorActionLabel]);
  useLayoutEffect(() => () => register?.(id), [register, id]);
}

/** A host-local modal: document-level showModal would also disable the Admin panel. */
export function PendingOperations({children, overlay, className, hostLoading, onBisVisibilityChange, loadingContext}: {children: ReactNode; overlay?: ReactNode; className?: string; hostLoading?: HostLoading; onBisVisibilityChange?(visible: boolean): void; loadingContext?: BisContext}) {
  const runtime = useVisibleViewport();
  useFitTextButtons(runtime);
  const [notices,setNotices] = useState<Map<string,Notice>>(()=>new Map());
  const loadingState = useSyncExternalStore(loadingContext?.subscribe ?? (() => () => {}), loadingContext?.getState ?? (() => undefined), () => undefined);
  const loadingAllowed = !loadingState || accountLoadingModalAllowed(loadingState);
  const hostPending = useSyncExternalStore(hostLoading?.subscribe ?? (() => () => {}), hostLoading?.getSnapshot ?? (() => false), () => false);
  const register = useCallback<Register>((id,notice)=>setNotices(previous=>{
    if(!notice && !previous.has(id))return previous;
    const next=new Map(previous);if(notice)next.set(id,notice);else next.delete(id);return next;
  }),[]);
  const hostEntry: Notice | undefined = hostPending ? {label:'Loading ...',host:true,dismiss:()=>{}} : undefined;
  const entries: Notice[]=PREVIEW_LOADING_FOREVER
    ? [{label:'Loading ...',dismiss:()=>{}}]
    : [...notices.values(), ...(hostEntry ? [hostEntry] : [])];
  const waiting=entries.filter(entry=>loadingAllowed&&!entry.error&&!entry.info);
  const failure=waiting.length ? undefined : entries.find(entry=>entry.error);
  const pending=waiting.find(entry=>entry.label!=='Loading ...') ?? waiting[0];
  const label=useRef('Loading ...');
  if(pending && (pending.label!=='Loading ...' || !notices.size))label.current=pending.label;
  if(!pending)label.current='Loading ...';
  const active=failure ?? pending ?? entries.find(entry=>entry.info);
  const [retained,setRetained]=useState<{notice:Notice;label:string}|undefined>();
  useLayoutEffect(()=>{
    if(active){setRetained({notice:active,label:label.current});return;}
    const timeout=window.setTimeout(()=>setRetained(undefined),PENDING_NOTICE_GAP_GRACE_MS);
    return ()=>window.clearTimeout(timeout);
  },[active]);
  // A retained spinner must not leak across navigation into a non-modal page.
  const retainedNotice=retained?.notice;
  const current=active ?? (loadingAllowed || retainedNotice?.error || retainedNotice?.info ? retainedNotice : undefined);
  const displayLabel=active ? label.current : retained?.label;
  useLayoutEffect(() => { onBisVisibilityChange?.(Boolean(current && !current.host)); }, [current, onBisVisibilityChange]);
  const content=useRef<HTMLDivElement>(null), dialog=useRef<HTMLDivElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  const open=!!current, failed=!!current?.error;
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
  },[open,failed,current?.info?.title]);
  const title=useId(), description=useId();
  const errorCopy=useClipboardCopy(()=>current?.error, current?.error);
  return <PendingContext.Provider value={register}>
    <div ref={runtime} className={`bis-runtime${className?` ${className}`:''}`}>
      <div ref={content} className="bis-runtime-content" inert={open} aria-hidden={open || undefined} aria-busy={!!pending}>{children}</div>
      {current && <div className="bis-pending-backdrop" onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}
        if(event.key==='Tab'){
          const buttons=[...dialog.current!.querySelectorAll('button')];
          event.preventDefault();
          const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
          (buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length] ?? dialog.current)?.focus();
        }
      }}>
        <div ref={dialog} tabIndex={-1} className="bis-pending-dialog" data-closing={!active && !retained || undefined} role={failed?'alertdialog':'dialog'} aria-label="Pending Operation Dialog" aria-labelledby={title} aria-describedby={failed||current.info?description:undefined}>
          <h2 id={title} aria-live="polite" aria-atomic="true">{failed?'Error':current.info?.title??displayLabel}</h2>
          {failed ? <><div className="bis-pending-error-field">
              <FormValue id={description} className="bis-pending-error-field" label="Message" value={current.error ?? ''} copyable copy={errorCopy} multiline rows={3} disabled={errorCopy.status === 'copying'} />
            </div>{current.diagnostic&&<div className="bis-pending-diagnostic" role="status"><p>Reason: {current.diagnostic.code}</p>{current.diagnostic.itemName&&<p>Item: {current.diagnostic.itemName}</p>}{current.diagnostic.operationId&&<p>Operation: {current.diagnostic.operationId}</p>}<p>{current.diagnostic.submitted?'Reconcile the original operation before retrying.':current.diagnostic.recoverable?'Refresh and retry when the wallet is ready.':'No network submission was made.'}</p></div>}<button className="bis-button" onClick={()=>current.errorAction?.run() ?? current.dismiss()}>{current.errorAction?.label ?? 'OK'}</button></>
            : current.info ? <><p id={description}>{current.info.message}</p>{current.info.confirm ? <div className="bis-actions"><button className="bis-button bis-primary" onClick={current.info.confirm}>Yes</button><button className="bis-button" onClick={current.dismiss}>Cancel</button></div> : <button className="bis-button" onClick={current.dismiss}>OK</button>}</>
            : <span className="bis-bolt bis-bolt-spin bis-lightning" aria-hidden="true">⚡</span>}
        </div>
      </div>}
      {overlay}
    </div>
  </PendingContext.Provider>;
}
