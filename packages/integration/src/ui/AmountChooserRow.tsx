import {useId, type Ref} from 'react';

export function AmountChooserRow({value,onChange,onMax,disabled=false,maxDisabled=false,inputRef,describedBy}:{value:string;onChange(value:string):void;onMax():void;disabled?:boolean;maxDisabled?:boolean;inputRef?:Ref<HTMLInputElement>;describedBy?:string}) {
 const id=useId(),numeric=Number(value),safe=Number.isSafeInteger(numeric);
 const adjust=(step:number)=>onChange(String(Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,(safe?numeric:0)+step))));
 return <div className="bis-amount-chooser">
  <label htmlFor={id}>Amount (sats)</label>
  <div className="bis-transfer-amount">
   <button type="button" className="bis-button" aria-label="Decrease amount" disabled={disabled||!safe||numeric<=0} onClick={()=>adjust(-1)}>−</button>
   <input ref={inputRef} id={id} aria-label="Amount (sats)" aria-describedby={describedBy} inputMode="numeric" autoComplete="off" disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}/>
   <button type="button" className="bis-button" aria-label="Increase amount" disabled={disabled||!safe||numeric>=Number.MAX_SAFE_INTEGER} onClick={()=>adjust(1)}>+</button>
   <button type="button" className="bis-button" disabled={disabled||maxDisabled} onClick={onMax}>Max</button>
  </div>
 </div>;
}
