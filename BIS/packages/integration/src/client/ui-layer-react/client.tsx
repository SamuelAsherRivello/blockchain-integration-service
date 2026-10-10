import {AccountOnboardingView,onboardingLabel} from './AccountOnboarding';
import { PendingOperations, usePendingNotice, type HostLoading } from './PendingOperationDialog';
import { ToastViewport } from './ToastViewport';
import { AccountAssetsView } from './AccountAssets';
import { AccountContractsView } from './AccountContracts';
import { AccountBalancesFormValue } from './AccountBalances';
import { AccountSendView } from './AccountSend';
import { AccountTransferView } from './AccountTransfer';
import { AccountActivityView } from './AccountActivity.tsx';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getControls, type BisContext } from '../state-layer-core/context';
import { createBisContext } from '../wallet-layer-arkade/context-composition';
import './overlay.css';
import { AccountRestoreView } from './RestoreAccount';
import { AccountAddressesFormValue } from './AccountAddresses';
import { AccountDialogShell } from './AccountCard';
import { FormHeading } from './FormHeading';
import { FitTextButton } from './FitTextButton';
import { IconButton } from './IconButton';
import { RecoveryPhrasePanel, TestWalletWarning } from './RecoveryPhrasePanel';
import { GameWalletLoginView } from './GameWalletLogin';
import { createBisGameWallet } from '../state-layer-core/game-wallet';
import { networkLabel } from '../state-layer-core/test-network';
import { assetMintingSupportAvailable, assetMintingSupportFeedback, contractSupportAvailable, contractSupportFeedback, itemSupportAvailable, itemSupportFeedback } from '../state-layer-core/capabilities';
import { FormRowBoolean } from './FormRowBoolean';
import { ViewTransition } from './ViewTransition';
import { defaultViewLoadingPolicy, useEntryLoadingGate, viewLoadingPolicies } from './view-loading';
type GameWallet = ReturnType<typeof createBisGameWallet>;
const emptySubscribe = () => () => {};
const emptySnapshot = () => undefined;

const networkOptions = [
  { value: 'signet' as const, label: 'Signet' },
  { value: 'mutinynet' as const, label: 'Mutiny' },
];

function NetworkSelect({ value, onChange }: { value: 'signet' | 'mutinynet' | undefined; onChange(network: 'signet' | 'mutinynet'): void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, networkOptions.findIndex(option => option.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listboxId = 'bis-network-options';
  const selectedIndex = networkOptions.findIndex(option => option.value === value);
  const displayedOption = selectedIndex >= 0 ? networkOptions[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function choose(index: number) {
    const option = networkOptions[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setOpen(false);
    trigger.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1;
      setActiveIndex((next + networkOptions.length) % networkOptions.length);
      setOpen(true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : networkOptions.length - 1);
      setOpen(true);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return <div ref={root} className="bis-network-select">
    <span className="bis-visually-hidden">Network</span>
    <button ref={trigger} id="bis-network" type="button" className="bis-network-select-trigger" aria-label="Network" aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} onClick={() => { setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); setOpen(current => !current); }} onKeyDown={handleKeyDown}>
      <span>{displayedOption?.label ?? 'Choose network'}</span>
    </button>
    <svg className="bis-network-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 5 5 5 5-5" /></svg>
    {open && <div id={listboxId} className="bis-network-menu" role="listbox" aria-label="Network options" tabIndex={-1}>
      <span className="bis-network-menu-label">Select a network</span>
      {networkOptions.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} className={`bis-network-option${value === option.value ? ' bis-network-option-selected' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>
        <span>{option.label}</span>
        {value === option.value && <svg className="bis-network-option-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
      </button>)}
    </div>}
  </div>;
}

export function BisAccountView({ context, gameWallet, hasItemSupport, hasAssetMintingSupport, hasContractSupport, onDeveloperDialogChange, onGameWalletDialogChange, hostLoading, onBisVisibilityChange }: { context: BisContext; gameWallet?: GameWallet; hasItemSupport?: () => boolean; hasAssetMintingSupport?: () => boolean; hasContractSupport?: () => boolean; onDeveloperDialogChange?(open: (() => void) | undefined): void;onGameWalletDialogChange?(open:(()=>void)|undefined):void;hostLoading?: HostLoading;onBisVisibilityChange?(visible:boolean):void }) {
  return <PendingOperations overlay={<ToastViewport context={context} />} hostLoading={hostLoading} onBisVisibilityChange={onBisVisibilityChange}><BisAccountScreen context={context} gameWallet={gameWallet} hasItemSupport={hasItemSupport} hasAssetMintingSupport={hasAssetMintingSupport} hasContractSupport={hasContractSupport} onDeveloperDialogChange={onDeveloperDialogChange} onGameWalletDialogChange={onGameWalletDialogChange} /></PendingOperations>;
}
function BisAccountScreen({ context, gameWallet, hasItemSupport, hasAssetMintingSupport, hasContractSupport, onDeveloperDialogChange, onGameWalletDialogChange }: { context: BisContext; gameWallet?: GameWallet; hasItemSupport?: () => boolean; hasAssetMintingSupport?: () => boolean; hasContractSupport?: () => boolean; onDeveloperDialogChange?(open: (() => void) | undefined): void;onGameWalletDialogChange?(open:(()=>void)|undefined):void }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const walletSnapshot = useSyncExternalStore(gameWallet?.subscribe ?? emptySubscribe, gameWallet?.getState ?? emptySnapshot, gameWallet?.getState ?? emptySnapshot);
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
  const contracts = state.phase === 'active' && !!state.accountContracts;
  const [contractOpen,setContractOpen]=useState(false);
  const [closingAccount,setClosingAccount]=useState(false);
  const receive = state.phase === 'active' && state.accountReceive;
  const send = state.phase === 'active' && state.accountSend;
  const developer = state.view === 'account' && developerOpen && !onboarding;
  const menu = state.phase === 'active' && !developer && !onboarding && !details && !transfer && !activity && !assets && !contracts && !savedRecovery && !receive && !send;
  const recovery = state.phase === 'recovery' || state.phase === 'saving';
  const recoverySession = useMemo(() => ({}), [context, recovery, savedRecovery, state.profileId]);
  // Keep host capability checks scoped to the Developer view, as before these
  // indicators existed. Hosts may calculate them from live integration state.
  const hostAssetMintingSupport = developer ? hasAssetMintingSupport?.() : undefined;
  const hostContractSupport = developer ? hasContractSupport?.() : undefined;
  const hostItemSupport = developer ? hasItemSupport?.() : undefined;
  // Capability callbacks return a boolean while their underlying wallet read
  // is still in flight. Keep the indicators unresolved until that read settles
  // so a transient false is not presented as the final answer.
  const supportLoading = walletSnapshot?.status === 'loading' || state.phase === 'loading' || state.phase === 'resetting';
  const assetMintingSupported = supportLoading ? undefined : hostAssetMintingSupport ?? (!!walletSnapshot && assetMintingSupportAvailable(state, walletSnapshot));
  const contractSupported = supportLoading ? undefined : hostContractSupport ?? (!!walletSnapshot && contractSupportAvailable(state, walletSnapshot));
  const itemsSupported = supportLoading ? undefined : hostItemSupport ?? itemSupportAvailable(state);
  const hostFeedback = (capability: string, supported: boolean | undefined) => supported === undefined ? undefined : supported
    ? `Current status: available. ${capability} is enabled by the host capability check.`
    : `${capability} is unavailable because the host capability check returned false.`;
  const assetMintingTooltip = hostFeedback('Asset Minting', hostAssetMintingSupport) ?? (walletSnapshot
    ? assetMintingSupportFeedback(state, walletSnapshot)
    : 'Asset Minting is unavailable: select or create a Game Wallet.');
  const contractTooltip = hostFeedback('Contracts', hostContractSupport) ?? (walletSnapshot
    ? contractSupportFeedback(state, walletSnapshot)
    : 'Contracts are unavailable: select or create a Game Wallet.');
  const itemsTooltip = hostFeedback('Items', hostItemSupport) ?? itemSupportFeedback(state);
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
  const phaseLabels: Record<string,string> = {loading:'Loading ...',creating:'Creating...',saving:'Saving...',resetting:'Resetting...', 'logging-out':'Logging out...', restoring:'Restoring...', 'restore-saving':'Saving...'};
  const pageLoading = !!data && (data.status === 'idle' || data.status === 'loading');
  const recoveryLoading = savedRecovery && (state.recoveryStatus === 'hidden' || state.recoveryStatus === 'loading');
  const failure = state.error || (details && state.addresses.status==='unavailable' ? 'Receiving addresses could not be loaded.' : undefined) || (!onboarding && !assets && !activity && data?.status === 'unavailable' ? `${assets?'Assets':activity?'Transactions':receive?'Receiving addresses':'Balances'} could not be loaded.` : savedRecovery && state.recoveryStatus === 'unavailable' ? 'Recovery phrase could not be loaded.' : undefined);
  const accountDetailsLoading = details && (pageLoading || state.addresses.status==='idle' || state.addresses.status==='loading');
  const entryViewKey = receive ? 'receive' : transfer ? 'transfer' : activity ? 'activity' : contracts ? 'contracts' : savedRecovery ? 'recovery' : 'none';
  const entryLoading = entryViewKey === 'recovery' ? recoveryLoading : !!entryViewKey && entryViewKey !== 'none' && pageLoading;
  const entryPolicy = viewLoadingPolicies[entryViewKey] ?? defaultViewLoadingPolicy;
  const gatedEntryLoading = useEntryLoadingGate(entryLoading, entryViewKey !== 'none', entryPolicy, entryViewKey);
  const foregroundPageLoading = entryViewKey !== 'none' ? gatedEntryLoading : (!assets && !accountDetailsLoading && !onboarding ? pageLoading : false);
  // Account Details owns a non-modal balance read: its placeholders and the
  // controls that are already prepared must remain usable while the read runs.
  // Keep this explicit at the pending-dialog boundary so a future loading
  // source cannot accidentally make the Details page inert again.
  usePendingNotice(state.view !== 'empty' && !accountDetailsLoading && (busy || foregroundPageLoading), phaseLabels[state.phase] ?? 'Loading ...', state.view !== 'empty' ? failure : undefined, () => getControls(context).dismissOperationError());
  const handleBack = () => {
    if (closingAccount) return;
    if (onboarding && developerReturn) {
      // Leave the nested onboarding route explicitly before revealing the
      // Developer view. This keeps the local presentation state and the
      // shared account route in the same transition.
      setDeveloperOpen(true);
      setDeveloperReturn(false);
      context.openAccountDetails();
      return;
    }
    if (menu) {
      setClosingAccount(true);
      window.setTimeout(() => {
        setClosingAccount(false);
        context.closeAccount();
      }, 100);
      return;
    }
    context.closeAccount();
  };
  if (state.view === 'empty') return <ViewTransition viewKey="empty">{null}</ViewTransition>;
  const collectionKey = assets ? `assets-${assetOpen ? 'detail' : 'list'}` : contracts ? `contracts-${contractOpen ? 'detail' : 'list'}` : activity ? `activity-${transactionOpen ? 'detail' : 'list'}` : undefined;
  if (state.view === 'account' && (assets || contracts || activity)) return <div className="bis-layer bis-layer-open bis-layer-collection">
    <ViewTransition viewKey={collectionKey ?? 'collection'}>
      {assets && state.network && <AccountAssetsView key={state.profileId} assets={state.assets} network={state.network} onBurn={context.burnAsset} onToast={context.showToast} onRefresh={context.refreshAssets} onBusyChange={setAssetBusy} onDetailChange={setAssetOpen} onBack={()=>context.closeAccount()} />}
      {contracts && <AccountContractsView key={state.profileId} context={context} onDetailChange={setContractOpen} />}
      {activity && <AccountActivityView key={state.profileId} activity={state.activity} context={context} onDetailChange={setTransactionOpen} />}
    </ViewTransition>
  </div>;
  const title = gameWalletLogin ? 'Game Wallet' : developer ? 'Developer' : onboarding ? 'Onboarding' : assets ? (assetOpen ? 'Asset Detail' : 'Assets') : transfer ? 'Swap' : send ? 'Send' : receive ? 'Receive' : savedRecovery ? 'Get Recovery Phrase' : activity ? 'Transactions' : details ? 'Accounts Details' : restoring ? 'Restore Account' : logout ? 'Account Log Out' : recovery ? 'Set Recovery Phrase' : state.phase === 'creating' ? 'Create Account' : 'Account';
  const viewKey = state.view === 'account-button' ? 'account-button' : gameWalletLogin ? 'game-wallet' : developer ? 'developer' : onboarding ? 'onboarding' : restoring ? 'restore-account' : recovery ? 'set-recovery-phrase' : savedRecovery ? 'get-recovery-phrase' : logout ? 'logout-confirmation' : state.phase === 'creating' ? 'create-account' : details ? 'account-details' : transfer ? 'swap' : send ? 'send' : receive ? 'receive' : 'account-menu';
  return <div className={`bis-layer ${assets ? 'bis-layer-assets' : ''} ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <ViewTransition viewKey={viewKey}><AccountDialogShell network={state.network === 'mutinynet' ? 'Mutinynet' : state.network === 'signet' ? 'Signet' : 'Choose'} className={`${onboarding ? ' bis-card-onboarding' : assets ? ` bis-card-assets${assetOpen ? ' bis-card-asset-detail' : ''}` : activity ? ' bis-card-activity' : ''}${closingAccount ? ' bis-card-closing' : ''}`}
        title={contracts ? contractOpen?'Contract Details':'Contracts' : activity && transactionOpen ? 'Transaction Detail' : title} headingRef={heading}
        headingActions={gameWalletLogin && gameWallet ? <IconButton className="bis-title-icon" label="Refresh Game Wallet" disabled={walletSnapshot?.status === 'loading'} onClick={()=>void gameWallet.refresh()}>
            <span className="bis-refresh-image" aria-hidden="true" />
          </IconButton> : !gameWalletLogin && (assets || details || transfer || activity || receive) && <IconButton className="bis-title-icon" label={`Refresh ${title}`} disabled={assets ? assetBusy || state.assets.status === 'idle' || state.assets.status === 'loading' : receive ? state.addresses.status === 'idle' || state.addresses.status === 'loading' : activity ? state.activity.status === 'idle' || state.activity.status === 'loading' : accountDetailsLoading} onClick={()=>void (assets ? context.refreshAssets() : activity ? context.refreshActivity() : context.refreshBalance())}>
            <span className="bis-refresh-image" aria-hidden="true" />
          </IconButton>}
        description={gameWalletLogin ? 'Set the wallet used by this game’s contracts.' : developer ? 'Developer tools for this BIS session.' : (send ? `Send ${networkLabel(state.network)} test funds to another Arkade address.` : receive ? 'Use these addresses to receive test funds only.' : savedRecovery ? 'Anyone with this phrase can access your account.' : restoring ? 'Enter the recovery words saved from this experience.' : logout ? 'Back up your recovery phrase. Logout removes this saved wallet access and its local transaction records. Submitted transactions are not cancelled.' : state.hasProfile ? (onboarding || assets || details || transfer || activity ? null : 'You are logged in.') : recovery ? 'Save these words privately.' : 'You are not logged in.')}>
        {details && !gameWalletLogin && !developer && <><AccountAddressesFormValue addresses={state.addresses} arkadeOnly /><AccountBalancesFormValue balance={state.balance} /></>}
        {onboarding && <AccountOnboardingView key={state.profileId} view={state.onboarding} network={state.network} bitcoinAddress={state.addresses.status==='ready'?state.addresses.bitcoinAddress:undefined} balance={state.balance} />}
        {transfer && <AccountTransferView context={context} key={state.profileId} balance={state.balance} onBack={() => context.closeAccount()} />}
        {receive && <AccountAddressesFormValue addresses={state.addresses} />}
        {send && <AccountSendView context={context} key={state.profileId} />}
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
        {gameWalletLogin && gameWallet ? <GameWalletLoginView wallet={gameWallet} onBack={() => setGameWalletLogin(false)} /> : assets || contracts || transfer || send ? null : restoring ? <AccountRestoreView context={context} phase={state.phase} /> : developer ? <div className="bis-actions">
          <div className="bis-copy-field-heading"><h3>Support</h3></div>
          <div className="bis-support-list">
            <FormRowBoolean label="Asset Minting" value={assetMintingSupported} enabledText={assetMintingTooltip} disabledText={assetMintingTooltip} />
            <FormRowBoolean label="Contracts" value={contractSupported} enabledText={contractTooltip} disabledText={contractTooltip} />
            <FormRowBoolean label="Items" value={itemsSupported} enabledText={itemsTooltip} disabledText={itemsTooltip} />
          </div>
          <div className="bis-copy-field-heading"><h3>Player Wallet</h3></div>
          <p>Allow easy account funding.</p>
          <button className="bis-button" disabled={!state.hasProfile || busy} onClick={() => { setDeveloperOpen(false); setDeveloperReturn(true); context.openAccountOnboarding?.(); }}>{onboardingLabel(state.onboarding,state.balance)}</button>
          <div className="bis-copy-field-heading"><h3>Game Wallet</h3></div>
          {gameWallet && <p>In lieu of server.</p>}
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
            <div className="bis-entry-group"><FormHeading label="Network" /><NetworkSelect value={state.network} onChange={context.selectNetwork} /></div>
            <div className="bis-entry-group"><FormHeading label="Account" /><div className="bis-account-actions"><button className="bis-button bis-primary" disabled={!state.network} onClick={()=>void context.createAccount()}>⚡ Create Account</button><button className="bis-button" disabled={!state.network} onClick={()=>context.openRestoreAccount()}>⚡ Restore Account</button></div></div>
          </>}
          {!(activity && transactionOpen) && <button ref={close} className="bis-button bis-back" disabled={state.phase === 'resetting' || state.phase === 'logging-out'} onClick={handleBack}>Back</button>}
        </div>}
      </AccountDialogShell></ViewTransition>}
  </div>;
}

export function createBisUi(context: BisContext, options: { gameWallet?: GameWallet; hasItemSupport?: () => boolean; hasAssetMintingSupport?: () => boolean; hasContractSupport?: () => boolean } = {}) {
  let root: Root | undefined;
  let host: HTMLElement | undefined;
  let openDeveloperDialog: (() => void) | undefined;
  let openGameWalletDialog:(()=>void)|undefined;
  let hostLoading = false;
  let bisVisible = false;
  const hostLoadingListeners = new Set<() => void>();
  const hostLoadingControl: HostLoading = {subscribe(listener) { hostLoadingListeners.add(listener); return () => hostLoadingListeners.delete(listener); }, getSnapshot: () => hostLoading};
  const setHostLoading = (next: boolean) => {
    if (hostLoading === next) return;
    hostLoading = next;
    for (const listener of hostLoadingListeners) listener();
  };
  const setBisVisible = (next: boolean) => { bisVisible = next; };
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
      root.render(<BisAccountView context={context} gameWallet={options.gameWallet} hasItemSupport={options.hasItemSupport} hasAssetMintingSupport={options.hasAssetMintingSupport} hasContractSupport={options.hasContractSupport} onDeveloperDialogChange={open => { openDeveloperDialog = open; }} onGameWalletDialogChange={open=>{openGameWalletDialog=open;}} hostLoading={hostLoadingControl} onBisVisibilityChange={setBisVisible} />);
    },
    showAccountButton() { internal.present(); },
    openDeveloperDialog() { internal.assertAlive(); openDeveloperDialog?.(); },
    openGameWalletLogin(){internal.assertAlive();openGameWalletDialog?.();},
    isLoadingUIVisible() { return hostLoading; },
    showLoadingUI() { internal.assertAlive(); setHostLoading(true); },
    hideLoadingUI() { setHostLoading(false); },
    unmount() { setHostLoading(false); bisVisible = false; internal.toasts.clear(); internal.hideAssets(); root?.unmount(); root = undefined; host = undefined; openDeveloperDialog = undefined;openGameWalletDialog=undefined; },
  };
}
export function GameOverlay() {
  const context = useRef<BisContext | null>(null);
  const gameWallet = useRef<GameWallet | null>(null);
  const generation = useRef(0);
  if (!context.current) context.current = createBisContext({hasGameWallet:()=>!!gameWallet.current?.getState().profileId,resetGameWallet:async()=>gameWallet.current ? gameWallet.current.reset() : true});
  if (!gameWallet.current) gameWallet.current = createBisGameWallet({playerProfileId: () => context.current?.getState().profileId,playerNetwork:()=>context.current?.getState().network});
  useEffect(() => {
    let playerKey = `${context.current!.getState().profileId ?? ''}:${context.current!.getState().network ?? ''}`;
    return context.current!.subscribe(() => {
      const next = context.current!.getState();
      const nextPlayerKey = `${next.profileId ?? ''}:${next.network ?? ''}`;
      if (nextPlayerKey === playerKey) return;
      playerKey = nextPlayerKey;
      void gameWallet.current?.refresh();
    });
  }, []);
  useEffect(() => {
    const client = context.current!;
    const current = ++generation.current;
    getControls(client).present();
    // StrictMode replays effects; dispose only after a genuine unmount.
    return () => { queueMicrotask(() => { if (generation.current === current) { gameWallet.current?.dispose(); client.dispose(); } }); };
  }, []);
  return <BisAccountView context={context.current} gameWallet={gameWallet.current} />;
}
