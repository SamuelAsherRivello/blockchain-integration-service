import {AccountOnboarding,onboardingLabel} from './AccountOnboarding';
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
import { FieldHeading } from './FieldHeading';
import { FitTextButton } from './FitTextButton';
import { IconButton } from './IconButton';
import { RecoveryPhrasePanel, TestWalletWarning } from './RecoveryPhrasePanel';
import { GameWalletLogin } from './GameWalletLogin';
import { createBisGameWallet } from '../core/game-wallet';
import { createBisEquipment } from '../core/equipment-loadout';
import { networkLabel } from '../core/test-network';
type GameWallet = ReturnType<typeof createBisGameWallet>;

const networkOptions = [
  { value: 'signet' as const, label: 'Signet' },
  { value: 'mutinynet' as const, label: 'Mutiny' },
];

function NetworkSelect({ value, onChange }: { value: 'signet' | 'mutinynet' | undefined; onChange(network: 'signet' | 'mutinynet'): void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = networkOptions.find(option => option.value === value);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);
  return <div className="bis-network-select" ref={root}>
    <button ref={trigger} id="bis-network" className="bis-network-select-trigger" type="button" aria-label="Network" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(wasOpen => !wasOpen)} onKeyDown={event => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); }
    }}>
      <span>{selected?.label ?? 'Choose network'}</span><svg className="bis-network-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 5 5 5 5-5" /></svg>
    </button>
    {open && <div className="bis-network-menu" role="menu" aria-label="Network options">
      {networkOptions.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} className={`bis-network-option${option.value === value ? ' bis-network-option-selected' : ''}`} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>{option.label}</button>)}
    </div>}
  </div>;
}

export function BisView({ context, gameWallet, onDeveloperDialogChange, onGameWalletDialogChange }: { context: BisContext; gameWallet?: GameWallet; onDeveloperDialogChange?(open: (() => void) | undefined): void;onGameWalletDialogChange?(open:(()=>void)|undefined):void }) {
  return <PendingOperations overlay={<ToastViewport context={context} />}><BisScreen context={context} gameWallet={gameWallet} onDeveloperDialogChange={onDeveloperDialogChange} onGameWalletDialogChange={onGameWalletDialogChange} /></PendingOperations>;
}
function BisScreen({ context, gameWallet, onDeveloperDialogChange, onGameWalletDialogChange }: { context: BisContext; gameWallet?: GameWallet; onDeveloperDialogChange?(open: (() => void) | undefined): void;onGameWalletDialogChange?(open:(()=>void)|undefined):void }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const equipment=useMemo(()=>createBisEquipment(context),[context]);
  const equipmentState=useSyncExternalStore(equipment.subscribe,equipment.getState,equipment.getState);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [gameWalletLogin, setGameWalletLogin] = useState(false);
  const [developerReturn, setDeveloperReturn] = useState(false);
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
  useEffect(()=>()=>equipment.dispose(),[equipment]);
  useEffect(() => {
    onDeveloperDialogChange?.(() => {
      setDeveloperOpen(true);
      context.openAccountDialog();
    });
    return () => onDeveloperDialogChange?.(undefined);
  }, [context, onDeveloperDialogChange]);
  useEffect(()=>{onGameWalletDialogChange?.(()=>{setGameWalletLogin(true);context.openAccountDialog();});return()=>onGameWalletDialogChange?.(undefined);},[context,onGameWalletDialogChange]);
  useEffect(() => {
    if (state.view !== 'account') { setDeveloperOpen(false); setDeveloperReturn(false); setGameWalletLogin(false); }
  }, [state.view]);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = ['loading','creating','saving','resetting','logging-out','restoring','restore-saving'].includes(state.phase);
  const restoring = ['restore-entry','restoring','restore-saving','restore-error'].includes(state.phase);
  const savedRecovery = state.accountRecovery;
  const logout = !savedRecovery && ['logout-confirmation','logging-out','logout-error'].includes(state.phase);
  const transfer = state.phase === 'active' && state.accountTransfer;
  const onboarding = state.phase === 'active' && state.accountOnboarding;
  const details = state.phase === 'active' && state.accountDetails;
  const activity = state.phase === 'active' && state.accountActivity;
  const assets = state.phase === 'active' && state.accountAssets;
  useEffect(()=>{if(assets)void equipment.refresh();},[assets,state.profileId,equipment]);
  const contracts = state.phase === 'active' && !!state.accountContracts;
  const [contractOpen,setContractOpen]=useState(false);
  const receive = state.phase === 'active' && state.accountReceive;
  const send = state.phase === 'active' && state.accountSend;
  const developer = state.view === 'account' && developerOpen && !onboarding;
  const menu = state.phase === 'active' && !developer && !onboarding && !details && !transfer && !activity && !assets && !contracts && !savedRecovery && !receive && !send;
  const recovery = state.phase === 'recovery' || state.phase === 'saving';
  const recoverySession = useMemo(() => ({}), [context, recovery, savedRecovery, state.profileId]);
  useEffect(() => {
    if (state.accountRecovery) void getControls(context).revealRecovery();
  }, [context, state.accountRecovery]);
  useEffect(() => {
    if (state.view === 'account') heading.current?.focus();
    if (state.view === 'account-button') button.current?.focus();
  }, [state.view, state.phase, state.accountOnboarding, state.accountDetails, state.accountTransfer, state.accountActivity, state.accountAssets, assetOpen, state.accountRecovery, state.accountReceive, state.accountSend]);
  // Direct onboarding needs a fresh balance before it can state a stage. Keep the
  // existing pending surface visible while that bounded read is in flight rather
  // than briefly presenting the default funding stage for a funded account.
  const data = assets ? state.assets : activity ? state.activity : receive ? state.addresses : details || transfer || onboarding ? state.balance : undefined;
  const phaseLabels: Record<string,string> = {loading:'Loading...',creating:'Creating...',saving:'Saving...',resetting:'Resetting...', 'logging-out':'Logging out...', restoring:'Restoring...', 'restore-saving':'Saving...'};
  const pageLoading = !!data && (data.status === 'idle' || data.status === 'loading');
  const recoveryLoading = savedRecovery && (state.recoveryStatus === 'hidden' || state.recoveryStatus === 'loading');
  const failure = state.error || (!assets && !activity && data?.status === 'unavailable' ? `${assets?'Assets':activity?'Transactions':receive?'Receiving addresses':'Balances'} could not be loaded.` : savedRecovery && state.recoveryStatus === 'unavailable' ? 'Recovery phrase could not be loaded.' : undefined);
  usePendingNotice(state.view !== 'empty' && (busy || (!assets && pageLoading) || recoveryLoading), phaseLabels[state.phase] ?? 'Loading...', state.view !== 'empty' ? failure : undefined, () => getControls(context).dismissOperationError());
  if (state.view === 'empty') return null;
  if (state.view === 'account' && (assets || contracts || activity)) return <div className="bis-layer bis-layer-open bis-layer-collection">
    {assets && state.network && <AccountAssets key={state.profileId} assets={state.assets} network={state.network} equipment={equipment} equipmentState={equipmentState} onBurn={context.burnAsset} onToast={context.showToast} onRefresh={context.refreshAssets} onBusyChange={setAssetBusy} onDetailChange={setAssetOpen} onBack={()=>context.closeAccount()} />}
    {contracts && <AccountContracts key={state.profileId} context={context} onDetailChange={setContractOpen} />}
    {activity && <AccountActivity key={state.profileId} activity={state.activity} context={context} onDetailChange={setTransactionOpen} />}
  </div>;
  const title = gameWalletLogin ? 'Game Wallet Login' : developer ? 'Developer' : onboarding ? 'Onboarding' : assets ? (assetOpen ? 'Asset Detail' : 'Assets') : transfer ? 'Account Transfer' : send ? 'Send' : receive ? 'Receive' : savedRecovery ? 'Get Recovery Phrase' : activity ? 'Transactions' : details ? 'Accounts Details' : restoring ? 'Restore Account' : logout ? 'Account Log Out' : recovery ? 'Set Recovery Phrase' : state.phase === 'creating' ? 'Create Account' : 'Account';
  return <div className={`bis-layer ${assets ? 'bis-layer-assets' : ''} ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <AccountCard network={state.network === 'mutinynet' ? 'Mutinynet' : state.network === 'signet' ? 'Signet' : 'Choose'} className={onboarding ? ' bis-card-onboarding' : assets ? ` bis-card-assets${assetOpen ? ' bis-card-asset-detail' : ''}` : activity ? ' bis-card-activity' : ''}
        title={contracts ? contractOpen?'Contract Details':'Contracts' : activity && transactionOpen ? 'Transaction Detail' : title} headingRef={heading}
        headingActions={!gameWalletLogin && (assets || details || transfer || activity || receive) && <IconButton className="bis-title-icon" label={`Refresh ${title}`} disabled={assets ? assetBusy || state.assets.status === 'idle' || state.assets.status === 'loading' : receive ? state.addresses.status === 'idle' || state.addresses.status === 'loading' : activity ? state.activity.status === 'idle' || state.activity.status === 'loading' : state.balance.status === 'loading' || state.balance.status === 'idle'} onClick={()=>void (assets ? context.refreshAssets() : activity ? context.refreshActivity() : context.refreshBalance())}>
            <span className="bis-refresh-image" aria-hidden="true" />
          </IconButton>}
        description={gameWalletLogin ? 'Set the wallet used by this game’s contracts.' : developer ? 'Developer tools for this BIS session.' : (send ? `Send ${networkLabel(state.network)} test funds to another Arkade address.` : receive ? 'Use these addresses to receive test funds only.' : savedRecovery ? 'Anyone with this phrase can access your account.' : restoring ? 'Enter the recovery words saved from this experience.' : logout ? 'Back up your recovery phrase. Logout removes this saved wallet access and its local transaction records. Submitted transactions are not cancelled.' : state.hasProfile ? (onboarding || assets || details || transfer || activity ? null : 'You are logged in.') : recovery ? 'Save these words privately.' : 'You are not logged in.')}>
        {details && !gameWalletLogin && <><AccountIdentity profileId={state.profileId} /><AccountBalances balance={state.balance} /></>}
        {onboarding && <AccountOnboarding key={state.profileId} view={state.onboarding} network={state.network} bitcoinAddress={state.addresses.status==='ready'?state.addresses.bitcoinAddress:undefined} balance={state.balance} />}
        {transfer && <AccountTransfer context={context} key={state.profileId} balance={state.balance} onBack={() => context.closeAccount()} />}
        {receive && <AccountAddresses addresses={state.addresses} />}
        {send && <AccountSend context={context} key={state.profileId} />}
        {logout && <>
          <label className="bis-backup-check"><input type="checkbox" checked={state.logoutBackupAcknowledged} disabled={busy} onChange={event => context.setLogoutBackupAcknowledged(event.target.checked)} /><span>I have backed up my wallet</span></label>
          {state.logoutPendingCount !== null && state.logoutPendingCount > 0 && <>
            <label className="bis-backup-check"><input type="checkbox" checked={state.logoutPendingAcknowledged} disabled={busy} onChange={event => context.setLogoutPendingAcknowledged(event.target.checked)} /><span>I accept losing my ({state.logoutPendingCount}) pending transactions.</span></label>
          </>}
          {state.hasGameWallet && <label className="bis-backup-check"><input type="checkbox" checked={state.logoutGameWalletAcknowledged} disabled={busy} onChange={event => context.setLogoutGameWalletAcknowledged(event.target.checked)} /><span>I understand this will ALSO reset the Game Wallet saved in this browser.</span></label>}
        </>}
        {(savedRecovery || recovery || state.phase === 'creating') && <TestWalletWarning />}
        {(recovery || (savedRecovery && state.recoveryStatus === 'ready')) && <RecoveryPhrasePanel key={savedRecovery ? 'saved' : 'setup'} phrase={getControls(context).recovery()} session={recoverySession} disabled={busy} />}
        {state.error && !busy && <p role="alert">{state.error}</p>}
        {gameWalletLogin && gameWallet ? <GameWalletLogin wallet={gameWallet} onBack={() => setGameWalletLogin(false)} /> : assets || contracts || transfer || send ? null : restoring ? <RestoreAccount context={context} phase={state.phase} /> : developer ? <div className="bis-actions">
          <div className="bis-copy-field-heading"><h3>Player Wallet</h3></div>
          <button className="bis-button" disabled={!state.hasProfile || busy} onClick={() => { setDeveloperOpen(false); setDeveloperReturn(true); context.openAccountOnboarding?.(); }}>{onboardingLabel(state.onboarding,state.balance)}</button>
          <div className="bis-copy-field-heading"><h3>Game Wallet</h3></div>
          {gameWallet && <p>This demo has no server. So game wallet is temporarily here.</p>}
          {gameWallet && <button className="bis-button" disabled={!state.hasProfile} onClick={() => setGameWalletLogin(true)}>Game Wallet Login</button>}
          <button ref={close} className="bis-button bis-back" onClick={() => setDeveloperOpen(false)}>Back</button>
        </div> : <div className="bis-actions">
          {menu && <button className="bis-button" onClick={()=>context.openAccountDetails()}>Accounts Details</button>}
          {details && <div className="bis-account-collections">
            <button className="bis-button" onClick={()=>context.openAccountAssets()}>Assets</button>
            <button className="bis-button" onClick={()=>context.openAccountContracts?.()}>Contracts</button>
            <button className="bis-button" title="Transactions" onClick={()=>context.openAccountActivity()}>Transactions</button>
          </div>}
          {details && <button className="bis-button" onClick={()=>context.openAccountRecovery()}>Get Recovery Phrase</button>}
          {details && <button className="bis-button bis-danger" disabled={busy} onClick={() => setDeveloperOpen(true)}>Developer</button>}
          {menu && <div className="bis-transfer-actions"><FitTextButton onClick={()=>context.openAccountSend()}>⚡ Send</FitTextButton><FitTextButton onClick={()=>context.openAccountReceive()}>⚡ Receive</FitTextButton><FitTextButton onClick={()=>context.openAccountTransfer()}>⚡ Swap</FitTextButton></div>}
          {savedRecovery ? (state.recoveryStatus === 'unavailable' ? <button className="bis-button" onClick={()=>void getControls(context).revealRecovery()}>Retry</button> : null) : onboarding || details || activity || receive || send ? null : logout ? <button className="bis-button bis-danger" disabled={busy || !state.logoutBackupAcknowledged || (state.logoutPendingCount !== null && state.logoutPendingCount > 0 && !state.logoutPendingAcknowledged) || (state.hasGameWallet && !state.logoutGameWalletAcknowledged)} onClick={()=>void (state.phase === 'logout-error' ? context.retry() : context.confirmLogout())}>{state.phase === 'logout-error' ? 'Retry' : 'Log Out'}</button> : state.phase === 'error' ? <button className="bis-button bis-primary" onClick={()=>void context.retry()}>Retry</button> : state.hasProfile ? <button className="bis-button" disabled={busy} onClick={()=>context.openLogoutConfirmation()}>Log Out</button> : recovery ? <><button className="bis-button bis-primary" disabled={busy} onClick={()=>void context.continueAccount()}>⚡ Continue</button></> : !busy && <>
            <div className="bis-entry-group"><FieldHeading label="Network" /><NetworkSelect value={state.network} onChange={context.selectNetwork} /></div>
            <div className="bis-entry-group"><FieldHeading label="Account" /><div className="bis-account-actions"><button className="bis-button bis-primary" disabled={!state.network} onClick={()=>void context.createAccount()}>⚡ Create Account</button><button className="bis-button" disabled={!state.network} onClick={()=>context.openRestoreAccount()}>⚡ Restore Account</button></div></div>
          </>}
          {!(activity && transactionOpen) && <button ref={close} className="bis-button bis-back" disabled={state.phase === 'resetting' || state.phase === 'logging-out'} onClick={()=>{
            if (onboarding && developerReturn) { setDeveloperReturn(false); context.closeAccount(); setDeveloperOpen(true); }
            else context.closeAccount();
          }}>Back</button>}
        </div>}
      </AccountCard>}
  </div>;
}

export function createBisUi(context: BisContext, options: { gameWallet?: GameWallet } = {}) {
  let root: Root | undefined;
  let host: HTMLElement | undefined;
  let openDeveloperDialog: (() => void) | undefined;
  let openGameWalletDialog:(()=>void)|undefined;
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
      root.render(<BisView context={context} gameWallet={options.gameWallet} onDeveloperDialogChange={open => { openDeveloperDialog = open; }} onGameWalletDialogChange={open=>{openGameWalletDialog=open;}} />);
    },
    showAccountButton() { internal.present(); },
    openDeveloperDialog() { internal.assertAlive(); openDeveloperDialog?.(); },
    openGameWalletLogin(){internal.assertAlive();openGameWalletDialog?.();},
    unmount() { internal.toasts.clear(); internal.hideAssets(); root?.unmount(); root = undefined; host = undefined; openDeveloperDialog = undefined;openGameWalletDialog=undefined; },
  };
}
export function GameOverlay() {
  const context = useRef<BisContext | null>(null);
  const gameWallet = useRef<GameWallet | null>(null);
  const generation = useRef(0);
  if (!context.current) context.current = createBisContext({hasGameWallet:()=>!!gameWallet.current?.getState().profileId,resetGameWallet:async()=>gameWallet.current ? gameWallet.current.reset() : true});
  if (!gameWallet.current) gameWallet.current = createBisGameWallet({playerProfileId: () => context.current?.getState().profileId,playerNetwork:()=>context.current?.getState().network});
  useEffect(() => context.current!.subscribe(() => { void gameWallet.current?.refresh(); }), []);
  useEffect(() => {
    const client = context.current!;
    const current = ++generation.current;
    getControls(client).present();
    // StrictMode replays effects; dispose only after a genuine unmount.
    return () => { queueMicrotask(() => { if (generation.current === current) { gameWallet.current?.dispose(); client.dispose(); } }); };
  }, []);
  return <BisView context={context.current} gameWallet={gameWallet.current} />;
}
