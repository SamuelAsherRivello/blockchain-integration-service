import type { Wallet, ReadonlyWallet, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { createAppWalletSession } from './app-wallet-session.ts';
import { requireNetwork, type AccountSecret } from './account.ts';
import { withCompleteSnapshot,readCompleteContracts } from './complete-snapshot.ts';

export type AppWalletSession = ReturnType<typeof createAppWalletSession<Wallet>>;
export type RoleWalletAccess = ReturnType<typeof bindRoleWallet>;

/** Private adapter capability. It is never part of package exports. */
export function bindRoleWallet(owner: AppWalletSession, role: 'player' | 'game') {
  return {
    read<T>(account: AccountSecret, signal: AbortSignal, use: (wallet: ReadonlyWallet) => Promise<T>, fresh = true): Promise<T> {
      if (!fresh) return owner.read(role, account, signal, (wallet, active) => {
        active.throwIfAborted(); return use(wallet as ReadonlyWallet);
      });
      const deadline = AbortSignal.any([signal,AbortSignal.timeout(30000)]);
      return owner.sign(role, account, deadline, async (wallet, active) => {
        requireNetwork((await wallet.arkProvider.getInfo()).network, account.network ?? 'signet');
        return withCompleteSnapshot(wallet, active, async current => {
          // Live evidence belongs to this attempt, not an unrelated watcher's
          // historical connection status. Required projection calls still throw.
          const restore = replace(current,'getProviderConnectionState',() => ({mode:'online',source:'live'}));
          try { return await use(current); } finally { restore(); }
        });
      });
    },
    sign<T>(account: AccountSecret, signal: AbortSignal,
      providers: {arkProvider?: RestArkProvider; indexerProvider?: RestIndexerProvider},
      use: (wallet: Wallet, signal: AbortSignal) => Promise<T>): Promise<T> {
      return owner.sign(role, account, signal, async (wallet, active) => {
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
          const manager=await wallet.getContractManager();
          restoreSnapshot=replace(manager,'getContractsWithVtxos',()=>readCompleteContracts(manager,wallet.indexerProvider,active));
          for (const name of ['submitTx','finalizeTx','registerIntent','submitTreeNonces','submitTreeSignatures','submitForfeitTxs']) {
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
    for(const key of Object.keys(target)) {
      if(typeof Reflect.get(target,key) !== 'function')continue;
      if(descriptors[key])Object.defineProperty(target,key,descriptors[key]);
      else Reflect.deleteProperty(target,key);
    }
  };
}
