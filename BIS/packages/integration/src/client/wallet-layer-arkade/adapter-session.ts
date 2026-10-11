import type { Wallet, ReadonlyWallet, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { createAppWalletSession } from './app-wallet-session.ts';
import { requireNetwork, type AccountSecret } from './account.ts';
import { withCompleteSnapshot,readCompleteContracts } from './complete-snapshot.ts';

export type AppWalletSession = ReturnType<typeof createAppWalletSession<Wallet>>;
export type RoleWalletAccess = ReturnType<typeof createRoleWalletAccess>;
const bindings=new WeakMap<AppWalletSession,Map<'player'|'game',RoleWalletAccess>>();

/** Private adapter capability. It is never part of package exports. */
export function bindRoleWallet(owner: AppWalletSession, role: 'player' | 'game'):RoleWalletAccess {
  let roles=bindings.get(owner);if(!roles){roles=new Map();bindings.set(owner,roles);}
  let access=roles.get(role);if(!access){access=createRoleWalletAccess(owner,role);roles.set(role,access);}
  return access;
}
function createRoleWalletAccess(owner: AppWalletSession, role: 'player' | 'game') {
  const readViews=new WeakMap<Wallet,Wallet>();
  async function readonlyView(wallet:Wallet){
    const previous=readViews.get(wallet);if(previous)return previous;
    const manager=await wallet.getContractManager();
    const acquired=readViews.get(wallet);if(acquired)return acquired;
    // Freeze method identity, not provider data. Operation interceptors must
    // never leak into concurrent reads, including a long settlement lease.
    const providerView=<T extends object>(provider:T):T=>{
      const view=Object.create(provider) as T;
      let source:object|null=provider;
      while(source&&source!==Object.prototype){
        for(const key of Object.getOwnPropertyNames(source)){
          if(Object.hasOwn(view,key))continue;
          const value=Reflect.get(provider,key);if(typeof value==='function')Object.defineProperty(view,key,{value:value.bind(provider),configurable:true,writable:true});
        }
        source=Object.getPrototypeOf(source);
      }
      return view;
    };
    const view=Object.create(wallet) as Wallet;
    let source:object|null=wallet;
    while(source&&source!==Object.prototype){
      for(const key of Object.getOwnPropertyNames(source)){
        if(Object.hasOwn(view,key)||key==='constructor')continue;
        const value=Reflect.get(wallet,key);if(typeof value==='function')Object.defineProperty(view,key,{value,configurable:true,writable:true});
      }
      source=Object.getPrototypeOf(source);
    }
    Object.assign(view,{arkProvider:providerView(wallet.arkProvider),indexerProvider:providerView(wallet.indexerProvider),onchainProvider:providerView(wallet.onchainProvider)});
    const contracts=Object.create(manager) as typeof manager;
    contracts.getContractsWithVtxos=manager.getContractsWithVtxos.bind(manager);
    view.getContractManager=async()=>contracts;
    readViews.set(wallet,view);return view;
  }
  type Events={key:string;stop:AbortController;callbacks:Set<()=>void>;pending:Promise<void>};
  let events:Events|undefined;
  return {
    addresses(account:AccountSecret,signal:AbortSignal) {return owner.addresses(role,account,signal);},
    async observe(account:AccountSecret,signal:AbortSignal,changed:()=>void):Promise<void>{
      signal.throwIfAborted();
      const key=JSON.stringify([account.profileId,account.network??'signet']);
      if(!events||events.key!==key||events.stop.signal.aborted){
        events?.stop.abort();
        const stop=new AbortController(),callbacks=new Set<()=>void>();
        const entry:Events={key,stop,callbacks,pending:Promise.resolve()};events=entry;
        entry.pending=owner.read(role,account,stop.signal,async (resource,active)=>{
          const wallet=resource as ReadonlyWallet;
          let unsubscribe:(()=>void)|undefined;
          const ended=new Promise<void>(resolve=>{if(active.aborted)resolve();else active.addEventListener('abort',()=>resolve(),{once:true});});
          try {
            const subscribing=wallet.notifyIncomingFunds(()=>{if(!active.aborted)for(const callback of [...callbacks]){try{callback();}catch{/* One consumer cannot terminate shared observation. */}}}).then(stop=>{
              if(active.aborted)stop();else unsubscribe=stop;
            });
            await Promise.race([subscribing,ended]);
            if(!active.aborted)for(const callback of [...callbacks]){try{callback();}catch{/* Isolate consumers. */}} // Initial subscription gap closure.
            await ended;
          }finally{unsubscribe?.();stop.abort();callbacks.clear();}
        }).finally(()=>{stop.abort();if(events===entry)events=undefined;});
        void entry.pending.catch(()=>{});
      }
      const entry=events;
      const callback=()=>{if(!signal.aborted)changed();};entry.callbacks.add(callback);
      callback();
      let detach:()=>void=()=>{};
      try {
        await Promise.race([entry.pending,new Promise<void>(resolve=>{
          detach=()=>resolve();signal.addEventListener('abort',detach,{once:true});if(signal.aborted)detach();
        })]);
        if(!signal.aborted&&!entry.stop.signal.aborted)throw Error('Wallet observation ended.');
      }finally{entry.callbacks.delete(callback);signal.removeEventListener('abort',detach);}
    },
    read<T>(account: AccountSecret, signal: AbortSignal, use: (wallet: ReadonlyWallet) => Promise<T>, fresh = true): Promise<T> {
      if (!fresh) return owner.read(role, account, signal, async (wallet, active) => {
        active.throwIfAborted(); return use(await readonlyView(wallet as Wallet));
      });
      const deadline = AbortSignal.any([signal,AbortSignal.timeout(30000)]);
      return owner.read(role, account, deadline, async (resource, active) => {
        const wallet=await readonlyView(resource as Wallet);
        const verified=wallet.arkProvider.getInfo().then(info=>requireNetwork(info.network, account.network ?? 'signet'));
        const [,result]=await Promise.all([verified,withCompleteSnapshot(wallet, active, async current => {
          // Ownership can start concurrently, but no caller projection (which
          // may reconcile a receipt) runs before network validation succeeds.
          await verified;active.throwIfAborted();
          // Live evidence belongs to this attempt, not an unrelated watcher's
          // historical connection status. Required projection calls still throw.
          const restore = replace(current,'getProviderConnectionState',() => ({mode:'online',source:'live'}));
          try { return await use(current); } finally { restore(); }
        })]);
        return result;
      });
    },
    history(account:AccountSecret,signal:AbortSignal) {
      return owner.read(role,account,signal,async (resource,active)=>{
        const wallet=await readonlyView(resource as Wallet);
        requireNetwork((await wallet.arkProvider.getInfo()).network,account.network??'signet');
        const manager=await wallet.getContractManager();
        const snapshot=await readCompleteContracts(manager,wallet.indexerProvider,active);
        let failed=false;
        // A per-attempt read view, not another SDK wallet. Never patch the shared
        // manager/providers while slow historical outspends are being resolved.
        // SDK history may swallow provider failures; this attempt still fails.
        const checked=<T extends object>(provider:T):T=>new Proxy(provider,{get(target,key){
          const value=Reflect.get(target,key);
          if(typeof value!=='function')return value;
          return async(...args:unknown[])=>{try{active.throwIfAborted();return await value.apply(target,args);}catch(error){failed=true;throw error;}};
        }});
        const indexer=checked(wallet.indexerProvider),onchain=checked(wallet.onchainProvider);
        const contracts=new Proxy(manager,{get(target,key){
          if(key==='getContractsWithVtxos')return async()=>snapshot;
          const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
        }});
        const view:ReadonlyWallet=new Proxy(wallet,{get(target,key){
          if(key==='getContractManager')return async()=>contracts;
          if(key==='indexerProvider')return indexer;
          if(key==='onchainProvider')return onchain;
          const value=Reflect.get(target,key);return typeof value==='function'?value.bind(view):value;
        }});
        const result=await view.getTransactionHistory();
        active.throwIfAborted();if(failed)throw Error('Activity unavailable.');
        return result;
      });
    },
    sign<T>(account: AccountSecret, signal: AbortSignal,
      providers: {arkProvider?: RestArkProvider; indexerProvider?: RestIndexerProvider},
      use: (wallet: Wallet, signal: AbortSignal) => Promise<T>): Promise<T> {
      return owner.sign(role, account, signal, async (wallet, active) => {
        await readonlyView(wallet);
        const restoreWallet = methodCheckpoint(wallet);
        const restoreArk = methodCheckpoint(wallet.arkProvider);
        const restoreIndexer = methodCheckpoint(wallet.indexerProvider);
        let restoreSnapshot: (()=>void)|undefined;
        try {
          // Legacy operation-specific policy/checkpoint interceptors remain
          // scoped, but execute on the single retained signer. No hooks survive.
          copyMethods(providers.arkProvider, wallet.arkProvider);
          copyMethods(providers.indexerProvider, wallet.indexerProvider);
          requireNetwork((await wallet.arkProvider.getInfo()).network,account.network??'signet');
          // Strict live ownership below and direct boarding reads still must
          // succeed. A historical watcher disconnect is not this attempt's evidence.
          replace(wallet,'getProviderConnectionState',()=>({mode:'online',source:'live',lastOnlineAt:Date.now()}));
          const manager=await wallet.getContractManager();
          restoreSnapshot=replace(manager,'getContractsWithVtxos',async(filter?:Record<string,unknown>)=>{
            const snapshot=await readCompleteContracts(manager,wallet.indexerProvider,active);
            return snapshot.filter(({contract})=>!filter||Object.entries(filter).every(([key,value])=>value===undefined||
              (Array.isArray(value)?value.includes(Reflect.get(contract,key)):Reflect.get(contract,key)===value)));
          });
          for (const name of ['submitTx','finalizeTx','registerIntent','confirmRegistration','deleteIntent','submitTreeNonces','submitTreeSignatures','submitSignedForfeitTxs']) {
            const original = Reflect.get(wallet.arkProvider,name);
            if (typeof original === 'function') Reflect.set(wallet.arkProvider,name,(...args:unknown[]) => {
              active.throwIfAborted(); return original.apply(wallet.arkProvider,args);
            });
          }
          return await use(wallet, active);
        } finally { restoreSnapshot?.();restoreIndexer();restoreArk();restoreWallet(); }
      });
    },
    retire: () => owner.retire(role),
  };
}

function replace(target: object, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(target,name);
  Reflect.set(target,name,value);
  return () => { if(previous)Object.defineProperty(target,name,previous);else Reflect.deleteProperty(target,name); };
}
function copyMethods(source: object | undefined, target: object) {
  if (!source) return;
  for (const key of Object.keys(source)) {
    const value = Reflect.get(source,key);
    if (typeof value === 'function') Reflect.set(target,key,(...args:unknown[])=>Reflect.get(source,key).apply(source,args));
  }
}
function methodCheckpoint(target: object) {
  const descriptors = Object.getOwnPropertyDescriptors(target);
  return () => {
    for(const key of new Set([...Object.keys(target),...Object.keys(descriptors)])) {
      if(typeof Reflect.get(target,key) !== 'function'&&typeof descriptors[key]?.value!=='function')continue;
      if(descriptors[key])Object.defineProperty(target,key,descriptors[key]);
      else Reflect.deleteProperty(target,key);
    }
  };
}
