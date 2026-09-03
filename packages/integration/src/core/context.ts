import { watchActivity } from '../arkade/activity.ts';
import type { BisActivity } from './activity.ts';
import { createAccount, restoreAccount, identify, type AccountSecret } from '../arkade/account.ts';
import { phraseWords, validRecovery } from './recovery-validation.ts';
import { createAccountStorage, type AccountStorage, type StoredAccount } from './account-storage.ts';
import { loadBalance, type BalanceAmounts } from '../arkade/balance.ts';
import { loadAddresses, type AccountAddresses } from '../arkade/addresses.ts';
export type BisAddresses = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> | Readonly<{ status: 'ready' } & AccountAddresses>;
import { fundTestAccount } from '../arkade/funding.ts';
export type BisBalance = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> | Readonly<{ status: 'ready'; availableSats: number; totalSats: number }>;
export type BisState = Readonly<{
  view: 'empty' | 'account-button' | 'account'; hasProfile: boolean;
  phase: 'loading' | 'idle' | 'creating' | 'recovery' | 'saving' | 'active' | 'error' | 'resetting' | 'logout-confirmation' | 'logging-out' | 'logout-error' | 'restore-entry' | 'restoring' | 'restore-saving' | 'restore-error';
  logoutBackupAcknowledged: boolean;
  accountRecovery: boolean;
  recoveryStatus: 'hidden' | 'loading' | 'ready' | 'unavailable';
  profileId?: string; error?: string; canReset: boolean;
  balance: BisBalance;
  addresses: BisAddresses;
  accountReceive: boolean;
  accountSend: boolean;
  accountDetails: boolean;
  accountActivity: boolean;
  activity: BisActivity;
}>;
export type BisEvent = Readonly<{ type: 'accountConnected' | 'accountDisconnected'; profileId: string }>;
export interface BisContext {
  getState(): BisState;
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: BisEvent) => void): () => void;
  ready(): Promise<void>;
  openAccountDialog(): void;
  openAccountReceive(): void;
  openAccountSend(): void;
  openAccountDetails(): void;
  openAccountActivity(): void;
  openAccountRecovery(): void;
  refreshActivity(): Promise<void>;
  closeAccount(): void;
  refreshBalance(): Promise<void>;
  createAccount(): Promise<void>;
  openRestoreAccount(): void;
  continueAccount(): Promise<void>;
  openLogoutConfirmation(): void;
  setLogoutBackupAcknowledged(acknowledged: boolean): void;
  confirmLogout(): Promise<void>;
  cancelLogout(): void;
  retry(): Promise<void>;
  dispose(): void;
}
export function accountDestination(hasProfile: boolean) { return hasProfile ? 'account-menu' : 'account-chooser'; }
type Controls = { present(): void; reset(): Promise<void>; fund(): Promise<string>; fundingAddress(): Promise<string>; assertAlive(): void; recovery(): string | undefined; revealRecovery(): Promise<void>; hideRecovery(): void; restore(phrase: string): Promise<void> };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
// Private dependency seam for isolated tests; not exported by the package.
export function createContext(storage: AccountStorage, create = createAccount, identifyAccount = identify, restore = restoreAccount, readBalance: (account: AccountSecret, signal: AbortSignal) => Promise<BalanceAmounts> = loadBalance, fund = fundTestAccount, readAddresses: (account: AccountSecret, signal: AbortSignal) => Promise<AccountAddresses> = loadAddresses, observeActivity: typeof watchActivity = watchActivity): BisContext {
  const idleActivity: BisActivity = Object.freeze({status:'idle'});
  let activityVersion = 0;
  let activityOperation = new AbortController();
  const cancelActivity = () => { activityVersion++; activityOperation.abort(); activityOperation = new AbortController(); };
  const activityVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && s.accountActivity;
  const idleBalance: BisBalance = Object.freeze({status:'idle'});
  const idleAddresses: BisAddresses = Object.freeze({status:'idle'});
  let state: BisState = Object.freeze({view:'empty',hasProfile:false,phase:'loading',canReset:false,logoutBackupAcknowledged:false,balance:idleBalance,addresses:idleAddresses,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,activity:idleActivity,accountRecovery:false,recoveryStatus:'hidden'});
  let revealedPhrase: string | undefined;
  let recoveryVersion = 0;
  let recoveryReturn: { phase: BisState['phase']; accountDetails?: boolean; error?: string } = { phase: 'active' };
  const clearRecovery = () => { revealedPhrase = undefined; recoveryVersion++; };
  let previous: BisState['view'] = 'empty';
  let disposed = false, version = 0, generation = 0;
  let funding = false;
  let pending: AccountSecret | undefined;
  let restorePhrase: string | undefined;
  let operation = new AbortController();
  let failure: 'load' | 'create' | 'save' | undefined;
  let confirmedProfile: string | undefined;
  let logoutTarget: { profileId: string; generation: number } | undefined;
  let storageRevision = 0;
  let balanceVersion = 0;
  let balanceOperation = new AbortController();
  const balanceVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && (s.accountDetails || s.accountReceive);
  const cancelBalance = () => { balanceVersion++; balanceOperation.abort(); balanceOperation=new AbortController(); };
  const listeners = new Set<() => void>();
  const events = new Set<(event: BisEvent)=>void>();
  const assertAlive = () => { if(disposed) throw new Error('BIS context is disposed.'); };
  const update = (patch: Partial<BisState>) => {
    if(disposed) return;
    const before=state;
    state=Object.freeze({...state,...patch});
    if (state.view !== 'account' || !state.hasProfile || !['active','logout-confirmation','logout-error'].includes(state.phase)) state=Object.freeze({...state,accountRecovery:false});
    if (!state.accountRecovery || before.profileId !== state.profileId) {
      clearRecovery();
      state=Object.freeze({...state,accountRecovery:false,recoveryStatus:'hidden'});
    }
    if(state.view!=='account'||state.phase!=='active'||!state.hasProfile) state=Object.freeze({...state,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false});
    const enteringActivity = activityVisible(state) && (!activityVisible(before) || before.profileId !== state.profileId);
    if (!activityVisible(state) || enteringActivity) { cancelActivity(); state=Object.freeze({...state,activity:idleActivity}); }
    const entering=balanceVisible(state) && (!balanceVisible(before) || before.accountReceive!==state.accountReceive || before.profileId!==state.profileId);
    if (!balanceVisible(state) || entering) {
      cancelBalance();
      state=Object.freeze({...state,balance:idleBalance,addresses:idleAddresses});
    }
    if (enteringActivity) queueMicrotask(() => { if (!disposed && activityVisible(state) && state.activity.status === 'idle') void context.refreshActivity(); });
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
    if(entering) queueMicrotask(()=>{if(!disposed && balanceVisible(state) && state.balance.status==='idle' && state.addresses.status==='idle') void context.refreshBalance();});
  };
  const invalidate = () => {version++;operation.abort();operation=new AbortController();pending=undefined;restorePhrase=undefined;};
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
  function acceptLoaded(loaded: StoredAccount, current: number) {
    if (disposed || version !== current) return;
    const former = confirmedProfile;
    confirmedProfile = loaded.account?.profileId;
    generation = loaded.generation; failure = undefined; logoutTarget = undefined;
    update({phase:loaded.account?'active':'idle',hasProfile:!!loaded.account,profileId:loaded.account?.profileId,canReset:!!loaded.account,error:undefined,logoutBackupAcknowledged:false});
    if (former && !loaded.account) emit({type:'accountDisconnected',profileId:former}, current);
  }
  async function hydrate() {
    invalidate(); const current=version;
    logoutTarget=undefined;
    update({phase:'loading',error:undefined,logoutBackupAcknowledged:false});
    try {
      acceptLoaded(await readStable(current), current);
    } catch {if(!disposed&&version===current) fail('load','Your saved account could not be opened. Retry or use Reset Client in the demo.');}
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
      if(!disposed&&version===current) update({phase:'restore-error',error:pending?'Your account could not be confirmed saved. Retry or go Back.':'The test service could not be reached. Retry or go Back.'});
    }
  }
  const context: BisContext = {
    getState:()=>state,
    subscribe(listener) {assertAlive();listeners.add(listener);return ()=>{listeners.delete(listener);};},
    onEvent(listener) {assertAlive();events.add(listener);return ()=>{events.delete(listener);};},
    ready:()=>initialization,
    openAccountDialog() {assertAlive();if(state.view==='account') return;previous=state.view;update({view:'account'});},
    openAccountReceive() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountReceive) update({accountReceive:true,accountSend:false,accountDetails:false,accountActivity:false,accountRecovery:false});
    },
    openAccountSend() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountSend) update({accountSend:true,accountReceive:false,accountDetails:false,accountActivity:false,accountRecovery:false});
    },
    openAccountDetails() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountDetails) update({accountDetails:true,accountActivity:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
    openAccountActivity() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountActivity) update({accountActivity:true,accountDetails:false,accountRecovery:false,accountReceive:false,accountSend:false});
    },
    openAccountRecovery() {
      assertAlive();
      if (state.view !== 'account' || !state.hasProfile || state.accountRecovery || !['active','logout-confirmation','logout-error'].includes(state.phase)) return;
      recoveryReturn = { phase: state.phase, accountDetails: state.accountDetails, error: state.error };
      clearRecovery();
      update({accountRecovery:true,accountDetails:false,accountActivity:false,accountReceive:false,accountSend:false,recoveryStatus:'hidden',error:undefined,logoutBackupAcknowledged:false});
    },
    async refreshActivity() {
      assertAlive();
      if(!activityVisible(state) || state.activity.status==='loading') return;
      cancelActivity();
      const request=activityVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=activityOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===activityVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && activityVisible(state);
      update({activity:Object.freeze({status:'loading'})});
      try {
        const saved=await readStable(accountVersion);
        if(!current())return;
        if(!saved.account || saved.generation!==accountGeneration || saved.account.profileId!==profileId) {initialization=hydrate();return;}
        await observeActivity(saved.account,signal,transactions=>{
          if(current()) update({activity:Object.freeze({status:'ready',transactions:Object.freeze(transactions.map(t=>Object.freeze({...t})))})});
        });
      } catch { if(current()) update({activity:Object.freeze({status:'unavailable'})}); }
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
      let saved: StoredAccount;
      try { saved=await readStable(accountVersion); }
      catch { if(current()) fail('load','Your saved account could not be opened. Retry or use Reset Client in the demo.'); return; }
      if(!current())return;
      if(!saved.account || saved.generation!==accountGeneration || saved.account.profileId!==profileId) {initialization=hydrate();return;}
      const account=saved.account;
      await Promise.all([
        (async()=>{
          if(receiving)return;
          try { const amounts=await readBalance(account,signal); if(current())update({balance:Object.freeze({status:'ready',...amounts})}); }
          catch { if(current())update({balance:Object.freeze({status:'unavailable'})}); }
        })(),
        (async()=>{
          if(!receiving)return;
          try { const addresses=await readAddresses(account,signal); if(current())update({addresses:Object.freeze({status:'ready',...addresses})}); }
          catch { if(current())update({addresses:Object.freeze({status:'unavailable'})}); }
        })(),
      ]);
    },
    openRestoreAccount() {
      assertAlive();if(state.phase!=='idle'||state.hasProfile)return;
      context.openAccountDialog();invalidate();failure=undefined;
      update({phase:'restore-entry',error:undefined,canReset:true});
    },
    closeAccount() {
      assertAlive();if(state.view!=='account'||state.phase==='resetting'||state.phase==='logging-out'||state.phase==='restore-saving') return;
      if(state.accountRecovery) {update({accountRecovery:false,...recoveryReturn});return;}
      if(state.accountReceive || state.accountSend) {update({accountReceive:false,accountSend:false});return;}
      if(state.accountActivity) {update({accountActivity:false});return;}
      if(state.accountDetails) {update({accountDetails:false});return;}
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
      }catch {if(!disposed&&version===current)fail('create','The test account could not be created. Please retry.');}
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
      }catch {if(!disposed&&version===current)fail('save','Your account could not be saved. Retry or go Back.');}
    },
    openLogoutConfirmation() {
      assertAlive();
      if (state.phase !== 'active' || !state.profileId) return;
      context.openAccountDialog();
      logoutTarget = {profileId:state.profileId!,generation};
      update({phase:'logout-confirmation',accountRecovery:false,logoutBackupAcknowledged:false,error:undefined});
    },
    setLogoutBackupAcknowledged(acknowledged) {
      assertAlive();
      if (!state.accountRecovery && (state.phase === 'logout-confirmation' || state.phase === 'logout-error')) update({logoutBackupAcknowledged:acknowledged === true});
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
      const target=logoutTarget;
      invalidate(); const current=version;
      update({phase:'logging-out',error:undefined});
      try {
        const loaded=await readStable(current);
        if (disposed || version!==current) return;
        if (!loaded.account || loaded.generation!==target.generation || loaded.account.profileId!==target.profileId) {
          acceptLoaded(loaded,current); return;
        }
        await storage.reset(target.generation);
        if (disposed || version!==current) return;
        const after=await readStable(current);
        if (disposed || version!==current) return;
        if (after.account?.profileId===target.profileId && after.generation===target.generation) throw new Error('Clearing not confirmed.');
        acceptLoaded(after,current);
      } catch {
        if (!disposed && version===current) update({phase:'logout-error',error:'Log out did not finish. Your saved account has not been confirmed cleared. Please retry.'});
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
      if (funding) throw new Error('Funding request already in progress.');
      if (!state.hasProfile || state.phase !== 'active') throw new Error('An active account is required.');
      const current = version, profileId = state.profileId, expectedGeneration = generation;
      const isCurrent = () => !disposed && version === current && state.profileId === profileId && state.phase === 'active';
      funding = true;
      try {
        const loaded = await readStable(current);
        if (!isCurrent() || !loaded.account || loaded.account.profileId !== profileId || loaded.generation !== expectedGeneration) throw new Error('Account changed.');
        await fund(loaded.account, operation.signal, isCurrent);
        if (!isCurrent()) throw new Error('Account changed.');
        return 'Funding request accepted for 1000 Signet sats. Refresh Account Details to check receipt.';
      } catch {
        throw new Error('Funding was not confirmed. The faucet may be unavailable or the account changed. Check Account Details before trying again.');
      } finally { funding = false; }
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
        const loaded = await readStable(accountVersion);
        if (!current()) return;
        if (!loaded.account || loaded.account.profileId !== profileId || loaded.generation !== expectedGeneration) {initialization=hydrate();return;}
        revealedPhrase = loaded.account.phrase;
        update({recoveryStatus:'ready'});
      } catch { if(current()) update({recoveryStatus:'unavailable'}); }
    },
    present() {assertAlive();if(state.view!=='account')update({view:'account-button'});},
    async reset() {
      assertAlive();if(state.phase==='resetting')return;
      invalidate();logoutTarget=undefined;update({phase:'resetting',error:undefined,logoutBackupAcknowledged:false});
      try {await storage.reset();if(disposed)return;previous='empty';update({view:'empty'});initialization=hydrate();await initialization;}
      catch {if(!disposed)fail('load','Reset did not finish. Your account has not been confirmed cleared.');throw new Error('Reset did not finish.');}
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
