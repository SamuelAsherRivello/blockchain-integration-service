import { useEffect, useId, useRef, useState } from 'react';
import { getControls, type BisContext, type BisState } from '../core/context';
import { phraseWords, RECOVERY_WORD_COUNT, validRecovery, wordValidity } from '../core/recovery-validation';

export function RestoreAccount({ context, phase }: { context: BisContext; phase: BisState['phase'] }) {
  const [words, setWords] = useState<string[]>(() => Array(RECOVERY_WORD_COUNT).fill(''));
  const [show, setShow] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [pasting, setPasting] = useState(false);
  const revision = useRef(0);
  const alive = useRef(true);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const id = useId();
  const editable = phase === 'restore-entry';
  const busy = phase === 'restoring' || phase === 'restore-saving';
  const valid = words.every(word => wordValidity(word) === 'valid') && validRecovery(words.join(' '));
  const checksumError = words.every(word => wordValidity(word) === 'valid') && !valid;
  useEffect(() => {
    alive.current=true;
    return () => {alive.current=false;revision.current++;};
  }, []);
  useEffect(() => { if(phase !== 'restore-entry') {setShow(false);revision.current++;setPasting(false);} }, [phase]);
  function edit(index: number, value: string) {
    revision.current++;setPasting(false);setPasteError('');
    const parts=value.trim() ? phraseWords(value) : [''];
    if(parts.length>RECOVERY_WORD_COUNT-index) {
      setPasteError(`Only ${RECOVERY_WORD_COUNT-index} word fields remain from this position. Your existing words were not changed.`);
      return;
    }
    setWords(current => current.map((word,position) => position>=index&&position<index+parts.length ? parts[position-index] : word));
    const advance=/\s$/.test(value)&&!!value.trim();
    if(parts.length>1||advance) {
      const target=Math.min(index+parts.length-(advance?0:1),RECOVERY_WORD_COUNT-1);
      const field=inputs.current[target];
      field?.focus();
      if(advance)field?.select();
    }
  }
  async function paste() {
    if(!editable||pasting)return;
    setShow(false);setPasteError('');setPasting(true);
    const current=++revision.current;
    try {
      const input=await navigator.clipboard.readText();
      if(!alive.current||revision.current!==current)return;
      const next=phraseWords(input);
      if(next.length!==RECOVERY_WORD_COUNT) setPasteError('Enter a 12-word recovery phrase. Your existing words were not changed.');
      else setWords(next);
    } catch {if(alive.current&&revision.current===current)setPasteError('Could not read the clipboard. Try again or type the words manually.');}
    finally {if(alive.current&&revision.current===current)setPasting(false);}
  }
  return <>
    <p className="bis-warning">Test wallet only. Never enter or reuse a recovery phrase from a wallet containing real funds.</p>
    <div className="bis-copy-field-heading bis-recovery-heading">
      <h3>Seed words</h3>
      <button type="button" className="bis-copy-icon" aria-label="Paste from Clipboard" title={pasting?'Reading clipboard…':'Paste from Clipboard'} disabled={!editable||pasting} onClick={()=>void paste()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M12 10v8m-3-3 3 3 3-3" />
        </svg>
      </button>
      <button type="button" className="bis-copy-icon bis-visibility-toggle" aria-label={show?'Hide seed words':'Show seed words'} title={show?'Hide seed words':'Show seed words'} aria-pressed={show} disabled={busy||pasting} onClick={()=>setShow(current=>!current)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 9s3 6 9 6 9-6 9-6M5 12l-2 3m5-1-1 4m5-3v4m4-5 1 4m2-6 2 3" /></>}
        </svg>
      </button>
      <span className="bis-sr-only" role="status">{pasting?'Reading clipboard…':''}</span>
    </div>
    <div className="bis-restore-grid" role="group" aria-label="Private recovery phrase">
      {words.map((word,index) => {
        const validity=wordValidity(word);
        return <div className={`bis-word bis-word-${validity}`} key={index} onClick={event=>event.currentTarget.querySelector('input')?.focus()}>
          <label htmlFor={`${id}-${index}`} className="bis-word-number"><span aria-hidden="true">{index+1}.</span><span className="bis-sr-only">Word {index+1}</span></label>
          <div className={`bis-word-input${show?'':' bis-word-hidden'}`}>
            <input ref={element=>{inputs.current[index]=element;}} id={`${id}-${index}`} type={show?'text':'password'} value={word} disabled={!editable}
              autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-label={`Word ${index+1}`} aria-describedby={`${id}-validity-${index}`} aria-invalid={validity==='invalid'}
              onChange={event=>edit(index,event.target.value)}
              onPaste={event=>{const text=event.clipboardData.getData('text');if(phraseWords(text).length>1){event.preventDefault();edit(index,text);}}} />
            {!show && <span className="bis-word-mask" aria-hidden="true">{'*'.repeat(word.length)}</span>}
          </div>
          <span className="bis-word-indicator" aria-hidden="true">{validity==='valid'?'✓':validity==='invalid'?'×':'·'}</span>
          <span id={`${id}-validity-${index}`} className="bis-sr-only">{validity==='empty'?'Empty':validity==='valid'?'Valid BIP39 word':'Invalid BIP39 word'}</span>
        </div>;
      })}
    </div>
    {checksumError && <p role="alert">These words do not form a valid recovery phrase.</p>}
    {pasteError && <p role="alert">{pasteError}</p>}
    <div className="bis-actions">
      <button className="bis-button bis-primary" disabled={busy||pasting||!valid} onClick={()=>{revision.current++;setShow(false);void (phase==='restore-error'?context.retry():getControls(context).restore(words.join(' ')));}}>{phase==='restore-error'?'Retry':'⚡ Restore'}</button>
      <button className="bis-button" disabled={phase==='restore-saving'} onClick={()=>context.closeAccount()}>Back</button>
    </div>
  </>;
}
