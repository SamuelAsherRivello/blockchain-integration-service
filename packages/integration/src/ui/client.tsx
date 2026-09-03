import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBisContext, getControls, type BisContext } from '../core/context';
import './overlay.css';
function CopyRecoveryButton({ context, disabled }: { context: BisContext; disabled: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const [hasCopied, setHasCopied] = useState(false);
  async function copy() {
    const phrase = getControls(context).recovery();
    if (!phrase || disabled || status === 'copying') return;
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(phrase.trim().split(/\s+/).join(' '));
      setHasCopied(true);
      setStatus('copied');
    } catch { setStatus('failed'); }
  }
  return <>
    <button className="bis-button bis-copy-button" disabled={disabled} aria-disabled={disabled || status === 'copying'} onClick={() => void copy()}>
      <span className={`bis-copy-indicator${hasCopied ? ' bis-copy-indicator-checked' : ''}`} aria-hidden="true">{hasCopied ? '✓' : ''}</span>
      <span>Copy to Clipboard</span>
    </button>
    <span className="bis-sr-only" role="status">{status === 'copied' ? 'Copied to clipboard.' : ''}</span>
    {status === 'failed' && <span className="bis-copy-status" role="status">Could not copy. Try again or copy the words manually.</span>}
  </>;
}
export function BisView({ context }: { context: BisContext }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const titleId = useId();
  const descriptionId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = ['loading','creating','saving','resetting','logging-out'].includes(state.phase);
  const logout = ['logout-confirmation','logging-out','logout-error'].includes(state.phase);
  const recovery = state.phase === 'recovery' || state.phase === 'saving';
  useEffect(() => {
    if (state.view === 'account') heading.current?.focus();
    if (state.view === 'account-button') button.current?.focus();
  }, [state.view, state.phase]);
  if (state.view === 'empty') return null;
  const title = logout ? 'Account Log Out' : recovery ? 'Account Recovery' : state.phase === 'creating' ? 'Create Account' : 'Account';
  return <div className={`bis-layer ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <section className="bis-card" role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2>
        <p id={descriptionId} role="status">{state.error ?? (logout ? 'Did you back up your wallet?' : state.phase === 'loading' ? 'Opening your account…' : state.phase === 'resetting' ? 'Resetting your account…' : state.hasProfile ? 'You are now logged in.' : recovery ? 'Save these words privately.' : state.phase === 'creating' ? 'Creating your test account…' : 'You are not logged in.')}</p>
        {logout && <>
          <p className="bis-warning">Your saved account will be cleared from this browser. This cannot be undone here. You will need your saved recovery phrase to restore access.</p>
          <label className="bis-backup-check"><input type="checkbox" checked={state.logoutBackupAcknowledged} disabled={busy} onChange={event => context.setLogoutBackupAcknowledged(event.target.checked)} /><span>I have backed up my wallet</span></label>
        </>}
        {(recovery || state.phase === 'creating') && <p className="bis-warning">Signet test wallet only. Never enter or reuse a recovery phrase from a wallet containing real funds.</p>}
        {recovery && <ol className="bis-recovery" aria-label="Private recovery phrase">{getControls(context).recovery()?.split(' ').map((word,index)=><li key={index}><span aria-hidden="true">{index+1}.</span> {word}</li>)}</ol>}
        {busy && <div className="bis-progress" role="status"><span className="bis-lightning" aria-hidden="true">⚡</span><span>{state.phase === 'logging-out' ? 'Logging out…' : state.phase === 'saving' ? 'Saving account…' : 'Please wait…'}</span></div>}
        <div className="bis-actions">
          {logout ? <button className="bis-button bis-danger" disabled={busy || !state.logoutBackupAcknowledged} onClick={()=>void (state.phase === 'logout-error' ? context.retry() : context.confirmLogout())}>{state.phase === 'logout-error' ? 'Retry' : '⚡ Log Out'}</button> : state.phase === 'error' ? <button className="bis-button bis-primary" onClick={()=>void context.retry()}>Retry</button> : state.hasProfile ? <button className="bis-button" disabled={busy} onClick={()=>context.openLogoutConfirmation()}>⚡ Log Out</button> : recovery ? <><CopyRecoveryButton context={context} disabled={busy} /><button className="bis-button bis-primary" disabled={busy} onClick={()=>void context.continueAccount()}>⚡ Continue</button></> : !busy && <>
            <button className="bis-button bis-primary" onClick={()=>void context.createAccount()}>⚡ Create Account</button>
            <button className="bis-button" disabled>⚡ Restore Account</button>
          </>}
          <button ref={close} className="bis-button" disabled={state.phase === 'resetting' || state.phase === 'logging-out'} onClick={() => context.closeAccount()}>Back</button>
        </div>
      </section>}
  </div>;
}

export function createBisUi(context: BisContext) {
  let root: Root | undefined;
  let host: HTMLElement | undefined;
  const internal = getControls(context);
  return {
    mount(container: HTMLElement) {
      internal.assertAlive();
      if (root) {
        if (host === container) return;
        throw new Error('Unmount BIS UI before changing its container.');
      }
      host = container;
      root = createRoot(container);
      root.render(<BisView context={context} />);
    },
    showAccountButton() { internal.present(); },
    unmount() { root?.unmount(); root = undefined; host = undefined; },
  };
}
export function GameOverlay() {
  const context = useRef<BisContext | null>(null);
  const generation = useRef(0);
  if (!context.current) context.current = createBisContext();
  useEffect(() => {
    const client = context.current!;
    const current = ++generation.current;
    getControls(client).present();
    // StrictMode replays effects; dispose only after a genuine unmount.
    return () => { queueMicrotask(() => { if (generation.current === current) client.dispose(); }); };
  }, []);
  return <BisView context={context.current} />;
}

