import { createAccount, restoreAccount } from './account.ts';
import { createAccountStorage, type AccountStorage } from '../state-layer-core/account-storage.ts';
import { createContextWithDependencies, type BisContext, type BisContextOptions } from '../state-layer-core/context.ts';
import { createTestNetworkSession, type TestNetwork } from '../state-layer-core/test-network.ts';
import { createArkadeContextDependencies } from './context-dependencies.ts';
import { createAppWalletSession } from './app-wallet-session.ts';
import { bindRoleWallet } from './adapter-session.ts';
import { registerAppWalletOwner } from './app-wallet-composition.ts';
import { createAppPlayerProof } from './app-player-proof.ts';
import { marketplacePaymentEvidence } from './app-marketplace-evidence.ts';

/** Public compatibility façade; concrete Arkade wiring lives outside state core. */
export function createBisContext(options: BisContextOptions = {}): BisContext {
  const owner=createAppWalletSession({
    playerProof: request => createAppPlayerProof({ load: () => storage.load(), scope: () => context.getState(), subscribe: listener => context.subscribe(listener) })(request),
    marketplacePayment: (account, inputs) => {
      const state = context.getState();
      if (state.phase !== 'active' || state.network !== account.network) return;
      return marketplacePaymentEvidence(account, inputs, state.profileId);
    },
  }),player=bindRoleWallet(owner,'player');
  const session = createTestNetworkSession();
  const selected = () => session.getSelected();
  const stores = new Map<TestNetwork, AccountStorage>();
  let context:BisContext;
  const subscriptions=new Map<()=>void,Map<AccountStorage,()=>void>>();
  const currentStore = () => {
    const key = selected() ?? 'signet';
    let store = stores.get(key);
    if (!store) { store = createAccountStorage(key); stores.set(key, store); }
    for(const [listener,attached] of subscriptions)if(!attached.has(store))attached.set(store,store.subscribe(()=>{
      const phase=context?.getState().phase;
      if(phase==='active'||phase==='logout-confirmation'||phase==='logout-error')void player.retire().catch(()=>{});
      listener();
    }));
    return store;
  };
  const storage: AccountStorage = {
    load: () => currentStore().load(),
    listProfiles: () => currentStore().listProfiles(),
    selectProfile: (...args) => currentStore().selectProfile(...args),
    save: (...args) => currentStore().save(...args),
    reset: (...args) => currentStore().reset(...args),
    forceReset: (...args) => currentStore().forceReset?.(...args) ?? Promise.resolve(),
    subscribe: listener => {
      const attached=new Map<AccountStorage,()=>void>();subscriptions.set(listener,attached);currentStore();
      return () => {for(const unsubscribe of attached.values())unsubscribe();subscriptions.delete(listener);};
    },
  };
  const dependencies = createArkadeContextDependencies({
    disposeWallets:()=>{void owner.dispose();},
    create: signal => {
      const network = selected();
      if (!network) throw Error('Choose a test network first.');
      return createAccount(signal, network,player);
    },
    restore: (phrase, signal) => {
      const network = selected();
      if (!network) throw Error('Choose a test network first.');
      // Restore ownership with the temporary wallet first. The shared role
      // session performs a complete snapshot read, which is unnecessary for
      // restore and can make a valid Signet account look unavailable when an
      // unrelated indexer/contract read is unavailable. The retained session
      // is created after the account is saved and is used for subsequent reads.
      return restoreAccount(phrase, signal, network);
    },
  },player);
  const contextOptions: BisContextOptions = {
    ...options,
    requireNetworkSelection: true,
    getNetwork: selected,
    selectNetwork: value => session.select(value),
  };
  // Keep the host recipient live instead of snapshotting its initial value.
  Object.defineProperty(contextOptions, 'continueRecipient', { enumerable: true, get: () => options.continueRecipient });
  context=createContextWithDependencies(storage, dependencies, contextOptions);
  registerAppWalletOwner(context.subscribe,owner,()=>['active','logout-confirmation'].includes(context.getState().phase));
  context.subscribe(()=>{
    const state=context.getState();
    // Candidates already occupying the newly selected role are promoted intact.
    if(state.phase==='active'||state.phase==='idle')owner.select('player',state.profileId,state.network);
  });
  return context;
}
