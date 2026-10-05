import { createAccount, restoreAccount } from './account.ts';
import { createAccountStorage, type AccountStorage } from '../state-layer-core/account-storage.ts';
import { createContextWithDependencies, type BisContext, type BisContextOptions } from '../state-layer-core/context.ts';
import { createTestNetworkSession, type TestNetwork } from '../state-layer-core/test-network.ts';
import { createArkadeContextDependencies } from './context-dependencies.ts';

/** Public compatibility façade; concrete Arkade wiring lives outside state core. */
export function createBisContext(options: BisContextOptions = {}): BisContext {
  const session = createTestNetworkSession();
  const selected = () => session.getSelected();
  const stores = new Map<TestNetwork, AccountStorage>();
  const currentStore = () => {
    const key = selected() ?? 'signet';
    let store = stores.get(key);
    if (!store) { store = createAccountStorage(key); stores.set(key, store); }
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
      const unsubscribers = [...stores.values()].map(store => store.subscribe(listener));
      return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    },
  };
  const dependencies = createArkadeContextDependencies({
    create: signal => {
      const network = selected();
      if (!network) throw Error('Choose a test network first.');
      return createAccount(signal, network);
    },
    restore: (phrase, signal) => {
      const network = selected();
      if (!network) throw Error('Choose a test network first.');
      return restoreAccount(phrase, signal, network);
    },
  });
  const contextOptions: BisContextOptions = {
    ...options,
    requireNetworkSelection: true,
    getNetwork: selected,
    selectNetwork: value => session.select(value),
  };
  // Keep the host recipient live instead of snapshotting its initial value.
  Object.defineProperty(contextOptions, 'continueRecipient', { enumerable: true, get: () => options.continueRecipient });
  return createContextWithDependencies(storage, dependencies, contextOptions);
}
