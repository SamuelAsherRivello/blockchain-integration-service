import {submitContinuation,reconcileContinuation} from '../arkade/continuation.ts';
import {validateContinue,readContinuations,type BisContinueRequest,type BisContinueResult} from './continuation.ts';
import { readWithRetry } from './pending-read.ts';
import { watchActivity } from '../arkade/activity.ts';
import { pendingLogoutOperations, type LogoutOperations } from './logout-cleanup.ts';
import { loadSendFunds, quoteSend, submitSend, reconcileSend } from '../arkade/sending.ts';
import { assertNoPendingSend, readSendRecord, sendStatus, SendError, type BisSendQuote, type BisSendStatus } from './sending.ts';
import { listWalletAssets, mintWalletAsset, burnWalletAsset } from '../arkade/assets.ts';
import { assertNoPendingBurn, BurnError, validateBurn, type BisBurnAssetRequest, type BisBurnAssetResult } from './burning.ts';
import type { BisAssets } from './asset-presentation';
import { AssetError, assetError, validateMint, readAssetRecords, type BisMintAssetRequest, type BisMintAssetResult, type BisListAssetsResult, type BisPendingMintResult } from './assets.ts';
import { quoteBoarding, submitBoarding, reconcileBoarding } from '../arkade/boarding.ts';
import { assertNoPendingBoarding, withWalletMutation, BoardingBlockedError, readBoardingRecord } from './boarding-record.ts';
import { boardingSubmissionEnabled, type BoardingQuote } from './boarding-quote.ts';
import { transferStatus } from './boarding-status.ts';
import type { BoardingRecord } from './boarding-record.ts';
export type BisTransferStatus = Readonly<{status:'idle'|'pending'|'succeeded'|'not-submitted'; amountSats?:number; commitmentTxid?:string; operationId?:string; intentId?:string; direction?:BoardingQuote['direction']; phase?:BoardingRecord['phase']; diagnostic?:BoardingRecord['diagnostic']; verification?:'live'|'unavailable'}>;
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
  assets: BisAssets;
  activity: BisActivity;
}>;
export type BisEvent = Readonly<{ type: 'accountConnected' | 'accountDisconnected'; profileId: string }>;
export interface BisContext {
  requestContinue(request:BisContinueRequest):Promise<BisContinueResult>;
  getContinueStatus(operationId?:string):Promise<readonly BisContinueResult[]>;
  burnAsset(request:BisBurnAssetRequest):Promise<BisBurnAssetResult>;
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
  confirmAccountTransfer(quote: BoardingQuote): Promise<BisTransferStatus>;
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
type Controls = { dismissOperationError(): void; assetSession(): number; hideAssets(session?: number): void; present(): void; reset(): Promise<void>; fund(): Promise<string>; fundingAddress(): Promise<string>; assertAlive(): void; recovery(): string | undefined; revealRecovery(): Promise<void>; hideRecovery(): void; restore(phrase: string): Promise<void> };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
// Private dependency seam for isolated tests; not exported by the package.
export function createContext(storage: AccountStorage, create = createAccount, identifyAccount = identify, restore = restoreAccount, readBalance: (account: AccountSecret, signal: AbortSignal) => Promise<BalanceAmounts> = loadBalance, fund = fundTestAccount, readAddresses: (account: AccountSecret, signal: AbortSignal) => Promise<AccountAddresses> = loadAddresses, observeActivity: typeof watchActivity = watchActivity, transfers = {quote:quoteBoarding,submit:submitBoarding,reconcile:reconcileBoarding}, assets = {list: listWalletAssets, mint: mintWalletAsset}, sends={funds:loadSendFunds,quote:quoteSend,submit:submitSend,reconcile:reconcileSend}, burn=burnWalletAsset, continuation={submit:submitContinuation,reconcile:reconcileContinuation}): BisContext {
  let issuedSend:BisSendQuote|undefined,sendRevision=0;
  const guardSend=()=>{if(globalThis.localStorage){assertNoPendingSend(state.profileId);assertNoPendingBurn(state.profileId);}};
  const idleAssets: BisAssets = Object.freeze({status:'idle'});
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
  let state: BisState = Object.freeze({view:'empty',hasProfile:false,phase:'loading',canReset:false,logoutBackupAcknowledged:false,logoutPendingCount:0,logoutPendingAcknowledged:false,balance:idleBalance,addresses:idleAddresses,invoiceReceiving:unavailableInvoiceReceiving,accountTransfer:false,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,accountAssets:false,assets:idleAssets,activity:idleActivity,accountRecovery:false,recoveryStatus:'hidden'});
  let revealedPhrase: string | undefined;
  let recoveryVersion = 0;
  let recoveryOperation = new AbortController();
  let recoveryReturn: { phase: BisState['phase']; accountDetails?: boolean; error?: string } = { phase: 'active' };
  const clearRecovery = () => { revealedPhrase = undefined; recoveryVersion++; recoveryOperation.abort(); recoveryOperation=new AbortController(); };
  let previous: BisState['view'] = 'empty';
  let disposed = false, version = 0, generation = 0;
  let funding: number | undefined;
  let pending: AccountSecret | undefined;
  let restorePhrase: string | undefined;
  let operation = new AbortController();
  let failure: 'load' | 'create' | 'save' | undefined;
  let confirmedProfile: string | undefined;
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
    if (!assetsVisible(state) || enteringAssets) { cancelAssets(); state = Object.freeze({...state, assets:idleAssets}); }
    if (enteringAssets) queueMicrotask(() => { if (!disposed && assetsVisible(state) && state.assets.status === 'idle') void context.refreshAssets(); });
    const enteringActivity = activityVisible(state) && (!activityVisible(before) || before.profileId !== state.profileId);
    if (!activityVisible(state) || enteringActivity) { cancelActivity(); state=Object.freeze({...state,activity:idleActivity}); }
    const entering=balanceVisible(state) && (!balanceVisible(before) || before.accountReceive!==state.accountReceive || before.accountTransfer!==state.accountTransfer || before.profileId!==state.profileId);
    if (!balanceVisible(state) || entering) {
      cancelBalance();
      state=Object.freeze({...state,balance:idleBalance,addresses:idleAddresses});
    }
    if (enteringActivity) queueMicrotask(() => { if (!disposed && activityVisible(state) && state.activity.status === 'idle') void context.refreshActivity(); });
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
    if(entering) queueMicrotask(()=>{if(!disposed && balanceVisible(state) && state.balance.status==='idle' && state.addresses.status==='idle') void context.refreshBalance();});
  };
  const invalidate = () => {issuedSend=undefined;sendRevision++;version++;operation.abort();operation=new AbortController();pending=undefined;restorePhrase=undefined;funding=undefined;};
  const fail = (kind: typeof failure, error: string) => {failure=kind;update({phase:'error',error,canReset:true});};
  const emit = (event: BisEvent, current: number) => {
    for (const listener of [...events]) {
      if (disposed || current !== version) break;
      if (events.has(listener)) listener(Object.freeze(event));
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
    confirmedProfile = loaded.account?.profileId;
    generation = loaded.generation; failure = undefined; logoutTarget = undefined;
    update({...(closeOnAbsence && !loaded.account ? {view:previous} : {}),phase:loaded.account?'active':'idle',hasProfile:!!loaded.account,profileId:loaded.account?.profileId,canReset:!!loaded.account,error:undefined,logoutBackupAcknowledged:false});
    if (former && !loaded.account) emit({type:'accountDisconnected',profileId:former}, current);
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
      acceptLoaded(await readWithRetry(() => readStable(current), operation.signal), current);
      try {
        const record=globalThis.localStorage ? readBoardingRecord(state.profileId) : undefined;
        if(record?.status==='pending' && record.profileId===state.profileId)void context.checkAccountTransfer().catch(()=>{});
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
    if (!['restore-entry','restore-error'].includes(state.phase) || state.hasProfile || !validRecovery(input)) return;
    restorePhrase=phraseWords(input).join(' ');
    const current=version;
    update({phase:pending?'restore-saving':'restoring',error:undefined,canReset:true});
    try {
      // Reconcile an uncertain prior save or another tab's account before any new work.
      const loaded=await readStable(current);
      if(disposed||version!==current) return;
      if(loaded.generation!==generation || loaded.account) {
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
      if(disposed||version!==current) return;
      const saved=await readStable(current);
      if(disposed||version!==current) return;
      if(saved.generation!==generation || saved.account?.profileId!==account.profileId) {
        pending=undefined;restorePhrase=undefined;acceptLoaded(saved,current);return;
      }
      activateRestored(account,current);
    } catch {
      if(!disposed&&version===current) update({phase:'restore-error',error:pending?'Your account could not be confirmed saved.':'The test service could not be reached.'});
    }
  }
  const context: BisContext = {
    async requestContinue(request) {
      validateContinue(request);
      const input=Object.freeze({operationId:request.operationId,sats:request.sats,context:request.context});
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount(),current=version;
        const existing=readContinuations(account.profileId).find(r=>r.request.operationId===input.operationId);
        if(existing) {
          if(existing.request.sats!==input.sats || existing.request.context!==input.context)throw Error('Continuation identity was reused with changed inputs.');
          return continuation.reconcile(account,existing,operation.signal);
        }
        guardSend();assertNoPendingBoarding(account.profileId);
        if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw Error('An asset operation is unresolved.');
        return continuation.submit(account,{request:input,profileId:account.profileId,status:'pending'},operation.signal,()=>!disposed && current===version && state.profileId===account.profileId && state.phase==='active');
      });
    },
    async getContinueStatus(operationId) {
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount();
        const records=readContinuations(account.profileId).filter(r=>operationId===undefined || r.request.operationId===operationId);
        const results:BisContinueResult[]=[];
        for(const record of records)results.push(await continuation.reconcile(account,record,operation.signal));
        return Object.freeze(results);
      });
    },
    async getSendSpendable() {
      guardSend();assertNoPendingBoarding(state.profileId);const account=await activeTransferAccount(),current=version;
      if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw new SendError('An asset operation is unresolved.');
      const amount=await sends.funds(account,operation.signal);
      if(disposed||current!==version)throw new SendError('The account changed.');return amount;
    },
    async quoteAccountSend(recipient,amountSats) {
      issuedSend=undefined;const request=++sendRevision;
      guardSend();assertNoPendingBoarding(state.profileId);const account=await activeTransferAccount(),current=version;
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
        guardSend();assertNoPendingBoarding(state.profileId);const account=await activeTransferAccount(),current=version;
        if(account.profileId!==quote.profileId)throw new SendError('The account changed.');
        if(readAssetRecords(account.profileId).some(r=>r.status==='pending'))throw new SendError('An asset operation is unresolved.');
        const result=await sends.submit(account,quote,()=>!disposed&&current===version&&state.profileId===account.profileId&&state.phase==='active');
        if(disposed||current!==version)throw new SendError('The account changed.');
        if(result.status==='succeeded'){void context.refreshBalance();void context.refreshActivity();}
        return sendStatus(result);
      });
    },
    async checkAccountSend() {
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount(),current=version;let record,verification:'live'|'unavailable'='live';
        try {record=await sends.reconcile(account,operation.signal);}
        catch {record=readSendRecord(account.profileId);if(!record||record.profileId!==account.profileId)throw new SendError('Send status is unavailable.');verification='unavailable';}
        if(disposed||current!==version)throw new SendError('The account changed.');
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
          return result;
        });
      } catch(error) {
        return {status:'error',code:error instanceof BurnError?error.code:'unavailable',message:error instanceof BurnError?error.message:'Burn unavailable. Check spendable funds and pending wallet operations, then try again.'};
      }
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
          guardSend();
          assertNoPendingBoarding(state.profileId);
          const account = await activeTransferAccount();
          if (!isCurrent()) return assetError('account-changed', profileId, request.operationId);
          const result = await assets.mint(account, request, operation.signal, isCurrent);
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
      guardSend();
      assertNoPendingBoarding(state.profileId);
      const account=await activeTransferAccount();
      const accountVersion=version;
      const quote=await transfers.quote(account,amountSats,operation.signal,direction);
      if(disposed||accountVersion!==version||account.profileId!==state.profileId)throw Error('The account changed.');
      return quote;
    },
    async confirmAccountTransfer(quote) {
      if (!boardingSubmissionEnabled) throw Error('Transfer submission is disabled until interrupted-transfer recovery is verified.');
      return withActiveWalletMutation(async()=>{
        guardSend();
        assertNoPendingBoarding(state.profileId);
        const account=await activeTransferAccount();
        const current=version;
        const record=await transfers.submit(account,quote,()=>!disposed && version===current && state.profileId===account.profileId);
        if(disposed||current!==version||account.profileId!==state.profileId)throw Error('The account changed.');
        return transferStatus(record);
      });
    },
    async checkAccountTransfer() {
      return withActiveWalletMutation(async()=>{
        const account=await activeTransferAccount();
        const current=version;
        let record:BoardingRecord|undefined;
        let verification:'live'|'unavailable'='live';
        try {record=await transfers.reconcile(account,operation.signal);}
        catch {
          // A network failure must not hide the durable operation on first open.
          record=readBoardingRecord(account.profileId);
          if(!record||record.profileId!==account.profileId||record.status!=='pending')throw Error('Transfer status could not be verified. Try Check Status again.');
          verification='unavailable';
        }
        if(disposed||current!==version||account.profileId!==state.profileId)throw Error('The account changed.');
        // Reconciliation is background-safe; foreground callers own their covered refresh.
        return transferStatus(record,verification);
      });
    },
    openAccountTransfer() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountTransfer) update({accountDetails:false,accountActivity:false,accountRecovery:false,accountReceive:false,accountSend:false,accountTransfer:true});
    },
    openAccountDetails() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountDetails) update({accountTransfer:false,accountDetails:true,accountActivity:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
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
      if (!assetsVisible(state) || state.assets.status === 'loading') return;
      cancelAssets();
      const request = assetVersion, accountVersion = version, profileId = state.profileId;
      const signal = assetOperation.signal;
      const current = () => !disposed && !signal.aborted && request === assetVersion && accountVersion === version && profileId === state.profileId && assetsVisible(state);
      update({assets:Object.freeze({status:'loading'})});
      try {
        const result = await readWithRetry(readAssetSnapshot, signal);
        if (current()) update({assets:Object.freeze({status:'ready',assets:result.assets})});
      } catch {
        if (current()) update({assets:Object.freeze({status:'unavailable'})});
      } finally {
        if (request === assetVersion) cancelAssets();
      }
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
      cancelActivity();
      const request=activityVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=activityOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===activityVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && activityVisible(state);
      const withOperations=(rows:readonly BisTransaction[])=>globalThis.localStorage
        ? withSendActivity(withMintActivity(withTransferActivity(rows,readBoardingRecord(profileId),profileId!),readAssetRecords(profileId!)),readSendRecord(profileId),profileId!) : rows;
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
    async refreshBalance() {
      assertAlive();
      if(!balanceVisible(state)||state.balance.status==='loading'||state.addresses.status==='loading')return;
      cancelBalance();
      const request=balanceVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=balanceOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===balanceVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && balanceVisible(state);
      const receiving = state.accountReceive;
      update({balance:receiving ? idleBalance : Object.freeze({status:'loading'}),addresses:receiving ? Object.freeze({status:'loading'}) : idleAddresses});
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
      } finally { if(request===balanceVersion) cancelBalance(); }
    },
    openRestoreAccount() {
      assertAlive();if(state.phase!=='idle'||state.hasProfile)return;
      context.openAccountDialog();invalidate();failure=undefined;
      update({phase:'restore-entry',error:undefined,canReset:true});
    },
    closeAccount() {
      assertAlive();if(state.view!=='account'||state.phase==='resetting'||state.phase==='logging-out'||state.phase==='restore-saving') return;
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
      assertAlive();if(state.phase!=='idle'||state.hasProfile) return;
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
        if(disposed||version!==current)return;
        pending=undefined;failure=undefined;
        confirmedProfile=account.profileId;
        update({phase:'active',hasProfile:true,profileId:account.profileId,error:undefined,canReset:true});
        emit({type:'accountConnected',profileId:account.profileId},current);
      }catch {if(!disposed&&version===current)fail('save','Your account could not be saved.');}
    },
    openLogoutConfirmation() {
      assertAlive();
      if (state.phase !== 'active' || !state.profileId) return;
      context.openAccountDialog();
      logoutTarget = {profileId:state.profileId!,generation};
      try {
        logoutOperations=pendingLogoutOperations();
        update({phase:'logout-confirmation',accountRecovery:false,logoutBackupAcknowledged:false,logoutPendingAcknowledged:false,logoutPendingCount:logoutOperations.count,error:undefined});
      } catch {
        logoutOperations=undefined;
        update({phase:'logout-confirmation',accountRecovery:false,logoutBackupAcknowledged:false,logoutPendingAcknowledged:false,logoutPendingCount:null,error:'Pending transactions could not be counted. Close and reopen Log Out to retry.'});
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
      if (!logoutOperations || state.logoutPendingCount === null || (state.logoutPendingCount > 0 && !state.logoutPendingAcknowledged)) return;
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
        const latestOperations=pendingLogoutOperations();
        if (latestOperations.fingerprint !== approvedOperations.fingerprint) {
          logoutOperations=latestOperations;
          update({phase:'logout-confirmation',logoutPendingCount:latestOperations.count,logoutPendingAcknowledged:false,error:'Pending transactions changed. Review and confirm logout again.'});
          return;
        }
        await storage.reset(target.generation, {purpose:'logout',profileId:target.profileId,operations:approvedOperations});
        if (disposed || version!==current) return;
        const after=await readStable(current);
        if (disposed || version!==current) return;
        if (after.account?.profileId===target.profileId && after.generation===target.generation) throw new Error('Clearing not confirmed.');
        acceptLoaded(after,current,true);
      } catch (error) {
        if (!disposed && version===current) {
          try {logoutOperations=pendingLogoutOperations();} catch {logoutOperations=undefined;}
          update({phase:'logout-error',logoutPendingCount:logoutOperations?.count ?? null,logoutPendingAcknowledged:logoutOperations?.fingerprint === approvedOperations.fingerprint && state.logoutPendingAcknowledged,error:error instanceof BoardingBlockedError ? error.message : 'Log out did not finish. Browser cleanup could not be confirmed.'});
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
    dispose() {if(disposed)return;clearRecovery();update({view:'empty',accountRecovery:false});cancelActivity();cancelBalance();state=Object.freeze({...state,balance:idleBalance,addresses:idleAddresses,activity:idleActivity,accountActivity:false});disposed=true;invalidate();unsubscribeStorage();listeners.clear();events.clear();},
  };
  controls.set(context,{
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
export function createBisContext(): BisContext {return createContext(createAccountStorage());}
export function createBisAdminContext(context: BisContext) {
  const internal=getControls(context);internal.assertAlive();
  return Object.freeze({resetClient:()=>internal.reset(), fund1000Sats:()=>internal.fund(), getFundingAddress:()=>internal.fundingAddress()});
}

