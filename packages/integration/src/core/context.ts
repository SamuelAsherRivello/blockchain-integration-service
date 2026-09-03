import { createAccount, identify, type AccountSecret } from '../arkade/account.ts';
import { createAccountStorage, type AccountStorage } from './account-storage.ts';
export type BisState = Readonly<{
  view: 'empty' | 'account-button' | 'account'; hasProfile: boolean;
  phase: 'loading' | 'idle' | 'creating' | 'recovery' | 'saving' | 'active' | 'error' | 'resetting';
  profileId?: string; error?: string; canReset: boolean;
}>;
export type BisEvent = Readonly<{ type: 'accountConnected'; profileId: string }>;
export interface BisContext {
  getState(): BisState;
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: BisEvent) => void): () => void;
  ready(): Promise<void>;
  openAccountDialog(): void;
  closeAccount(): void;
  createAccount(): Promise<void>;
  continueAccount(): Promise<void>;
  retry(): Promise<void>;
  dispose(): void;
}
export function accountDestination(hasProfile: boolean) { return hasProfile ? 'account-menu' : 'account-chooser'; }
type Controls = { present(): void; reset(): Promise<void>; assertAlive(): void; recovery(): string | undefined };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
// Private dependency seam for isolated tests; not exported by the package.
export function createContext(storage: AccountStorage, create = createAccount, identifyAccount = identify): BisContext {
  let state: BisState = Object.freeze({view:'empty',hasProfile:false,phase:'loading',canReset:false});
  let previous: BisState['view'] = 'empty';
  let disposed = false, version = 0, generation = 0;
  let pending: AccountSecret | undefined;
  let operation = new AbortController();
  let failure: 'load' | 'create' | 'save' | undefined;
  const listeners = new Set<() => void>();
  const events = new Set<(event: BisEvent)=>void>();
  const assertAlive = () => { if(disposed) throw new Error('BIS context is disposed.'); };
  const update = (patch: Partial<BisState>) => {
    if(disposed) return;
    state=Object.freeze({...state,...patch});
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
  };
  const invalidate = () => {version++;operation.abort();operation=new AbortController();pending=undefined;};
  const fail = (kind: typeof failure, error: string) => {failure=kind;update({phase:'error',error,canReset:true});};
  async function hydrate() {
    invalidate(); const current=version;
    update({phase:'loading',hasProfile:false,profileId:undefined,error:undefined});
    try {
      const loaded=await storage.load();
      if(loaded.account && await identifyAccount(loaded.account.phrase)!==loaded.account.profileId) throw new Error('Invalid account.');
      if(disposed||version!==current) return;
      generation=loaded.generation;failure=undefined;
      update({phase:loaded.account?'active':'idle',hasProfile:!!loaded.account,profileId:loaded.account?.profileId,canReset:!!loaded.account,error:undefined});
    } catch {if(!disposed&&version===current) fail('load','Your saved account could not be opened. Retry or use Reset Client in the demo.');}
  }
  let initialization: Promise<void>;
  const context: BisContext = {
    getState:()=>state,
    subscribe(listener) {assertAlive();listeners.add(listener);return ()=>{listeners.delete(listener);};},
    onEvent(listener) {assertAlive();events.add(listener);return ()=>{events.delete(listener);};},
    ready:()=>initialization,
    openAccountDialog() {assertAlive();if(state.view==='account') return;previous=state.view;update({view:'account'});},
    closeAccount() {
      assertAlive();if(state.view!=='account'||state.phase==='resetting') return;
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
        update({phase:'active',hasProfile:true,profileId:account.profileId,error:undefined,canReset:true});
        if(!disposed&&version===current) for(const listener of [...events]) if(events.has(listener))listener(Object.freeze({type:'accountConnected',profileId:account.profileId}));
      }catch {if(!disposed&&version===current)fail('save','Your account could not be saved. Retry or go Back.');}
    },
    async retry() {
      assertAlive();if(state.phase!=='error')return;
      if(failure==='load'){initialization=hydrate();await initialization;}
      else if(failure==='save')await context.continueAccount();
      else {failure=undefined;update({phase:'idle',error:undefined});await context.createAccount();}
    },
    dispose() {if(disposed)return;disposed=true;invalidate();unsubscribeStorage();listeners.clear();events.clear();},
  };
  controls.set(context,{
    assertAlive,
    recovery:()=>pending?.phrase,
    present() {assertAlive();if(state.view!=='account')update({view:'account-button'});},
    async reset() {
      assertAlive();if(state.phase==='resetting')return;
      invalidate();update({phase:'resetting',error:undefined});
      try {await storage.reset();if(disposed)return;previous='empty';update({view:'empty'});initialization=hydrate();await initialization;}
      catch {if(!disposed)fail('load','Reset did not finish. Your account has not been confirmed cleared.');throw new Error('Reset did not finish.');}
    },
  });
  const unsubscribeStorage=storage.subscribe(()=> {if(!disposed&&state.phase!=='resetting'){initialization=hydrate();}});
  initialization=hydrate();
  return context;
}
export function createBisContext(): BisContext {return createContext(createAccountStorage());}
export function createBisAdminContext(context: BisContext) {
  const internal=getControls(context);internal.assertAlive();
  return Object.freeze({resetClient:()=>internal.reset()});
}
