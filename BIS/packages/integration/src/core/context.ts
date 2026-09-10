import {createOnboardingAdapter,onboardingScope} from '../arkade/onboarding.ts';
import {startOnboarding,type OnboardingAdapter,type OnboardingView} from './onboarding-service.ts';
import {readAccountOnboarding} from './onboarding-record.ts';
import {reconstructWalletReservations} from '../arkade/reservation-recovery.ts';
import { queryAccountContracts, contractController, type BisContractFilter, type BisContractsResult, type BisContractActionResult } from './lto-service.ts';
import {eligibleUnreservedCoins, walletReservations} from './wallet-reservations.ts';
import { createPaymentNotifications } from './payment-notifications.ts';
import { paymentSender, type BisPlayerRecipient } from './game-player-payment.ts';
import { validContinueRecipient } from '../arkade/continue-recipient.ts';
import {submitContinuation,reconcileContinuation} from '../arkade/continuation.ts';
import {validateContinue,readContinuations,type BisContinueRequest,type BisContinueResult} from './continuation.ts';
import { readWithRetry } from './pending-read.ts';
import { createToastQueue, type BisToastOptions } from './toasts.ts';
import { watchActivity } from '../arkade/activity.ts';
import { createSharedWalletObserver } from './shared-wallet-observer.ts';
import { pendingLogoutOperations, type LogoutOperations } from './logout-cleanup.ts';
import { loadSendFunds, quoteSend, submitSend, reconcileSend } from '../arkade/sending.ts';
import { assertNoPendingSend, readSendRecord, readSendRecords, sendStatus, SendError, type BisSendQuote, type BisSendStatus } from './sending.ts';
import { watchAssetChanges, listWalletAssets, mintWalletAsset, burnWalletAsset, loadMintAvailability } from '../arkade/assets.ts';
import { assertNoPendingBurn, BurnError, validateBurn, type BisBurnAssetRequest, type BisBurnAssetResult } from './burning.ts';
import type { BisAssets } from './asset-presentation';
import { AssetError, assetError, validateMint, readAssetRecords, type BisMintAssetRequest, type BisMintAssetResult, type BisListAssetsResult, type BisPendingMintResult } from './assets.ts';
import { quoteBoarding, submitBoarding, reconcileBoarding } from '../arkade/boarding.ts';
import { assertNoPendingBoarding, assertPendingTransfersAcknowledged, withWalletMutation, BoardingBlockedError, readBoardingRecord, readBoardingRecords } from './boarding-record.ts';
import { boardingSubmissionEnabled, type BoardingQuote } from './boarding-quote.ts';
import { transferStatus } from './boarding-status.ts';
import type { BoardingRecord } from './boarding-record.ts';
export type BisTransferStatus = Readonly<{status:'idle'|'pending'|'succeeded'|'not-submitted'; amountSats?:number; commitmentTxid?:string; operationId?:string; intentId?:string; direction?:BoardingQuote['direction']; phase?:BoardingRecord['phase']; diagnostic?:BoardingRecord['diagnostic'];failure?:BoardingRecord['failure']; verification?:'live'|'unavailable';stage?:NonNullable<BoardingRecord['progress']>['stage'];execution?:'running'|'awaiting-confirmation'|'interrupted'|'unknown'|'complete';observedAt?:number;action?:NonNullable<BoardingRecord['progress']>['action']} >;
import { unavailableInvoiceReceiving, type BisInvoiceReceiving } from './invoice-receiving.ts';
import { withTransferActivity, withMintActivity, withSendActivity, type BisActivity, type BisTransaction } from './activity.ts';
import { createAccount, restoreAccount, identify, type AccountSecret } from '../arkade/account.ts';
import { phraseWords, validRecovery } from './recovery-validation.ts';
import { createAccountStorage, type AccountStorage, type StoredAccount } from './account-storage.ts';
import { loadBalance, type BalanceAmounts } from '../arkade/balance.ts';
import { loadAddresses, type AccountAddresses } from '../arkade/addresses.ts';
export type BisAddresses = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> | Readonly<{ status: 'ready' } & AccountAddresses>;
import { fundTestAccount } from '../arkade/funding.ts';
export type BisBalance = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> | Readonly<{ status: 'ready' } & BalanceAmounts>;
export type BisState = Readonly<{
  view: 'empty' | 'account-button' | 'account'; hasProfile: boolean;
  savedProfiles: readonly string[];
  profileChooser: boolean;
  phase: 'loading' | 'idle' | 'creating' | 'recovery' | 'saving' | 'active' | 'error' | 'resetting' | 'logout-confirmation' | 'logging-out' | 'logout-error' | 'restore-entry' | 'restoring' | 'restore-saving' | 'restore-error';
  logoutBackupAcknowledged: boolean;
  logoutPendingCount: number | null;
  logoutPendingAcknowledged: boolean;
  accountRecovery: boolean;
  recoveryStatus: 'hidden' | 'loading' | 'ready' | 'unavailable';
  profileId?: string; error?: string; canReset: boolean;
  balance: BisBalance;
  addresses: BisAddresses;
  invoiceReceiving: BisInvoiceReceiving;
  accountReceive: boolean;
  accountSend: boolean;
  accountDetails: boolean;
  accountTransfer: boolean;
  accountActivity: boolean;
  accountAssets: boolean;
  accountContracts?: boolean;
  accountOnboarding?: boolean;
  onboarding?: OnboardingView;
  assets: BisAssets;
  activity: BisActivity;
}>;
export type BisEvent = Readonly<{ type: 'accountConnected' | 'accountDisconnected'; profileId: string }> | Readonly<{ type: 'restartRequested'; reason: 'logout'; logoutId: string }>;
export interface BisContext {
  openAccountOnboarding?():void;
  refreshOnboarding?():void;
  checkContracts?(filter?:BisContractFilter):Promise<BisContractsResult>;
  openAccountContracts?():void;
  claimContract?(id:string):Promise<BisContractActionResult>;
  rejectContract?(id:string):Promise<BisContractActionResult>;
  refundContract?(id:string):Promise<BisContractActionResult>;
  getWalletOperations?():Promise<import('./activity-operations').WalletOperationsReport>;
  discardPreparedTransfer?(id:string):Promise<void>;
  getContinueAvailability?(): Promise<{canPay:boolean;reason?:string;availableSats?:number}>;
  getPaymentRecipient?(): Promise<BisPlayerRecipient>;
  getContinueRecipient?(): string | undefined;
  showToast(message: string, options?: BisToastOptions): void;
  requestContinue(request:BisContinueRequest):Promise<BisContinueResult>;
  getContinueStatus(operationId?:string):Promise<readonly BisContinueResult[]>;
  burnAsset(request:BisBurnAssetRequest):Promise<BisBurnAssetResult>;
  getMintAvailability(): Promise<{canMint:boolean;reason?:string;availableSats?:number;minimumSats?:number}>;
  mintAsset(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
  listAssets(): Promise<BisListAssetsResult>;
  getPendingAssetMint(): Promise<BisPendingMintResult>;
  getState(): BisState;
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: BisEvent) => void): () => void;
  ready(): Promise<void>;
  openAccountDialog(): void;
  openAccountReceive(): void;
  openAccountSend(): void;
  getSendSpendable(): Promise<number>;
  quoteAccountSend(recipient:string, amountSats?:number): Promise<BisSendQuote>;
  confirmAccountSend(quote:BisSendQuote): Promise<BisSendStatus>;
  checkAccountSend(): Promise<BisSendStatus>;
  openAccountDetails(): void;
  openAccountTransfer(): void;
  quoteAccountTransfer(amountSats?: number, direction?: BoardingQuote['direction']): Promise<BoardingQuote>;
  confirmAccountTransfer(quote: BoardingQuote, acknowledgedPendingIds?: readonly string[]): Promise<BisTransferStatus>;
  getPendingAccountTransfers(): readonly BisTransferStatus[];
  checkAccountTransfer(): Promise<BisTransferStatus>;
  openAccountActivity(): void;
  openAccountAssets(): void;
  refreshAssets(): Promise<void>;
  openAccountRecovery(): void;
  refreshActivity(): Promise<void>;
  closeAccount(): void;
  refreshBalance(): Promise<void>;
  createAccount(): Promise<void>;
  openRestoreAccount(): void;
  openProfileChooser():void;
  selectProfile(profileId:string):Promise<void>;
  continueAccount(): Promise<void>;
  openLogoutConfirmation(): void;
  setLogoutBackupAcknowledged(acknowledged: boolean): void;
  setLogoutPendingAcknowledged(acknowledged: boolean): void;
  confirmLogout(): Promise<void>;
  cancelLogout(): void;
  retry(): Promise<void>;
  dispose(): void;
}
export function accountDestination(hasProfile: boolean) { return hasProfile ? 'account-menu' : 'account-chooser'; }
type Controls = { toasts: ReturnType<typeof createToastQueue>; dismissOperationError(): void; assetSession(): number; hideAssets(session?: number): void; present(): void; reset(): Promise<void>; fund(): Promise<string>; fundingAddress(): Promise<string>; assertAlive(): void; recovery(): string | undefined; revealRecovery(): Promise<void>; hideRecovery(): void; restore(phrase: string): Promise<void> };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
// Private dependency seam for isolated tests; not exported by the package.
export function createContext(storage: AccountStorage, create = createAccount, identifyAccount = identify, restore = restoreAccount, readBalance: (account: AccountSecret, signal: AbortSignal) => Promise<BalanceAmounts> = loadBalance, fund = fundTestAccount, readAddresses: (account: AccountSecret, signal: AbortSignal) => Promise<AccountAddresses> = loadAddresses, observeActivity: typeof watchActivity = watchActivity, transfers = {quote:quoteBoarding,submit:submitBoarding,reconcile:reconcileBoarding}, assets = {list: listWalletAssets, mint: mintWalletAsset}, sends={funds:loadSendFunds,quote:quoteSend,submit:submitSend,reconcile:reconcileSend}, burn=burnWalletAsset, continuation={submit:submitContinuation,reconcile:reconcileContinuation}, options: {continueRecipient?: string} = {}, observePayments: typeof watchActivity | undefined = observeActivity === watchActivity ? watchActivity : undefined, observeAssets: typeof watchAssetChanges | undefined = assets.list === listWalletAssets ? watchAssetChanges : undefined, onboardingFactory:((account:AccountSecret,current:()=>boolean)=>OnboardingAdapter)|undefined = create===createAccount&&identifyAccount===identify&&readBalance===loadBalance?createOnboardingAdapter:undefined): BisContext {
  const toasts = createToastQueue();
  const sharedWallet = observePayments === observeActivity ? createSharedWalletObserver(observeActivity) : undefined;
  if (sharedWallet) { observeActivity = sharedWallet.observe; observePayments = sharedWallet.observe; }
  let issuedSend:BisSendQuote|undefined,sendRevision=0;
  const guardIndependentSpend=()=>{if(state.profileId&&globalThis.localStorage)eligibleUnreservedCoins([],walletReservations(state.profileId));};
  const guardSend=()=>{if(globalThis.localStorage){assertNoPendingSend(state.profileId);assertNoPendingBurn(state.profileId);}};
  const idleAssets: BisAssets = Object.freeze({status:'idle'});
  let assetWatch = new AbortController();
  let assetRefreshPending = false;
  let assetRead: Promise<void> | undefined;
  async function refreshAssetView(background = false): Promise<void> {
    if (!assetsVisible(state)) return;
    if (assetRead) { if(background)assetRefreshPending=true; return assetRead; }
    const work = async () => {
      do {
        assetRefreshPending=false;
        cancelAssets();
        const request=assetVersion, accountVersion=version, profileId=state.profileId, signal=assetOperation.signal;
        const current=()=>!disposed&&!signal.aborted&&request===assetVersion&&accountVersion===version&&profileId===state.profileId&&assetsVisible(state);
        if(!background || state.assets.status!=='ready') update({assets:Object.freeze({status:'loading'})});
        try {
          const result=await readWithRetry(readAssetSnapshot,signal);
          if(current())update({assets:Object.freeze({status:'ready',...(background?{background:true}:{}),assets:result.assets})});
        } catch { if(current())update({assets:Object.freeze({status:'unavailable'})}); }
        if(!current())break;
      } while(assetRefreshPending);
    };
    const active=work();assetRead=active;
    try {await active;} finally {if(assetRead===active)assetRead=undefined;}
  }
  function startAssetWatch() {
    if(!observeAssets)return;
    const signal=assetWatch.signal, profile=state.profileId;
    void (async()=>{
      const saved=await storage.load();
      if(signal.aborted||disposed||!saved.account||saved.account.profileId!==profile)return;
      await observeAssets(saved.account,signal,()=>{
        if(!signal.aborted&&!disposed&&state.profileId===profile&&assetsVisible(state))void refreshAssetView(true);
      });
    })().catch(()=>{ /* Manual Refresh remains available if streaming is unavailable. */ });
  }
  let assetVersion = 0;
  let assetOperation = new AbortController();
  const cancelAssets = () => { assetVersion++; assetOperation.abort(); assetOperation = new AbortController(); };
  const assetsVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && s.accountAssets;
  const idleActivity: BisActivity = Object.freeze({status:'idle'});
  let activityVersion = 0;
  let activityOperation = new AbortController();
  const cancelActivity = () => { activityVersion++; activityOperation.abort(); activityOperation = new AbortController(); };
  const activityVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && s.accountActivity;
  const idleBalance: BisBalance = Object.freeze({status:'idle'});
  const idleAddresses: BisAddresses = Object.freeze({status:'idle'});
  let state: BisState = Object.freeze({view:'empty',hasProfile:false,savedProfiles:Object.freeze([]),profileChooser:false,phase:'loading',canReset:false,logoutBackupAcknowledged:false,logoutPendingCount:0,logoutPendingAcknowledged:false,balance:idleBalance,addresses:idleAddresses,invoiceReceiving:unavailableInvoiceReceiving,accountTransfer:false,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,accountAssets:false,assets:idleAssets,activity:idleActivity,accountRecovery:false,recoveryStatus:'hidden'});
  let revealedPhrase: string | undefined;
  let recoveryVersion = 0;
  let recoveryOperation = new AbortController();
  let recoveryReturn: { phase: BisState['phase']; accountDetails?: boolean; error?: string } = { phase: 'active' };
  const clearRecovery = () => { revealedPhrase = undefined; recoveryVersion++; recoveryOperation.abort(); recoveryOperation=new AbortController(); };
  let previous: BisState['view'] = 'empty';
  let disposed = false, version = 0, generation = 0;
  let transferTimer:ReturnType<typeof setTimeout>|undefined;
  function scheduleTransferCheck() {
    if(disposed||transferTimer)return;
    transferTimer=setTimeout(async()=>{
      transferTimer=undefined;
      try {
        if(!state.hasProfile||!context.getPendingAccountTransfers().length)return;
        await context.checkAccountTransfer();
        if(state.activity.status==='ready'||state.activity.status==='unavailable') {
          const transactions=readBoardingRecords(state.profileId).reduce((rows,record)=>withTransferActivity(rows,record,state.profileId!),state.activity.transactions??[]);
          update({activity:Object.freeze({...state.activity,transactions})});
        }
      }catch {/* Durable records stay pending when verification is unavailable. */}
      if(!disposed)scheduleTransferCheck();
    },10000);
    (transferTimer as unknown as {unref?:()=>void}).unref?.();
  }
  let paymentProfile: string | undefined;
  let onboardingProfile:string|undefined,onboardingGeneration=-1;
  let onboardingOperation=new AbortController(),onboardingWorker:ReturnType<typeof startOnboarding>|undefined;
  function syncOnboarding(){
    const profile=state.hasProfile&&['active','logout-confirmation'].includes(state.phase)?state.profileId:undefined;
    if(profile===onboardingProfile&&generation===onboardingGeneration)return;
    onboardingOperation.abort();onboardingWorker=undefined;onboardingOperation=new AbortController();
    onboardingProfile=profile;onboardingGeneration=generation;
    state=Object.freeze({...state,onboarding:undefined});
    if(!profile||!onboardingFactory)return;
    const signal=onboardingOperation.signal,expected=generation;
    const current=()=>!disposed&&!signal.aborted&&state.profileId===profile&&state.hasProfile&&generation===expected;
    queueMicrotask(()=>void (async()=>{
      const saved=await storage.load();if(!current()||saved.account?.profileId!==profile||saved.generation!==expected)return;
      onboardingWorker=startOnboarding(onboardingScope(profile),onboardingFactory(saved.account,current),view=>{if(current())update({onboarding:view});},work=>withWalletMutation(work,profile),signal,()=>{if(current())walletChanged(profile,true,true);});
    })().catch(()=>{if(current())update({onboarding:{status:'pending',detail:'Account storage could not be read. Onboarding is paused safely.',transactions:[]}});}));
  }
  let paymentGeneration = -1;
  let paymentOperation = new AbortController();
  let paymentRetry: ReturnType<typeof setTimeout> | undefined;
  function syncPaymentObserver() {
    const profile = state.hasProfile ? state.profileId : undefined;
    if (profile === paymentProfile && generation === paymentGeneration) return;
    paymentOperation.abort(); clearTimeout(paymentRetry); toasts.clear();
    paymentProfile = profile;
    paymentGeneration = generation;
    receiptBalanceLoading = false;
    paymentOperation = new AbortController();
    if (!profile || !observePayments) return;
    const signal = paymentOperation.signal;
    let previousSnapshot: string | undefined;
    const notifications = createPaymentNotifications((message, messageType) => {
      if (!disposed && !signal.aborted && state.profileId === profile) {
        toasts.enqueue(message, {messageType});
      }
    }, row => paymentSender(row, profile));
    const run = async () => {
      try {
        const saved = await storage.load();
        if (signal.aborted || disposed || saved.account?.profileId !== profile) return;
        await observePayments(saved.account, signal, rows => {
          if (signal.aborted || disposed) return;
          const merged = globalThis.localStorage ? readBoardingRecords(profile).reduce((items, record) => withTransferActivity(items, record, profile), rows) : rows;
          const receipt = notifications.observe(merged);
          const snapshot = JSON.stringify(merged);
          walletChanged(profile, false, receipt.newArkadeReceipt && state.accountDetails, snapshot === previousSnapshot);
          if(snapshot!==previousSnapshot)onboardingWorker?.refresh();
          previousSnapshot = snapshot;
          if (sharedWallet && activityVisible(state) && state.activity.status === 'unavailable') {
            // Reattach a foreground consumer that ended while the source was offline.
            update({activity:idleActivity});
            void context.refreshActivity();
          }
        });
      } catch { /* Preserve baseline on reconnect; never fabricate receipts. */ }
      if (!signal.aborted && !disposed) {
        paymentRetry = setTimeout(() => void run(), 10000);
        (paymentRetry as unknown as {unref?:()=>void}).unref?.();
      }
    };
    queueMicrotask(() => void run());
  }
  let funding: number | undefined;
  let pending: AccountSecret | undefined;
  let restorePhrase: string | undefined;
  let operation = new AbortController();
  let failure: 'load' | 'create' | 'save' | undefined;
  let confirmedProfile: string | undefined, profileHydrated=false;
  const publishedLogouts = new Set<string>();
  let logoutTarget: { profileId: string; generation: number } | undefined;
  let logoutOperations: LogoutOperations | undefined;
  let storageRevision = 0;
  let balanceVersion = 0;
  let balanceOperation = new AbortController();
  const balanceVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && (s.accountDetails || s.accountReceive || s.accountTransfer);
  const cancelBalance = () => { balanceVersion++; balanceOperation.abort(); balanceOperation=new AbortController(); };
  const listeners = new Set<() => void>();
  const events = new Set<(event: BisEvent)=>void>();
  const assertAlive = () => { if(disposed) throw new Error('BIS context is disposed.'); };
  const update = (patch: Partial<BisState>) => {
    if(disposed) return;
    const before=state;
    state=Object.freeze({...state,...patch});
    if(state.accountOnboarding&&(state.view!=='account'||state.phase!=='active'||!state.hasProfile||before.profileId!==state.profileId||patch.accountAssets||patch.accountContracts||patch.accountActivity||patch.accountDetails||patch.accountTransfer||patch.accountReceive||patch.accountSend||patch.accountRecovery))state=Object.freeze({...state,accountOnboarding:false});
    if(state.accountContracts&&(state.view!=='account'||state.phase!=='active'||!state.hasProfile||before.profileId!==state.profileId||patch.accountAssets||patch.accountActivity||patch.accountDetails||patch.accountTransfer||patch.accountReceive||patch.accountSend||patch.accountRecovery))state=Object.freeze({...state,accountContracts:false});
    if (!['logout-confirmation','logging-out','logout-error'].includes(state.phase)) {
      logoutOperations=undefined;
      state=Object.freeze({...state,logoutPendingCount:0,logoutPendingAcknowledged:false});
    }
    if (state.view !== 'account' || !state.hasProfile || !['active','logout-confirmation','logout-error'].includes(state.phase)) state=Object.freeze({...state,accountRecovery:false});
    if (!state.accountRecovery || before.profileId !== state.profileId) {
      clearRecovery();
      state=Object.freeze({...state,accountRecovery:false,recoveryStatus:'hidden'});
    }
    if(state.view!=='account'||state.phase!=='active'||!state.hasProfile) state=Object.freeze({...state,accountTransfer:false,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false});
    // Other account pages replace the asset flow; unrelated state updates do not.
    if (patch.accountActivity || patch.accountDetails || patch.accountTransfer || patch.accountReceive || patch.accountSend || patch.accountRecovery || state.view !== 'account' || state.phase !== 'active' || !state.hasProfile) {
      state = Object.freeze({...state, accountAssets:false});
    }
    const enteringAssets = assetsVisible(state) && (!assetsVisible(before) || before.profileId !== state.profileId);
    if (!assetsVisible(state) || enteringAssets) { assetWatch.abort(); assetWatch=new AbortController(); assetRead=undefined;assetRefreshPending=false; cancelAssets(); state = Object.freeze({...state, assets:idleAssets}); }
    if (enteringAssets) queueMicrotask(() => { if (!disposed && assetsVisible(state) && state.assets.status === 'idle') {void context.refreshAssets();startAssetWatch();} });
    const enteringActivity = activityVisible(state) && (!activityVisible(before) || before.profileId !== state.profileId);
    if (!activityVisible(state) || enteringActivity) { cancelActivity(); state=Object.freeze({...state,activity:idleActivity}); }
    const entering=balanceVisible(state) && (!balanceVisible(before) || before.accountReceive!==state.accountReceive || before.accountTransfer!==state.accountTransfer || before.profileId!==state.profileId);
    if (!balanceVisible(state) || entering) {
      cancelBalance();
      state=Object.freeze({...state,balance:idleBalance,addresses:idleAddresses});
    }
    if (enteringActivity) queueMicrotask(() => { if (!disposed && activityVisible(state) && state.activity.status === 'idle') void context.refreshActivity(); });
    syncPaymentObserver();
    syncOnboarding();
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
    if(entering) queueMicrotask(()=>{if(!disposed && balanceVisible(state) && state.balance.status==='idle' && state.addresses.status==='idle') void context.refreshBalance();});
  };
  const invalidate = () => {issuedSend=undefined;sendRevision++;version++;operation.abort();operation=new AbortController();pending=undefined;restorePhrase=undefined;funding=undefined;};
  const fail = (kind: typeof failure, error: string) => {failure=kind;update({phase:'error',error,canReset:true});};
  const emit = (event: BisEvent, current: number) => {
    for (const listener of [...events]) {
      if (disposed || current !== version) break;
      if (events.has(listener)) {
        try { listener(Object.freeze(event)); }
        catch { console.error('BIS host event handler failed. Account storage state is unchanged.'); }
      }
    }
  };
  async function readStable(current: number): Promise<StoredAccount> {
    let loaded: StoredAccount, revision: number;
    do {
      revision = storageRevision;
      loaded = await storage.load();
      if (loaded.account && await identifyAccount(loaded.account.phrase) !== loaded.account.profileId) throw new Error('Invalid account.');
    } while (!disposed && version === current && revision !== storageRevision);
    return loaded;
  }
  function acceptLoaded(loaded: StoredAccount, current: number, closeOnAbsence = false) {
    if (disposed || version !== current) return;
    const former = confirmedProfile;
    const previouslyHydrated=profileHydrated;profileHydrated=true;
    const logout = !loaded.account && loaded.logout && loaded.logout.profileId === former && loaded.logout.generation === loaded.generation ? loaded.logout : undefined;
    if (logout) invalidate();
    current = version;
    confirmedProfile = loaded.account?.profileId;
    generation = loaded.generation; failure = undefined; logoutTarget = undefined;
    update({...((closeOnAbsence || logout) && !loaded.account ? {view:previous} : {}),phase:loaded.account?'active':'idle',hasProfile:!!loaded.account,profileId:loaded.account?.profileId,canReset:!!loaded.account,error:undefined,logoutBackupAcknowledged:false});
    if (former && former!==loaded.account?.profileId) emit({type:'accountDisconnected',profileId:former}, current);
    if (previouslyHydrated&&loaded.account && former!==loaded.account.profileId) emit({type:'accountConnected',profileId:loaded.account.profileId},current);
    if (logout && !publishedLogouts.has(logout.id)) {
      publishedLogouts.add(logout.id);
      emit({type:'restartRequested',reason:'logout',logoutId:logout.id},current);
    }
  }
  function withActiveWalletMutation<T>(work: () => Promise<T>): Promise<T> {
    const current = version, profileId = state.profileId;
    return withWalletMutation(async () => {
      if (disposed || current !== version || profileId !== state.profileId) throw Error('The account changed.');
      return work();
    }, profileId);
  }
  async function activeTransferAccount() {
    assertAlive();
    if(state.phase!=='active'||!state.hasProfile)throw Error('An active account is required.');
    const current=version, profileId=state.profileId, expectedGeneration=generation;
    const saved=await readStable(current);
    if(disposed||version!==current||!saved.account||saved.account.profileId!==profileId||saved.generation!==expectedGeneration)throw Error('The account changed. Review again.');
    return saved.account;
  }
  async function readAssetSnapshot(signal: AbortSignal) {
    const account = await activeTransferAccount();
    signal.throwIfAborted();
    const holdings = await assets.list(account, signal);
    signal.throwIfAborted();
    return {profileId: account.profileId, assets: Object.freeze(holdings.map(asset => Object.freeze({...asset})).sort((a,b) => a.assetId.localeCompare(b.assetId)))};
  }
  async function hydrate() {
    invalidate(); const current=version;
    logoutTarget=undefined;
    update({phase:'loading',error:undefined,logoutBackupAcknowledged:false});
    try {
      const loaded=await readWithRetry(() => readStable(current), operation.signal);
      const profiles=typeof storage.listProfiles==='function'?await storage.listProfiles():{profiles:loaded.account?[loaded.account.profileId]:[],generation:loaded.generation};
      acceptLoaded(loaded, current);
      if(!disposed&&version===current)update({savedProfiles:Object.freeze([...profiles.profiles]),profileChooser:false});
      try {
        if(globalThis.localStorage&&readBoardingRecords(state.profileId).some(r=>r.status==='pending'))scheduleTransferCheck();
      } catch { /* The transfer and clearing guards report corrupt/unavailable storage. */ }
    } catch {if(!disposed&&version===current) fail('load','Your saved account could not be opened. ');}
  }
  let initialization: Promise<void>;
  function activateRestored(account: AccountSecret, current: number) {
    if (disposed || version !== current) return;
    pending=undefined; restorePhrase=undefined; failure=undefined; confirmedProfile=account.profileId;
    update({phase:'active',hasProfile:true,profileId:account.profileId,error:undefined,canReset:true});
    emit({type:'accountConnected',profileId:account.profileId},current);
  }
  async function runRestore(input: string) {
    assertAlive();
    if (!['restore-entry','restore-error'].includes(state.phase) || !validRecovery(input)) return;
    restorePhrase=phraseWords(input).join(' ');
    const current=version;
    update({phase:pending?'restore-saving':'restoring',error:undefined,canReset:true});
    try {
      // Reconcile an uncertain prior save or another tab's account before any new work.
      const loaded=await readStable(current);
      if(disposed||version!==current) return;
      if(loaded.generation!==generation || loaded.account?.profileId!==state.profileId) {
        if(loaded.generation===generation && pending && loaded.account?.profileId===pending.profileId) activateRestored(pending,current);
        else { pending=undefined;restorePhrase=undefined;acceptLoaded(loaded,current); }
        return;
      }
      if(!pending) {
        const restored=await restore(restorePhrase,operation.signal);
        if(disposed||version!==current) return;
        pending=restored;
      }
      const account=pending;
      update({phase:'restore-saving'});
      await storage.save(account,generation,operation.signal);
      if(disposed)return;
      if(version!==current){await initialization;return;}
      const saved=await readStable(current);
      if(disposed||version!==current) return;
      if(saved.generation!==generation || saved.account?.profileId!==account.profileId) {
        pending=undefined;restorePhrase=undefined;acceptLoaded(saved,current);return;
      }
      activateRestored(account,current);
      if(typeof storage.listProfiles==='function')update({savedProfiles:Object.freeze([...(await storage.listProfiles()).profiles]),profileChooser:false});
    } catch {
      if(!disposed&&version===current) update({phase:'restore-error',error:pending?'Your account could not be confirmed saved.':'The test service could not be reached.'});
    }
  }
  let walletRefreshQueued = false;
  let refreshWalletSource = false;
  let foregroundWalletBalance = false;
  let receiptBalanceLoading = false;
  let preserveQueuedBalance = true;
  function walletChanged(profileId: string, refreshSource = true, foregroundBalance = false, sameSnapshot = false) {
    if (disposed || state.profileId !== profileId || state.phase !== 'active') return;
    refreshWalletSource ||= refreshSource;
    foregroundWalletBalance ||= foregroundBalance;
    if (foregroundBalance) receiptBalanceLoading = true;
    const preserveBalance = receiptBalanceLoading && sameSnapshot && !refreshSource && !foregroundBalance && state.balance.status === 'loading';
    preserveQueuedBalance &&= preserveBalance;
    if (walletRefreshQueued) return;
    walletRefreshQueued = true;
    const current = version;
    // Invalidate in-flight pre-change reads before scheduling replacement work.
    if (!preserveBalance) cancelBalance();
    queueMicrotask(() => {
      walletRefreshQueued = false;
      const refresh = refreshWalletSource; refreshWalletSource = false;
      const foreground = foregroundWalletBalance || state.balance.status === 'loading'; foregroundWalletBalance = false;
      const preserveBalance = preserveQueuedBalance; preserveQueuedBalance = true;
      if (disposed || version !== current || state.profileId !== profileId || state.phase !== 'active') return;
      if (balanceVisible(state) && (refresh || foreground && !preserveBalance)) update({balance:idleBalance,addresses:idleAddresses});
      if (!preserveBalance) void refreshBalanceView(!refresh && !foreground);
      if (refresh) void refreshAssetView(true);
      if (refresh) {
        if (sharedWallet) sharedWallet.refresh();
        else void context.refreshActivity();
      }
    });
  }
  function refreshAfterContinue(result: BisContinueResult, current: number) {
    if (result.status !== 'succeeded' || disposed || current !== version || state.profileId !== result.profileId || state.phase !== 'active') return;
    walletChanged(result.profileId);
  }
  const publishedTransferResolutions=new Set<string>();
  async function reconcileAccountTransfers(account:AccountSecret,signal:AbortSignal) {
    const current=version;
    const pending=new Set(readBoardingRecords(account.profileId).filter(record=>record.status==='pending').map(record=>record.id));
    try {return await transfers.reconcile(account,signal);}
    finally {
      // Reconciliation may resolve an older record before a later check fails.
      // Publish only saved outcomes, once, never a provider return value alone.
      if(!disposed&&version===current&&state.profileId===account.profileId&&state.phase==='active') {
        try {
          const completed=readBoardingRecords(account.profileId).filter(record=>pending.has(record.id)&&record.status==='succeeded');
          let changed=false;
          for(const record of completed) {
            const key=JSON.stringify([account.profileId,record.id]);
            if(!publishedTransferResolutions.has(key)){publishedTransferResolutions.add(key);changed=true;}
          }
          if(changed)walletChanged(account.profileId);
        }catch { /* Unreadable persistence cannot establish released inputs. */ }
      }
    }
  }
  async function refreshBalanceView(background = false) {
      assertAlive();
      if(!balanceVisible(state)||(!background && (state.balance.status==='loading'||state.addresses.status==='loading')))return;
      cancelBalance();
      const request=balanceVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=balanceOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===balanceVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && balanceVisible(state);
      const receiving = state.accountReceive;
      if (!background || receiving || state.balance.status !== 'ready') update({balance:receiving ? idleBalance : Object.freeze({status:'loading'}),addresses:receiving ? Object.freeze({status:'loading'}) : idleAddresses});
      let identityReadFailed=false;
      try {
        const result = await readWithRetry(async attemptSignal => {
          let saved: StoredAccount;
          try {saved=await readStable(accountVersion);identityReadFailed=false;}
          catch(error){identityReadFailed=true;throw error;}
          attemptSignal.throwIfAborted();
          if (!saved.account || saved.generation !== accountGeneration || saved.account.profileId !== profileId) {
            if(current()) initialization=hydrate();
            throw new Error('Account changed.');
          }
          return receiving
            ? {addresses:await readAddresses(saved.account, attemptSignal)}
            : {balance:await readBalance(saved.account, attemptSignal)};
        }, signal);
        if(current()) {
          if(result.addresses) update({addresses:Object.freeze({status:'ready',...result.addresses})});
          if(result.balance) update({balance:Object.freeze({status:'ready',...result.balance})});
        }
      } catch {
        if(current() && identityReadFailed) fail('load','Your saved account could not be opened.');
        else if(current()) update(receiving ? {addresses:Object.freeze({status:'unavailable'})} : {balance:Object.freeze({status:'unavailable'})});
      } finally { if(request===balanceVersion) { receiptBalanceLoading = false; cancelBalance(); } }
  }
  const context: BisContext = {
    getContinueRecipient: () => validContinueRecipient(options.continueRecipient) ? options.continueRecipient!.trim() : undefined,
    async getPaymentRecipient() {
      const account = await activeTransferAccount(), current = version;
      const addresses = await readAddresses(account, operation.signal);
      if (disposed || current !== version || state.phase !== 'active' || state.profileId !== account.profileId) throw Error('The player changed.');
      return {profileId:account.profileId, address:addresses.arkadeAddress};
    },
    showToast(message, options) { assertAlive(); toasts.enqueue(message, options); },
    async requestContinue(request) {
      validateContinue(request);
      const input=Object.freeze({operationId:request.operationId,sats:request.sats,context:request.context,...(request.recipient !== undefined ? {recipient:request.recipient} : {})});
      const requestedVersion=version,requestedAccount=await activeTransferAccount();
      // Refresh transfer reservations before selecting payment inputs. Recovery
      // takes its own wallet/record locks, so run it outside the payment lock.
      if(readBoardingRecords(requestedAccount.profileId).some(record=>record.status==='pending')) {
        try {await reconcileAccountTransfers(requestedAccount,operation.signal);}
        catch { /* Unverified transfers keep their reservations. */ }
      }
      return withActiveWalletMutation(async()=>{
        if(requestedVersion!==version||requestedAccount.profileId!==state.profileId)throw Error('The account changed.');
        const account=await activeTransferAccount(),current=version;
        const existing=readContinuations(account.profileId).find(r=>r.request.operationId===input.operationId);
        if(existing) {
          if(existing.request.sats!==input.sats || existing.request.context!==input.context || (input.recipient !== undefined && existing.request.recipient!==input.recipient))throw Error('Continuation identity was reused with changed inputs.');
          const result = await continuation.reconcile(account,existing,operation.signal);
          refreshAfterContinue(result,current);
          return result;
        }
        const recipient = context.getContinueRecipient?.();
        if (!recipient || (input.recipient !== undefined && input.recipient !== recipient)) throw Error('Configure a valid game wallet recipient before paying.');
        const bound = Object.freeze({...input, recipient});
        guardIndependentSpend();
        if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw Error('An asset operation is unresolved.');
        const result = await continuation.submit(account,{request:bound,profileId:account.profileId,status:'pending'},operation.signal,()=>!disposed && current===version && state.profileId===account.profileId && state.phase==='active');
        refreshAfterContinue(result,current);
        return result;
      });
    },
    async getContinueAvailability() {
      // Availability means the player can attempt payment. A withdrawal can
      // temporarily reserve the current inputs; only submission should quote
      // fresh funds and report that failure, rather than disabling B1.
      if(disposed||!state.hasProfile||state.phase!=='active'||!state.profileId)return {canPay:false,reason:'Awaiting Player Wallet'};
      if(!context.getContinueRecipient?.())return {canPay:false,reason:'Awaiting Game Wallet'};
      return {canPay:true};
    },
    async getWalletOperations() {
      const account=await activeTransferAccount(),current=version;
      try {await reconstructWalletReservations(account,operation.signal);}catch {/* Preserve unknown reservations. */}
      const records=walletReservations(account.profileId);
      const operations=records.map(record=>{
        const transfer=record.id.startsWith('transfer:')?readBoardingRecord(account.profileId,record.id.slice(9)):undefined;
        const send=record.id.startsWith('send:')?readSendRecords(account.profileId).find(r=>r.id===record.id.slice(5)):record.id.startsWith('continue:')?readContinuations(account.profileId).find(r=>r.request.operationId===record.id.slice(9))?.send:undefined;
        return {id:record.id,transactionId:send?.transactionId??record.transactionId,direction:transfer?(transfer.quote.direction==='to-arkade'?'Bitcoin → Arkade' as const:'Arkade → Bitcoin' as const):undefined,amountSats:transfer?.quote.amountSats??send?.quote.amountSats,reservedInputSats:transfer?(transfer.quote.inputSats??transfer.quote.maxSats):send?.quote.maxSats,inputsKnown:!!record.inputs?.length,canDiscard:transfer?.phase==='prepared'};
      });
      const outpoints=records.flatMap(r=>r.inputs?.map(i=>`${i.txid}:${i.vout}`)??[]);
      const reservedInputSats=operations.every(op=>op.reservedInputSats!==undefined)&&new Set(outpoints).size===outpoints.length?operations.reduce((sum,op)=>sum+op.reservedInputSats!,0):undefined;
      try {
        const [availableSats,balance]=await Promise.all([loadSendFunds(account,operation.signal,true),readBalance(account,operation.signal)]);
        if(disposed||current!==version)throw Error('Account changed.');
        return {availableSats,totalSats:balance.totalSats,reservedInputSats,operations};
      } catch {return {operations,reason:'Independent spendable funds could not be verified. Receiving and inspection remain available.'};}
    },
    async discardPreparedTransfer(id) {
      await withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount();
        const record=readBoardingRecord(account.profileId,id);
        if(!record||record.status!=='pending'||record.phase!=='prepared')throw Error('Only a draft proven not submitted can be discarded.');
        const {recoverPreparedBoarding}=await import('./boarding-record.ts');
        recoverPreparedBoarding(record);
      });
    },
    async getContinueStatus(operationId) {
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount(),current=version;
        const records=readContinuations(account.profileId).filter(r=>operationId===undefined || r.request.operationId===operationId);
        const results:BisContinueResult[]=[];
        for(const record of records)results.push(await continuation.reconcile(account,record,operation.signal));
        const succeeded = results.find(result=>result.status==='succeeded');
        if(succeeded)refreshAfterContinue(succeeded,current);
        return Object.freeze(results);
      });
    },
    async getSendSpendable() {
      guardIndependentSpend();const account=await activeTransferAccount(),current=version;
      if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw new SendError('An asset operation is unresolved.');
      const amount=await sends.funds(account,operation.signal);
      if(disposed||current!==version)throw new SendError('The account changed.');return amount;
    },
    async quoteAccountSend(recipient,amountSats) {
      issuedSend=undefined;const request=++sendRevision;
      guardIndependentSpend();const account=await activeTransferAccount(),current=version;
      if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw new SendError('An asset operation is unresolved.');
      const quote=await sends.quote(account,recipient,amountSats,operation.signal);
      if(disposed||current!==version||request!==sendRevision)throw new SendError('Send details changed. Review again.');
      issuedSend=Object.freeze({...quote});return issuedSend;
    },
    async confirmAccountSend(quote) {
      assertAlive();
      if(!issuedSend||quote!==issuedSend||quote.expiresAt<=Date.now())throw new SendError('Review a fresh send before confirming.');
      issuedSend=undefined;sendRevision++;
      return withActiveWalletMutation(async()=>{
        guardIndependentSpend();const account=await activeTransferAccount(),current=version;
        if(account.profileId!==quote.profileId)throw new SendError('The account changed.');
        if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw new SendError('An asset operation is unresolved.');
        const result=await sends.submit(account,quote,()=>!disposed&&current===version&&state.profileId===account.profileId&&state.phase==='active');
        if(disposed||current!==version)throw new SendError('The account changed.');
        if(result.status==='succeeded')walletChanged(account.profileId);
        return sendStatus(result);
      });
    },
    async checkAccountSend() {
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount(),current=version;let record,verification:'live'|'unavailable'='live';
        try {record=await sends.reconcile(account,operation.signal);}
        catch {record=readSendRecord(account.profileId);if(!record||record.profileId!==account.profileId)throw new SendError('Send status is unavailable.');verification='unavailable';}
        if(disposed||current!==version)throw new SendError('The account changed.');
        if(verification==='live' && record?.status==='succeeded')walletChanged(account.profileId);
        return sendStatus(record,verification);
      });
    },
    async burnAsset(input) {
      const profileId=state.profileId,current=version;
      const isCurrent=()=>!disposed&&version===current&&state.profileId===profileId&&state.hasProfile&&state.phase==='active';
      try {
        const request=validateBurn(input);
        if(!isCurrent())throw new BurnError('account-changed','An active account is required.');
        return await withActiveWalletMutation(async()=>{
          assertNoPendingSend(profileId);assertNoPendingBoarding(profileId);
          if(readAssetRecords(profileId!).some(record=>record.status==='pending'))throw new BurnError('unavailable','An asset mint is unresolved.');
          const account=await activeTransferAccount();
          if(!isCurrent())throw new BurnError('account-changed','The account changed.');
          const result=await burn(account,request,operation.signal,isCurrent);
          if(!isCurrent())throw new BurnError('account-changed','The account changed during the burn.');
          if(result.status==='burned')walletChanged(account.profileId);
          return result;
        });
      } catch(error) {
        return {status:'error',code:error instanceof BurnError?error.code:'unavailable',message:error instanceof BurnError?error.message:'Burn unavailable. Check spendable funds and pending wallet operations, then try again.'};
      }
    },
    async getMintAvailability() {
      const profileId=state.profileId,current=version;
      try {
        const result=await loadMintAvailability(await activeTransferAccount(),operation.signal);
        return disposed||current!==version||state.profileId!==profileId?{canMint:false,reason:'The player wallet changed.'}:result;
      } catch {return {canMint:false,reason:state.hasProfile?'Mint balance unavailable. Check eligible funds and pending operations.':'Log in to a player wallet first.'};}
    },
    async mintAsset(input) {
      const profileId = state.profileId, current = version;
      let request: BisMintAssetRequest;
      if (disposed) return assetError('disposed', profileId);
      if (!state.hasProfile || state.phase !== 'active') return assetError('account-required');
      try { request = validateMint(input); } catch { return assetError('invalid-input', profileId); }
      if (!globalThis.navigator?.locks) return assetError('unsupported-environment', profileId, request.operationId);
      const isCurrent = () => !disposed && current === version && state.profileId === profileId && state.hasProfile && state.phase === 'active';
      try {
        return await withActiveWalletMutation(async () => {
          eligibleUnreservedCoins([],walletReservations(profileId!));
          const account = await activeTransferAccount();
          if (!isCurrent()) return assetError('account-changed', profileId, request.operationId);
          const result = await assets.mint(account, request, operation.signal, isCurrent);
          if(isCurrent() && (result.status==='minted' || result.status==='already-minted'))walletChanged(account.profileId);
          return isCurrent() ? result : assetError(disposed ? 'disposed' : 'account-changed', profileId, request.operationId);
        });
      } catch (error) { return assetError(error instanceof AssetError ? error.code : error instanceof BoardingBlockedError ? 'busy' : !isCurrent() ? (disposed ? 'disposed' : 'account-changed') : 'unavailable', profileId, request.operationId); }
    },
    async listAssets() {
      const profileId = state.profileId, current = version;
      if (disposed) return assetError('disposed', profileId);
      if (!state.hasProfile || state.phase !== 'active') return assetError('account-required');
      try {
        const result = await readAssetSnapshot(operation.signal);
        if (disposed || current !== version || profileId !== state.profileId) return assetError(disposed ? 'disposed' : 'account-changed', profileId);
        return {status: 'success', ...result};
      } catch { return assetError(disposed ? 'disposed' : current !== version ? 'account-changed' : 'unavailable', profileId); }
    },
    async getPendingAssetMint() {
      const profileId = state.profileId, current = version;
      if (disposed) return assetError('disposed', profileId);
      if (!state.hasProfile || state.phase !== 'active') return assetError('account-required');
      try {
        const account = await activeTransferAccount();
        if (disposed || current !== version) return assetError('account-changed', profileId);
        return {status: 'success', profileId: account.profileId, request: readAssetRecords(account.profileId).find(r => r.status === 'pending')?.request ?? null};
      } catch { return assetError('outcome-unknown', profileId); }
    },
    getState:()=>state,
    subscribe(listener) {assertAlive();listeners.add(listener);return ()=>{listeners.delete(listener);};},
    onEvent(listener) {assertAlive();events.add(listener);return ()=>{events.delete(listener);};},
    ready:()=>initialization,
    openAccountDialog() {assertAlive();if(state.view==='account') return;previous=state.view;update({view:'account'});if(state.phase==='error'&&!state.error)initialization=hydrate();},
    openAccountReceive() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountReceive) update({accountReceive:true,accountSend:false,accountTransfer:false,accountDetails:false,accountActivity:false,accountRecovery:false});
    },
    openAccountSend() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountSend) update({accountSend:true,accountReceive:false,accountTransfer:false,accountDetails:false,accountActivity:false,accountRecovery:false});
    },
    async quoteAccountTransfer(amountSats, direction='to-arkade') {
      guardIndependentSpend();
      const account=await activeTransferAccount();
      const accountVersion=version;
      const quote=await transfers.quote(account,amountSats,operation.signal,direction);
      if(disposed||accountVersion!==version||account.profileId!==state.profileId)throw Error('The account changed.');
      return quote;
    },
    getPendingAccountTransfers() {
      assertAlive();
      return readBoardingRecords(state.profileId).filter(r=>r.status==='pending').map(r=>transferStatus(r));
    },
    async confirmAccountTransfer(quote, acknowledgedPendingIds=[]) {
      if (!boardingSubmissionEnabled) throw Error('Transfer submission is disabled until interrupted-transfer recovery is verified.');
      return withActiveWalletMutation(async()=>{
        guardIndependentSpend();
        assertPendingTransfersAcknowledged(state.profileId,acknowledgedPendingIds);
        const account=await activeTransferAccount();
        const current=version;
        const record=await transfers.submit(account,quote,()=>!disposed && version===current && state.profileId===account.profileId);
        if(disposed||current!==version||account.profileId!==state.profileId)throw Error('The account changed.');
        scheduleTransferCheck();
        if(record?.status==='succeeded')walletChanged(account.profileId);
        return transferStatus(record);
      });
    },
    async checkAccountTransfer() {
      {
        const account=await activeTransferAccount();
        const current=version;
        let record:BoardingRecord|undefined;
        let verification:'live'|'unavailable'='live';
        try {record=await reconcileAccountTransfers(account,operation.signal);}
        catch {
          // A network failure must not hide the durable operation on first open.
          record=readBoardingRecords(account.profileId).find(r=>r.status==='pending')??readBoardingRecord(account.profileId);
          if(!record||record.profileId!==account.profileId||record.status!=='pending')throw Error('Transfer status could not be verified. Try Check Status again.');
          verification='unavailable';
        }
        if(disposed||current!==version||account.profileId!==state.profileId)throw Error('The account changed.');
        return transferStatus(record,verification);
      }
    },
    openAccountTransfer() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountTransfer) update({accountDetails:false,accountActivity:false,accountRecovery:false,accountReceive:false,accountSend:false,accountTransfer:true});
    },
    openAccountDetails() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountDetails) update({accountTransfer:false,accountDetails:true,accountActivity:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
    openAccountOnboarding(){
      assertAlive();if(state.view==='account'&&state.phase==='active'&&state.hasProfile)update({accountOnboarding:true,accountDetails:false,accountAssets:false,accountContracts:false,accountActivity:false,accountTransfer:false,accountReceive:false,accountSend:false,accountRecovery:false});
    },
    refreshOnboarding(){assertAlive();onboardingWorker?.refresh();},
    async checkContracts(filter) {
      const profileId=state.profileId;
      const result=await (contractController(context)?.checkContracts?.(filter)??queryAccountContracts(profileId,filter));
      return !disposed&&state.profileId===profileId?result:{status:'unavailable',contracts:[]};
    },
    openAccountContracts() {
      assertAlive();
      if(state.view==='account'&&state.phase==='active'&&state.hasProfile)update({accountContracts:true,accountAssets:false,accountActivity:false,accountTransfer:false,accountDetails:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
    claimContract: id=>contractController(context)?.claim(id)??Promise.resolve({status:'unavailable'}),
    rejectContract: id=>contractController(context)?.reject(id)??Promise.resolve({status:'unavailable'}),
    refundContract: id=>contractController(context)?.refund(id)??Promise.resolve({status:'unavailable'}),
    openAccountActivity() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountActivity) update({accountActivity:true,accountTransfer:false,accountDetails:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
    openAccountAssets() {
      assertAlive();
      if (state.view === 'account' && state.phase === 'active' && state.hasProfile && !state.accountAssets) {
        update({accountAssets:true,accountActivity:false,accountTransfer:false,accountDetails:false,accountRecovery:false,accountReceive:false,accountSend:false});
      }
    },
    async refreshAssets() {
      assertAlive();
      return refreshAssetView();
    },
    openAccountRecovery() {
      assertAlive();
      if (state.view !== 'account' || !state.hasProfile || state.accountRecovery || !['active','logout-confirmation','logout-error'].includes(state.phase)) return;
      recoveryReturn = { phase: state.phase, accountDetails: state.accountDetails, error: state.error };
      clearRecovery();
      update({accountRecovery:true,accountTransfer:false,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,recoveryStatus:'hidden',error:undefined,logoutBackupAcknowledged:false});
    },
    async refreshActivity() {
      assertAlive();
      if(!activityVisible(state) || state.activity.status==='loading') return;
      if (state.activity.status !== 'idle') sharedWallet?.refresh();
      cancelActivity();
      const request=activityVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=activityOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===activityVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && activityVisible(state);
      const withOperations=(rows:readonly BisTransaction[])=>globalThis.localStorage
        ? withSendActivity(withMintActivity(readBoardingRecords(profileId).reduce((items,record)=>withTransferActivity(items,record,profileId!),rows),readAssetRecords(profileId!)),readSendRecord(profileId),profileId!) : rows;
      let lastTransactions: readonly BisTransaction[] = state.activity.status === 'ready' || state.activity.status === 'unavailable' ? state.activity.transactions ?? [] : [];
      const unavailable=()=>{
        let transactions:readonly BisTransaction[]=lastTransactions;
        try {transactions=withOperations(lastTransactions);}catch {/* Unreadable journals are not transaction evidence. */}
        update({activity:Object.freeze({status:'unavailable',...(transactions.length?{transactions}:{})})});
      };
      update({activity:Object.freeze({status:'loading'})});
      for(let attempt=0; attempt<2 && current(); attempt++) {
        const stream = new AbortController();
        const abort = () => stream.abort();
        signal.addEventListener('abort',abort,{once:true});
        let first = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let observer: Promise<void> = Promise.resolve();
        let rejectFirst: (error: unknown) => void = () => {};
        const interrupted = () => rejectFirst(new Error('History read cancelled.'));
        stream.signal.addEventListener('abort',interrupted,{once:true});
        try {
          await new Promise<void>((resolve,reject) => {
            rejectFirst=reject;
            timer=setTimeout(()=>reject(new Error('History read timed out.')),75000);
            observer=(async()=>{
              const saved=await readStable(accountVersion);
              if(!current() || stream.signal.aborted)return;
              if(!saved.account || saved.generation!==accountGeneration || saved.account.profileId!==profileId) {initialization=hydrate();return;}
              await observeActivity(saved.account,stream.signal,transactions=>{
                if(current() && !stream.signal.aborted) {
                  const rows=withOperations(Object.freeze(transactions.map(t=>Object.freeze({...t}))));
                  lastTransactions=rows;first=true;clearTimeout(timer);
                  update({activity:Object.freeze({status:'ready',transactions:rows})});
                  resolve();
                }
              });
              if(!first)reject(new Error('History ended without a result.'));
            })();
            observer.catch(reject);
          });
          clearTimeout(timer);
          // Readiness is the first snapshot, while this method retains its observation lifetime.
          await observer;
          return;
        } catch {
          if(current() && (first || attempt===1)) {unavailable();return;}
        } finally {
          clearTimeout(timer);stream.signal.removeEventListener('abort',interrupted);
          signal.removeEventListener('abort',abort);stream.abort();
        }
      }
    },
    refreshBalance: () => refreshBalanceView(),
    openProfileChooser(){
      assertAlive();if(state.phase!=='active'&&state.phase!=='idle')return;
      context.openAccountDialog();
      update({profileChooser:true,accountOnboarding:false,accountContracts:false,accountTransfer:false,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,accountAssets:false,accountRecovery:false});
    },
    async selectProfile(profileId){
      assertAlive();
      if(!state.savedProfiles.includes(profileId)||typeof storage.selectProfile!=='function')throw Error('Select a saved profile.');
      if(state.profileId===profileId){update({profileChooser:false});return;}
      const current=version,expected=generation;
      await storage.selectProfile(profileId,expected,operation.signal);
      if(disposed)return;
      if(version!==current){await initialization;return;}
      initialization=hydrate();await initialization;
    },
    openRestoreAccount() {
      assertAlive();if(!['idle','active'].includes(state.phase)||state.hasProfile&&!state.profileChooser)return;
      context.openAccountDialog();invalidate();failure=undefined;
      update({phase:'restore-entry',error:undefined,canReset:true});
    },
    closeAccount() {
      assertAlive();if(state.view!=='account'||state.phase==='resetting'||state.phase==='logging-out'||state.phase==='restore-saving') return;
      if(state.accountOnboarding){context.openAccountDetails();return;}
      if(state.accountContracts) {update({accountContracts:false,accountDetails:true});return;}
      if(state.accountTransfer) {context.openAccountDetails();return;}
      if(state.accountRecovery) {update({accountRecovery:false,...recoveryReturn});return;}
      if(state.accountReceive || state.accountSend) {update({accountReceive:false,accountSend:false});return;}
      if(state.accountAssets) {update({accountAssets:false});return;}
      if(state.accountActivity) {update({accountActivity:false});return;}
      if(state.accountDetails) {update({accountTransfer:false,accountDetails:false});return;}
      if(['restore-entry','restoring','restore-error'].includes(state.phase)) {
        invalidate();initialization=hydrate();return;
      }
      if(state.phase==='logout-confirmation'||state.phase==='logout-error') {context.cancelLogout();return;}
      if(pending||state.phase==='creating'||state.phase==='saving'||failure==='create'||failure==='save') {
        invalidate();failure=undefined;update({phase:'idle',error:undefined,canReset:false});
        // A cancelled commit might already be durable; reconcile before another creation.
        initialization=hydrate();return;
      }
      update({view:previous});
    },
    async createAccount() {
      assertAlive();if(!['idle','active'].includes(state.phase)||state.hasProfile&&!state.profileChooser) return;
      const current=++version;operation.abort();operation=new AbortController();
      update({phase:'creating',canReset:true,error:undefined});
      try {
        const account=await create(operation.signal);
        if(disposed||version!==current)return;
        pending=account;update({phase:'recovery'});
      }catch {if(!disposed&&version===current)fail('create','The test account could not be created.');}
    },
    async continueAccount() {
      assertAlive();if(!pending || (state.phase!=='recovery' && !(state.phase==='error'&&failure==='save'))) return;
      const current=version;const account=pending;
      update({phase:'saving',error:undefined});
      try {
        await storage.save(account,generation,operation.signal);
        if(disposed)return;
        if(version!==current){await initialization;return;}
        pending=undefined;failure=undefined;
        confirmedProfile=account.profileId;
        update({phase:'active',hasProfile:true,profileId:account.profileId,error:undefined,canReset:true});
        if(typeof storage.listProfiles==='function')update({savedProfiles:Object.freeze([...(await storage.listProfiles()).profiles]),profileChooser:false});
        emit({type:'accountConnected',profileId:account.profileId},current);
      }catch {if(!disposed&&version===current)fail('save','Your account could not be saved.');}
    },
    openLogoutConfirmation() {
      assertAlive();
      if (state.phase !== 'active' || !state.profileId) return;
      context.openAccountDialog();
      logoutTarget = {profileId:state.profileId!,generation};
      try {
        logoutOperations=pendingLogoutOperations(globalThis.localStorage,state.profileId);
        update({phase:'logout-confirmation',accountRecovery:false,logoutBackupAcknowledged:false,logoutPendingAcknowledged:false,logoutPendingCount:logoutOperations.count,error:undefined});
      } catch {
        logoutOperations=undefined;
        update({phase:'logout-confirmation',accountRecovery:false,logoutBackupAcknowledged:false,logoutPendingAcknowledged:false,logoutPendingCount:null,error:'Pending transactions could not be counted. You can still log out; locally saved transaction records will be removed.'});
      }
    },
    setLogoutBackupAcknowledged(acknowledged) {
      assertAlive();
      if (!state.accountRecovery && (state.phase === 'logout-confirmation' || state.phase === 'logout-error')) update({logoutBackupAcknowledged:acknowledged === true});
    },
    setLogoutPendingAcknowledged(acknowledged) {
      assertAlive();
      if (!state.accountRecovery && ['logout-confirmation','logout-error'].includes(state.phase) && state.logoutPendingCount !== null && state.logoutPendingCount > 0) update({logoutPendingAcknowledged:acknowledged === true});
    },
    cancelLogout() {
      assertAlive();
      if (state.phase === 'logout-error') { initialization=hydrate();return; }
      if (state.phase !== 'logout-confirmation') return;
      logoutTarget=undefined;
      update({phase:'active',accountRecovery:false,logoutBackupAcknowledged:false,error:undefined});
    },
    async confirmLogout() {
      assertAlive();
      if (state.accountRecovery || !logoutTarget || !state.logoutBackupAcknowledged || !['logout-confirmation','logout-error'].includes(state.phase)) return;
      if (state.logoutPendingCount !== null && state.logoutPendingCount > 0 && !state.logoutPendingAcknowledged) return;
      // Logout clears identity and player transaction records after acknowledgement.
      const target=logoutTarget;
      const approvedOperations=logoutOperations;
      invalidate(); const current=version;
      update({phase:'logging-out',error:undefined});
      try {
        const loaded=await readStable(current);
        if (disposed || version!==current) return;
        if (!loaded.account || loaded.generation!==target.generation || loaded.account.profileId!==target.profileId) {
          acceptLoaded(loaded,current,true); return;
        }
        await storage.reset(target.generation, {purpose:'logout',profileId:target.profileId,operations:approvedOperations ?? {count:0,fingerprint:''}});
        if (disposed || version!==current) return;
        const after=await readStable(current);
        if (disposed || version!==current) return;
        if (after.account?.profileId===target.profileId && after.generation===target.generation) throw new Error('Clearing not confirmed.');
        acceptLoaded(after,current,true);
        if(typeof storage.listProfiles==='function')update({savedProfiles:Object.freeze([...(await storage.listProfiles()).profiles]),profileChooser:false});
      } catch (error) {
        if (!disposed && version===current) {
          try {logoutOperations=pendingLogoutOperations(globalThis.localStorage,target.profileId);} catch {logoutOperations=undefined;}
          update({phase:'logout-error',logoutPendingCount:logoutOperations?.count ?? null,logoutPendingAcknowledged:logoutOperations?.fingerprint === approvedOperations?.fingerprint && state.logoutPendingAcknowledged,error:error instanceof BoardingBlockedError ? error.message : 'Log out did not finish. Browser cleanup could not be confirmed.'});
        }
      }
    },
    async retry() {
      assertAlive();if(state.phase==='restore-error'&&restorePhrase){await runRestore(restorePhrase);return;}
      assertAlive();if(state.phase==='logout-error'){await context.confirmLogout();return;}
      assertAlive();if(state.phase!=='error')return;
      if(failure==='load'){initialization=hydrate();await initialization;}
      else if(failure==='save')await context.continueAccount();
      else {failure=undefined;update({phase:'idle',error:undefined});await context.createAccount();}
    },
    dispose() {if(disposed)return;onboardingOperation.abort();paymentOperation.abort();clearTimeout(paymentRetry);clearTimeout(transferTimer);transferTimer=undefined;toasts.dispose();clearRecovery();update({view:'empty',accountRecovery:false});cancelActivity();cancelBalance();state=Object.freeze({...state,balance:idleBalance,addresses:idleAddresses,activity:idleActivity,accountActivity:false});disposed=true;invalidate();unsubscribeStorage();listeners.clear();events.clear();},
  };
  controls.set(context,{
    toasts,
    dismissOperationError() {
      if(state.view==='account')context.closeAccount();
      else update({error:undefined});
    },
    assetSession: () => assetVersion,
    hideAssets(session) { if (!disposed && state.accountAssets && (session === undefined || session === assetVersion)) update({accountAssets:false}); },
    assertAlive,
    async fundingAddress() {
      assertAlive();
      if (!state.hasProfile || state.phase !== 'active') throw new Error('An active account is required.');
      const current = version, profileId = state.profileId, expectedGeneration = generation;
      const loaded = await readStable(current);
      const valid = () => !disposed && version === current && state.profileId === profileId && state.phase === 'active';
      if (!valid() || !loaded.account || loaded.account.profileId !== profileId || loaded.generation !== expectedGeneration) throw new Error('Account changed.');
      const addresses = await readAddresses(loaded.account, operation.signal);
      if (!valid()) throw new Error('Account changed.');
      return addresses.bitcoinAddress;
    },
    async fund() {
      assertAlive();
      if (funding !== undefined) throw new Error('Funding request already in progress.');
      if (!state.hasProfile || state.phase !== 'active') throw new Error('An active account is required.');
      const current = version, profileId = state.profileId, expectedGeneration = generation;
      const isCurrent = () => !disposed && version === current && state.profileId === profileId && state.phase === 'active';
      funding = current;
      try {
        const loaded = await readStable(current);
        if (!isCurrent() || !loaded.account || loaded.account.profileId !== profileId || loaded.generation !== expectedGeneration) throw new Error('Account changed.');
        await fund(loaded.account, operation.signal, isCurrent);
        if (!isCurrent()) throw new Error('Account changed.');
        return 'Funding request accepted for 1000 Signet sats. Refresh Account Details to check receipt.';
      } catch {
        throw new Error('Funding was not confirmed. The faucet may be unavailable or the account changed. Check Account Details before trying again.');
      } finally { if (funding === current) funding = undefined; }
    },
    restore:runRestore,
    recovery:()=>state.accountRecovery && state.recoveryStatus === 'ready' ? revealedPhrase : pending?.phrase,
    hideRecovery() {
      clearRecovery();
      if (state.recoveryStatus !== 'hidden') update({recoveryStatus:'hidden'});
    },
    async revealRecovery() {
      assertAlive();
      if (!state.accountRecovery || !['hidden','unavailable'].includes(state.recoveryStatus)) return;
      const request = ++recoveryVersion, accountVersion = version, profileId = state.profileId, expectedGeneration = generation;
      const current = () => !disposed && request === recoveryVersion && version === accountVersion && state.accountRecovery && state.profileId === profileId;
      update({recoveryStatus:'loading'});
      try {
        const loaded = await readWithRetry(() => readStable(accountVersion), AbortSignal.any([operation.signal,recoveryOperation.signal]));
        if (!current()) return;
        if (!loaded.account || loaded.account.profileId !== profileId || loaded.generation !== expectedGeneration) {initialization=hydrate();return;}
        revealedPhrase = loaded.account.phrase;
        update({recoveryStatus:'ready'});
      } catch { if(current()) update({recoveryStatus:'unavailable'}); }
    },
    present() {assertAlive();if(state.view!=='account')update({view:'account-button'});},
    async reset() {
      assertAlive();if(state.phase==='resetting')return;
      guardSend();
      if(state.profileId&&globalThis.localStorage&&readAccountOnboarding(state.profileId).some(r=>r.status==='pending'))throw new BoardingBlockedError('Onboarding is unresolved. Open Account → Balance → Onboarding before resetting this account.');
      invalidate();logoutTarget=undefined;update({phase:'resetting',error:undefined,logoutBackupAcknowledged:false});
      try {await storage.reset();if(disposed)return;previous='empty';update({view:'empty'});initialization=hydrate();await initialization;}
      catch (error) {const message=error instanceof BoardingBlockedError?error.message:'Reset did not finish. Your account has not been confirmed cleared.';if(!disposed)fail('load',message);throw new Error(message);}
    },
  });
  const unsubscribeStorage=storage.subscribe(()=> {
    storageRevision++;
    if(!disposed&&!['resetting','logging-out','logout-error'].includes(state.phase)){initialization=hydrate();}
  });
  initialization=hydrate();
  return context;
}
export function createBisContext(options: {continueRecipient?: string} = {}): BisContext {return createContext(createAccountStorage(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, options);}
export function createBisAdminContext(context: BisContext) {
  const internal=getControls(context);internal.assertAlive();
  return Object.freeze({resetClient:()=>internal.reset(), fund1000Sats:()=>internal.fund(), getFundingAddress:()=>internal.fundingAddress()});
}

