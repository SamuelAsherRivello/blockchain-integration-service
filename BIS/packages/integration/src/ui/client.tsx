import { PendingOperations, usePendingNotice } from './PendingOperationDialog';
import { ToastViewport } from './ToastViewport';
import { AccountAssets } from './AccountAssets';
import { AccountContracts } from './AccountContracts';
import { AccountBalances } from './AccountBalances';
import { AccountSend } from './AccountSend';
import { AccountTransfer } from './AccountTransfer';
import { AccountActivity } from './AccountActivity.tsx';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBisContext, getControls, type BisContext } from '../core/context';
import './overlay.css';
import { RestoreAccount } from './RestoreAccount';
import { AccountAddresses } from './AccountAddresses';
import { AccountCard } from './AccountCard';
import { AccountIdentity } from './AccountIdentity';
import { FitTextButton } from './FitTextButton';
import { IconButton } from './IconButton';
import { RecoveryPhrasePanel, TestWalletWarning } from './RecoveryPhrasePanel';
export function BisView({ context }: { context: BisContext }) {
  return <PendingOperations overlay={<ToastViewport context={context} />}><BisScreen context={context} /></PendingOperations>;
}
function BisScreen({ context }: { context: BisContext }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const menuSession = useMemo(() => ({}), [context, state.profileId, state.view, state.phase]);
  const [detailsMenuSession, setDetailsMenuSession] = useState<object>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const mountGeneration = useRef(0);
  const mountedContext = useRef(context);
  mountedContext.current = context;
  useEffect(() => {
    const current = ++mountGeneration.current;
    return () => {
      const controls = getControls(context), session = controls.assetSession();
      queueMicrotask(() => { if (mountGeneration.current === current || mountedContext.current !== context) controls.hideAssets(session); });
    };
  }, [context]);
  useEffect(() => () => getControls(context).hideRecovery(), [context]);
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
  const assets = state.phase === 'active' && state.accountAssets;
  const contracts = state.phase === 'active' && !!state.accountContracts;
  const [contractOpen,setContractOpen]=useState(false);
  const receive = state.phase === 'active' && state.accountReceive;
  const send = state.phase === 'active' && state.accountSend;
  const menu = state.phase === 'active' && !details && !transfer && !activity && !assets && !contracts && !savedRecovery && !receive && !send;
  const submenu = menu && detailsMenuSession === menuSession;
  const recovery = state.phase === 'recovery' || state.phase === 'saving';
  const recoverySession = useMemo(() => ({}), [context, recovery, savedRecovery, state.profileId]);
  useEffect(() => {
    if (state.accountRecovery) void getControls(context).revealRecovery();
  }, [context, state.accountRecovery]);
  useEffect(() => {
    if (state.view === 'account') heading.current?.focus();
    if (state.view === 'account-button') button.current?.focus();
  }, [state.view, state.phase, state.accountDetails, state.accountTransfer, state.accountActivity, state.accountAssets, assetOpen, state.accountRecovery, state.accountReceive, state.accountSend, submenu]);
  const data = assets ? state.assets : activity ? state.activity : receive ? state.addresses : details || transfer ? state.balance : undefined;
  const phaseLabels: Record<string,string> = {loading:'Loading...',creating:'Creating...',saving:'Saving...',resetting:'Resetting...', 'logging-out':'Logging out...', restoring:'Restoring...', 'restore-saving':'Saving...'};
  const pageLoading = !!data && (data.status === 'idle' || data.status === 'loading');
  const recoveryLoading = savedRecovery && (state.recoveryStatus === 'hidden' || state.recoveryStatus === 'loading');
  const failure = state.error || (!assets && !activity && data?.status === 'unavailable' ? `${assets?'Assets':activity?'Transactions':receive?'Receiving addresses':'Balances'} could not be loaded.` : savedRecovery && state.recoveryStatus === 'unavailable' ? 'Recovery phrase could not be loaded.' : undefined);
  usePendingNotice(state.view !== 'empty' && (busy || (!assets && pageLoading) || recoveryLoading), phaseLabels[state.phase] ?? 'Loading...', state.view !== 'empty' ? failure : undefined, () => getControls(context).dismissOperationError());
  if (state.view === 'empty') return null;
  if (state.view === 'account' && (assets || contracts || activity)) return <div className="bis-layer bis-layer-open bis-layer-collection">
    {assets && <AccountAssets key={state.profileId} assets={state.assets} onBurn={context.burnAsset} onToast={context.showToast} onRefresh={context.refreshAssets} onBusyChange={setAssetBusy} onDetailChange={setAssetOpen} onBack={()=>context.closeAccount()} />}
    {contracts && <AccountContracts key={state.profileId} context={context} onDetailChange={setContractOpen} />}
    {activity && <AccountActivity key={state.profileId} activity={state.activity} context={context} onDetailChange={setTransactionOpen} />}
  </div>;
  const title = assets ? (assetOpen ? 'Asset Detail' : 'Assets') : transfer ? 'Account Transfer' : send ? 'Send' : receive ? 'Receive' : savedRecovery ? 'Get Recovery Phrase' : activity ? 'Transactions' : details ? 'Balance' : restoring ? 'Restore Account' : logout ? 'Account Log Out' : recovery ? 'Set Recovery Phrase' : state.phase === 'creating' ? 'Create Account' : submenu ? 'Accounts Details' : 'Account';
  return <div className={`bis-layer ${assets ? 'bis-layer-assets' : ''} ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <AccountCard className={assets ? ` bis-card-assets${assetOpen ? ' bis-card-asset-detail' : ''}` : activity ? ' bis-card-activity' : ''}
        title={contracts ? contractOpen?'Contract Details':'Contracts' : activity && transactionOpen ? 'Transaction Detail' : title} headingRef={heading}
        headingActions={(assets || details || transfer || activity || receive) && <IconButton className="bis-title-icon" label={`Refresh ${title}`} disabled={assets ? assetBusy || state.assets.status === 'idle' || state.assets.status === 'loading' : receive ? state.addresses.status === 'idle' || state.addresses.status === 'loading' : activity ? state.activity.status === 'idle' || state.activity.status === 'loading' : state.balance.status === 'loading' || state.balance.status === 'idle'} onClick={()=>void (assets ? context.refreshAssets() : activity ? context.refreshActivity() : context.refreshBalance())}>
            <span className="bis-refresh-image" aria-hidden="true" />
          </IconButton>}
        description={(send ? 'Send Signet test funds to another Arkade address.' : receive ? 'Use these addresses to receive test funds only.' : savedRecovery ? 'Anyone with this phrase can access your account.' : restoring ? 'Enter the recovery words saved from this experience.' : logout ? 'Back up your recovery phrase. Logout removes your saved wallet access and local transaction records. Submitted transactions are not cancelled.' : state.hasProfile ? (assets || details || transfer || activity || submenu ? null : <>You are logged in.<br />This account has access to Bitcoin Lightning.</>) : recovery ? 'Save these words privately.' : 'You are not logged in.')}>
        {submenu && <AccountIdentity profileId={state.profileId} />}
        {details && <AccountBalances balance={state.balance} />}
        {transfer && <AccountTransfer context={context} key={state.profileId} balance={state.balance} onBack={() => context.closeAccount()} />}
        {receive && <AccountAddresses addresses={state.addresses} />}
        {send && <AccountSend context={context} key={state.profileId} />}
        {logout && <>
          <label className="bis-backup-check"><input type="checkbox" checked={state.logoutBackupAcknowledged} disabled={busy} onChange={event => context.setLogoutBackupAcknowledged(event.target.checked)} /><span>I have backed up my wallet</span></label>
          {state.logoutPendingCount !== null && state.logoutPendingCount > 0 && <>
            <label className="bis-backup-check"><input type="checkbox" checked={state.logoutPendingAcknowledged} disabled={busy} onChange={event => context.setLogoutPendingAcknowledged(event.target.checked)} /><span>I accept losing my ({state.logoutPendingCount}) pending transactions.</span></label>
          </>}
        </>}
        {(savedRecovery || recovery || state.phase === 'creating') && <TestWalletWarning />}
        {(recovery || (savedRecovery && state.recoveryStatus === 'ready')) && <RecoveryPhrasePanel key={savedRecovery ? 'saved' : 'setup'} phrase={getControls(context).recovery()} session={recoverySession} disabled={busy} />}
        {assets || contracts || transfer || send ? null : restoring ? <RestoreAccount context={context} phase={state.phase} /> : <div className="bis-actions">
          {menu && !submenu && <button className="bis-button" onClick={() => setDetailsMenuSession(menuSession)}>Accounts Details</button>}
          {submenu && <button className="bis-button" onClick={()=>context.openAccountDetails()}>Balance</button>}
          {submenu && <div className="bis-account-collections">
            <button className="bis-button" onClick={()=>context.openAccountAssets()}>Assets</button>
            <button className="bis-button" onClick={()=>context.openAccountContracts?.()}>Contracts</button>
            <button className="bis-button" title="Transaction" onClick={()=>context.openAccountActivity()}>Transaction</button>
          </div>}
          {details && <button className="bis-button" onClick={()=>context.openAccountRecovery()}>Get Recovery Phrase</button>}
          {menu && !submenu && <div className="bis-transfer-actions"><FitTextButton onClick={()=>context.openAccountSend()}>⚡ Send</FitTextButton><FitTextButton onClick={()=>context.openAccountReceive()}>⚡ Receive</FitTextButton><FitTextButton onClick={()=>context.openAccountTransfer()}>⚡ Swap</FitTextButton></div>}
{savedRecovery ? (state.recoveryStatus === 'unavailable' ? <button className="bis-button" onClick={()=>void getControls(context).revealRecovery()}>Retry</button> : null) : submenu || details || activity || receive || send ? null : logout ? <button className="bis-button bis-danger" disabled={busy || !state.logoutBackupAcknowledged || (state.logoutPendingCount !== null && state.logoutPendingCount > 0 && !state.logoutPendingAcknowledged)} onClick={()=>void (state.phase === 'logout-error' ? context.retry() : context.confirmLogout())}>{state.phase === 'logout-error' ? 'Retry' : 'Log Out'}</button> : state.phase === 'error' ? <button className="bis-button bis-primary" onClick={()=>void context.retry()}>Retry</button> : state.hasProfile ? <button className="bis-button" disabled={busy} onClick={()=>context.openLogoutConfirmation()}>Log Out</button> : recovery ? <><button className="bis-button bis-primary" disabled={busy} onClick={()=>void context.continueAccount()}>⚡ Continue</button></> : !busy && <>
            <button className="bis-button bis-primary" onClick={()=>void context.createAccount()}>⚡ Create Account</button>
            <button className="bis-button" onClick={()=>context.openRestoreAccount()}>⚡ Restore Account</button>
          </>}
          {!(activity && transactionOpen) && <button ref={close} className="bis-button bis-back" disabled={state.phase === 'resetting' || state.phase === 'logging-out'} onClick={() => submenu ? setDetailsMenuSession(undefined) : context.closeAccount()}>Back</button>}
        </div>}
      </AccountCard>}
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
    unmount() { internal.toasts.clear(); internal.hideAssets(); root?.unmount(); root = undefined; host = undefined; },
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
