import type { ReactNode } from 'react';
export type StatusType = 'info'|'success'|'warning'|'error';
export function StatusTypeIcon({type, className='bis-status-type-icon'}:{type:StatusType;className?:string}) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type==='info'&&<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>}
    {type==='warning'&&<><path d="M12 3 22 21H2L12 3Z"/><path d="M12 9v5M12 18h.01"/></>}
    {type==='error'&&<><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></>}
    {type==='success'&&<path d="m4 12 5 5L20 6"/>}
  </svg>;
}
export type CompactField = Readonly<{icon:string; label:string; value:ReactNode; title?:string}>;
export function CompactItemRow({leading, status, fields}:{leading:ReactNode;status:StatusType;fields:readonly CompactField[]}) {
  return <div className="bis-compact-row" data-message-type={status}>
    <span className="bis-compact-leading">{leading}</span>
    <div className="bis-compact-fields">{fields.slice(0,6).map((field,index)=><span className="bis-compact-field" key={field.label+'-'+index} title={field.title ?? field.value?.toString()}><span className="bis-compact-field-icon" aria-hidden="true">{field.icon}</span><span className="bis-compact-field-value"><span className="bis-sr-only">{field.label}: </span>{field.value}</span></span>)}</div>
  </div>;
}
