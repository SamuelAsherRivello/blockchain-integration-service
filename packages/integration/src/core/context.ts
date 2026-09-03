import { createAccount, restoreAccount, identify, type AccountSecret } from '../arkade/account.ts';
import { phraseWords, validRecovery } from './recovery-validation.ts';
import { createAccountStorage, type AccountStorage, type StoredAccount } from './account-storage.ts';
import { loadBalance, type BalanceAmounts } from '../arkade/balance.ts';
export type BisBalance = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> | Readonly<{ status: 'ready'; availableSats: number; totalSats: number }>;
export type BisState = Readonly<{
  view: 'empty' | 'account-button' | 'account'; hasProfile: boolean;
  phase: 'loading' | 'idle' | 'creating' | 'recovery' | 'saving' | 'active' | 'error' | 'resetting' | 'logout-confirmation' | 'logging-out' | 'logout-error' | 'restore-entry' | 'restoring' | 'restore-saving' | 'restore-error';
  logoutBackupAcknowledged: boolean;
  profileId?: string; error?: string; canReset: boolean;
  balance: BisBalance;
  accountDetails: boolean;
}>;
export type BisEvent = Readonly<{ type: 'accountConnected' | 'accountDisconnected'; profileId: string }>;
export interface BisContext {
  getState(): BisState;
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: BisEvent) => void): () => void;
  ready(): Promise<void>;
  openAccountDialog(): void;
  openAccountDetails(): void;
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
type Controls = { present(): void; reset(): Promise<void>; assertAlive(): void; recovery(): string | undefined; restore(phrase: string): Promise<void> };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
// Private dependency seam for isolated tests; not exported by the package.
export function createContext(storage: AccountStorage, create = createAccount, identifyAccount = identify, restore = restoreAccount, readBalance: (account: AccountSecret, signal: AbortSignal) => Promise<BalanceAmounts> = loadBalance): BisContext {
  const idleBalance: BisBalance = Object.freeze({status:'idle'});
  let state: BisState = Object.freeze({view:'empty',hasProfile:false,phase:'loading',canReset:false,logoutBackupAcknowledged:false,balance:idleBalance,accountDetails:false});
  let previous: BisState['view'] = 'empty';
  let disposed = false, version = 0, generation = 0;
  let pending: AccountSecret | undefined;
  let restorePhrase: string | undefined;
  let operation = new AbortController();
  let failure: 'load' | 'create' | 'save' | undefined;
  let confirmedProfile: string | undefined;
  let logoutTarget: { profileId: string; generation: number } | undefined;
  let storageRevision = 0;
  let balanceVersion = 0;
  let balanceOperation = new AbortController();
  const balanceVisible = (s: BisState) => s.view === 'account' && s.phase === 'active' && s.hasProfile && s.accountDetails;
  const cancelBalance = () => { balanceVersion++; balanceOperation.abort(); balanceOperation=new AbortController(); };
  const listeners = new Set<() => void>();
  const events = new Set<(event: BisEvent)=>void>();
  const assertAlive = () => { if(disposed) throw new Error('BIS context is disposed.'); };
  const update = (patch: Partial<BisState>) => {
    if(disposed) return;
    const before=state;
    state=Object.freeze({...state,...patch});
    if(state.view!=='account'||state.phase!=='active'||!state.hasProfile) state=Object.freeze({...state,accountDetails:false});
    const entering=balanceVisible(state) && (!balanceVisible(before) || before.profileId!==state.profileId);
    if (!balanceVisible(state) || entering) {
      cancelBalance();
      state=Object.freeze({...state,balance:idleBalance});
    }
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
    if(entering) queueMicrotask(()=>{if(!disposed && balanceVisible(state) && state.balance.status==='idle') void context.refreshBalance();});
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
    openAccountDetails() {
      assertAlive();
      if(state.view==='account' && state.phase==='active' && state.hasProfile && !state.accountDetails) update({accountDetails:true});
    },
    async refreshBalance() {
      assertAlive();
      if(!balanceVisible(state)||state.balance.status==='loading')return;
      cancelBalance();
      const request=balanceVersion, accountVersion=version, accountGeneration=generation, profileId=state.profileId;
      const signal=balanceOperation.signal;
      const current=()=>!disposed && !signal.aborted && request===balanceVersion && accountVersion===version && accountGeneration===generation && profileId===state.profileId && balanceVisible(state);
      update({balance:Object.freeze({status:'loading'})});
      let saved: StoredAccount;
      try { saved=await readStable(accountVersion); }
      catch { if(current()) fail('load','Your saved account could not be opened. Retry or use Reset Client in the demo.'); return; }
      if(!current())return;
      if(!saved.account || saved.generation!==accountGeneration || saved.account.profileId!==profileId) {initialization=hydrate();return;}
      try {
        const amounts=await readBalance(saved.account,signal);
        if(current())update({balance:Object.freeze({status:'ready',...amounts})});
      } catch { if(current())update({balance:Object.freeze({status:'unavailable'})}); }
    },
    openRestoreAccount() {
      assertAlive();if(state.phase!=='idle'||state.hasProfile)return;
      context.openAccountDialog();invalidate();failure=undefined;
      update({phase:'restore-entry',error:undefined,canReset:true});
    },
    closeAccount() {
      assertAlive();if(state.view!=='account'||state.phase==='resetting'||state.phase==='logging-out'||state.phase==='restore-saving') return;
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
      update({phase:'logout-confirmation',logoutBackupAcknowledged:false,error:undefined});
    },
    setLogoutBackupAcknowledged(acknowledged) {
      assertAlive();
      if (state.phase === 'logout-confirmation' || state.phase === 'logout-error') update({logoutBackupAcknowledged:acknowledged === true});
    },
    cancelLogout() {
      assertAlive();
      if (state.phase === 'logout-error') { initialization=hydrate();return; }
      if (state.phase !== 'logout-confirmation') return;
      logoutTarget=undefined;
      update({phase:'active',logoutBackupAcknowledged:false,error:undefined});
    },
    async confirmLogout() {
      assertAlive();
      if (!logoutTarget || !state.logoutBackupAcknowledged || !['logout-confirmation','logout-error'].includes(state.phase)) return;
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
    dispose() {if(disposed)return;cancelBalance();state=Object.freeze({...state,balance:idleBalance});disposed=true;invalidate();unsubscribeStorage();listeners.clear();events.clear();},
  };
  controls.set(context,{
    assertAlive,
    restore:runRestore,
    recovery:()=>pending?.phrase,
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
  return Object.freeze({resetClient:()=>internal.reset()});
}
