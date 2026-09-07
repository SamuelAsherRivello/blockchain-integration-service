import { useLayoutEffect, useId, useRef } from 'react';

/** Native modal focus containment, Escape cancellation and focus restoration. */
export function ConfirmationDialog({onConfirm,onCancel}: {onConfirm:()=>void;onCancel:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null), cancel=useRef<HTMLButtonElement>(null), title=useId(), body=useId(), answered=useRef(false);
  useLayoutEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const dialog=ref.current!, layer=dialog.closest('.bis-layer');
    const position=()=>{
      if(!layer)return;
      const rect=layer.getBoundingClientRect();
      dialog.style.left=`${rect.left+rect.width/2}px`;dialog.style.top=`${rect.top+rect.height/2}px`;
      dialog.style.width=`${Math.max(0,Math.min(280,rect.width-32))}px`;
    };
    position();dialog.showModal();cancel.current?.focus();
    const observer=new ResizeObserver(position);if(layer)observer.observe(layer);
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    return ()=>{observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);dialog.close();if(previous?.isConnected)previous.focus();};
  },[]);
  function answer(confirm:boolean) {
    if(answered.current)return;answered.current=true;
    ref.current?.close();if(confirm)onConfirm();else onCancel();
  }
  return <dialog ref={ref} className="bis-confirmation" aria-labelledby={title} aria-describedby={body} onCancel={event=>{event.preventDefault();answer(false);}}>
    <h2 id={title}>Confirmation</h2><p id={body}>Are you sure?</p>
    <div className="bis-confirmation-actions"><button className="bis-button" onClick={()=>answer(true)}>OK</button><button ref={cancel} className="bis-button" onClick={()=>answer(false)}>Cancel</button></div>
  </dialog>;
}
