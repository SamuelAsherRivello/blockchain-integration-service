import { AccountBalances } from './AccountBalances';
import { AccountTransfer } from './AccountTransfer';
import { AccountActivity } from './AccountActivity.tsx';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBisContext, getControls, type BisContext } from '../core/context';
import './overlay.css';
import { RestoreAccount } from './RestoreAccount';
import { AccountAddresses } from './AccountAddresses';
import { CopyFieldLabel } from './CopyFieldLabel';
function CopyRecoveryButton({ context, disabled, label = 'Copy to Clipboard', inline = false }: { context: BisContext; disabled: boolean; label?: string; inline?: boolean }) {
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
    {inline ? <CopyFieldLabel label="Seed words" copied={hasCopied} disabled={disabled} onCopy={() => void copy()} /> : <button className="bis-button bis-copy-button" disabled={disabled} aria-disabled={disabled || status === 'copying'} onClick={() => void copy()}>
      <span className={`bis-copy-indicator${hasCopied ? ' bis-copy-indicator-checked' : ''}`} aria-hidden="true">{hasCopied ? '✓' : ''}</span>
      <span>{label}</span>
    </button>}
    <span className="bis-sr-only" role="status">{status === 'copied' ? 'Copied to clipboard.' : ''}</span>
    {status === 'failed' && <span className="bis-copy-status" role="status">Could not copy. Try again or copy the words manually.</span>}
  </>;
}
export function BisView({ context }: { context: BisContext }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const [showSavedRecovery, setShowSavedRecovery] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  useEffect(() => () => getControls(context).hideRecovery(), [context]);
  useEffect(() => {
    setShowSavedRecovery(false);
    if (state.accountRecovery) void getControls(context).revealRecovery();
  }, [context, state.accountRecovery]);
  const titleId = useId();
  const descriptionId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = ['loading','creating','saving','resetting','logging-out','restoring','restore-saving'].includes(state.phase);
  const restoring = ['restore-entry','restoring','restore-saving','restore-error'].includes(state.phase);
  const savedRecovery = state.accountRecovery;
  const logout = !savedRecovery && ['logout-confirmation','logging-out','logout-error'].includes(state.phase);
  const transfer = state.phase === 'active' && state.accountTransfer;
  const details = state.phase === 'active' && state.accountDetails;
  const activity = state.phase === 'active' && state.accountActivity;
  const receive = state.phase === 'active' && state.accountReceive;
  const send = state.phase === 'active' && state.accountSend;
  const menu = state.phase === 'active' && !details && !transfer && !activity && !savedRecovery && !receive && !send;
  const recovery = state.phase === 'recovery' || state.phase === 'saving';
  useEffect(() => {
    if (state.view === 'account') heading.current?.focus();
    if (state.view === 'account-button') button.current?.focus();
  }, [state.view, state.phase, state.accountDetails, state.accountTransfer, state.accountActivity, state.accountRecovery, state.accountReceive, state.accountSend]);
  if (state.view === 'empty') return null;
  const title = transfer ? 'Account Transfer' : send ? 'Send' : receive ? 'Receive' : savedRecovery ? 'Recovery Phrase' : activity ? 'Account Activity' : details ? 'Account Details' : restoring ? 'Restore Account' : logout ? 'Account Log Out' : recovery ? 'Account Recovery' : state.phase === 'creating' ? 'Create Account' : 'Account';
  return <div className={`bis-layer ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <section className={`bis-card${activity ? ' bis-card-activity' : ''}`} role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="bis-network-label">Network: Signet</div>
        <div className="bis-dialog-heading">
          <h2 ref={heading} tabIndex={-1} id={titleId}>{activity && transactionOpen ? 'Transaction Detail' : title}</h2>
          {(details || transfer || activity || receive) && <button type="button" className="bis-copy-icon bis-title-icon" aria-label={`Refresh ${title}`} title={`Refresh ${title}`} disabled={receive ? state.addresses.status === 'idle' || state.addresses.status === 'loading' : activity ? state.activity.status === 'idle' || state.activity.status === 'loading' : state.balance.status === 'loading' || state.balance.status === 'idle'} onClick={()=>void (activity ? context.refreshActivity() : context.refreshBalance())}>
            <span className="bis-refresh-image" aria-hidden="true" />
          </button>}
        </div>
        <p id={descriptionId} role="status">{state.error ?? (send ? 'Coming soon.' : receive ? 'Use these addresses to receive test funds only.' : savedRecovery ? 'Anyone with this phrase can access your account.' : restoring ? 'Enter the recovery words saved from this experience.' : logout ? 'Did you back up your wallet?' : state.phase === 'loading' ? 'Opening your account…' : state.phase === 'resetting' ? 'Resetting your account…' : state.hasProfile ? (details || transfer || activity ? <>Account ID: <code>{state.profileId ? state.profileId.slice(0, 4) + '…' + state.profileId.slice(-4) : ''}</code></> : 'You are logged in.') : recovery ? 'Save these words privately.' : state.phase === 'creating' ? 'Creating your test account…' : 'You are not logged in.')}</p>
        {activity && <AccountActivity key={state.profileId} activity={state.activity} onDetailChange={setTransactionOpen} />}
        {details && <AccountBalances balance={state.balance} />}
        {transfer && <AccountTransfer context={context} key={state.profileId} balance={state.balance} onBack={() => context.closeAccount()} />}
        {receive && <AccountAddresses addresses={state.addresses} />}
        {logout && <>
          <p className="bis-warning">Your saved account will be cleared from this browser. This cannot be undone here. You will need your saved recovery phrase to restore access.</p>
          <label className="bis-backup-check"><input type="checkbox" checked={state.logoutBackupAcknowledged} disabled={busy} onChange={event => context.setLogoutBackupAcknowledged(event.target.checked)} /><span>I have backed up my wallet</span></label>
        </>}
        {(savedRecovery || recovery || state.phase === 'creating') && <p className="bis-warning">Test wallet only. Never enter or reuse a recovery phrase from a wallet containing real funds.</p>}
        {recovery && <div className="bis-recovery-heading"><CopyRecoveryButton context={context} disabled={busy} inline /></div>}
        {savedRecovery && state.recoveryStatus === 'ready' && <div className="bis-saved-recovery-heading bis-recovery-heading">
          <CopyRecoveryButton context={context} disabled={false} inline />
          <button type="button" className="bis-copy-icon bis-visibility-toggle" aria-label={showSavedRecovery?'Hide seed words':'Show seed words'} title={showSavedRecovery?'Hide seed words':'Show seed words'} aria-pressed={showSavedRecovery} onClick={()=>setShowSavedRecovery(current=>!current)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {showSavedRecovery ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 9s3 6 9 6 9-6 9-6M5 12l-2 3m5-1-1 4m5-3v4m4-5 1 4m2-6 2 3" /></>}
            </svg>
          </button>
        </div>}
        {(recovery || (savedRecovery && state.recoveryStatus === 'ready')) && <ol className="bis-recovery" aria-label="Private recovery phrase">{getControls(context).recovery()?.trim().split(/\s+/).map((word,index)=><li key={index}><span aria-hidden="true">{index+1}.</span> <span className="bis-recovery-word">{savedRecovery && !showSavedRecovery ? '*'.repeat(word.length) : word}</span></li>)}</ol>}
        {savedRecovery && state.recoveryStatus === 'unavailable' && <p role="status">Your recovery phrase could not be opened. Try again.</p>}
        {busy && <div className="bis-progress" role="status"><span className="bis-lightning" aria-hidden="true">⚡</span><span>{state.phase === 'logging-out' ? 'Logging out…' : state.phase === 'saving' ? 'Saving account…' : 'Please wait…'}</span></div>}
        {transfer ? null : restoring ? <RestoreAccount context={context} phase={state.phase} /> : <div className="bis-actions">
          {menu && <button className="bis-button" onClick={()=>context.openAccountDetails()}>Account Details</button>}
          {menu && <button className="bis-button" onClick={()=>context.openAccountActivity()}>Account Activity</button>}
          {details && <button className="bis-button" onClick={()=>context.openAccountTransfer()}>Bitcoin ↔ Arkade</button>}
          {details && <button className="bis-button" onClick={()=>context.openAccountRecovery()}>Recovery Phrase</button>}
          {menu && <div className="bis-transfer-actions"><button className="bis-button" onClick={()=>context.openAccountSend()}>⚡ Send</button><button className="bis-button" onClick={()=>context.openAccountReceive()}>⚡ Receive</button></div>}
{savedRecovery ? (state.recoveryStatus === 'unavailable' ? <button className="bis-button" onClick={()=>void getControls(context).revealRecovery()}>Retry</button> : null) : details || activity || receive || send ? null : logout ? <button className="bis-button bis-danger" disabled={busy || !state.logoutBackupAcknowledged} onClick={()=>void (state.phase === 'logout-error' ? context.retry() : context.confirmLogout())}>{state.phase === 'logout-error' ? 'Retry' : 'Log Out'}</button> : state.phase === 'error' ? <button className="bis-button bis-primary" onClick={()=>void context.retry()}>Retry</button> : state.hasProfile ? <button className="bis-button" disabled={busy} onClick={()=>context.openLogoutConfirmation()}>Log Out</button> : recovery ? <><button className="bis-button bis-primary" disabled={busy} onClick={()=>void context.continueAccount()}>⚡ Continue</button></> : !busy && <>
            <button className="bis-button bis-primary" onClick={()=>void context.createAccount()}>⚡ Create Account</button>
            <button className="bis-button" onClick={()=>context.openRestoreAccount()}>⚡ Restore Account</button>
          </>}
          {!(activity && transactionOpen) && <button ref={close} className="bis-button" disabled={state.phase === 'resetting' || state.phase === 'logging-out'} onClick={() => context.closeAccount()}>Back</button>}
        </div>}
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



