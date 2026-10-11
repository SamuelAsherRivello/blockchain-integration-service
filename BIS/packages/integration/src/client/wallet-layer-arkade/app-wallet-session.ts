import { Wallet, MnemonicIdentity, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { operatorFor, requireNetwork, type AccountSecret } from './account.ts';
import { shareIndexerReads } from './indexer-reads.ts';

type Role = 'player' | 'game';
type Disposable = { dispose(): Promise<void> };
type Configuration = Parameters<typeof Wallet.create>[0];
type ReadWallet = Pick<Wallet, 'getAddress' | 'getBoardingAddress' | 'getBalance' | 'getVtxos' | 'getContractManager' | 'getProviderConnectionState'>;
type Slot<W> = {
  generation: number; account: AccountSecret; operator: string;
  controller: AbortController; pending: Promise<W>; wallet?: W;
  cleanup?: Promise<void>; lane: Promise<void>; users: number; drained?: () => void;
};

/** Private, app-local resource owner. No process-global identity/phrase cache.
 * Borrowers must not dispose or retain wallets beyond their callback. Navigation
 * cancellation detaches a borrower, not initialization. Only retirement disposes.
 * Signing material and repositories stay ephemeral; do not log these objects.
 * Automatic SDK transactions are disabled, not merely hidden from the UI.
 */
export function createAppWalletSession<W extends Disposable = Wallet>(options: {
  createWallet?: (config: Configuration) => Promise<W>;
  acquisitionMs?: number; retirementMs?: number;
} = {}) {
  const slots = new Map<Role, Slot<W>>();
  const generations: Record<Role, number> = { player: 0, game: 0 };
  let closed = false;
  const factory = options.createWallet ?? (config => Wallet.create(config) as unknown as Promise<W>);
  const same = (slot: Slot<W>, account: AccountSecret) => slot.account.profileId === account.profileId &&
    slot.account.phrase === account.phrase && (slot.account.network ?? 'signet') === (account.network ?? 'signet') &&
    slot.operator === operatorFor(account.network);
  const current = (role: Role, slot: Slot<W>) => !closed && slots.get(role) === slot && !slot.controller.signal.aborted;

  function cleanup(slot: Slot<W>) {
    return slot.cleanup ??= (async () => {
      // A pending factory must finish (or reject) before another signer can exist.
      let wallet: W;
      try { wallet = await slot.pending; } catch { return; }
      if (slot.users) await new Promise<void>(resolve => { slot.drained = resolve; });
      await wallet.dispose();
    })();
  }
  function invalidate(role: Role) {
    generations[role]++;
    const slot = slots.get(role);
    if (!slot) return Promise.resolve();
    slot.controller.abort(new Error('Wallet session retired.'));
    const done = cleanup(slot);
    void done.then(() => { if (slots.get(role) === slot) slots.delete(role); }, () => {});
    // Failure or a hanging SDK retains the quarantined slot. Local logout never
    // waits on this promise; replacement acquisition has its own bounded wait.
    return bounded(done, options.retirementMs ?? 20000);
  }
  async function acquire(role: Role, account: AccountSecret, signal: AbortSignal) {
    signal.throwIfAborted();
    if (closed) throw Error('Wallet session closed.');
    let slot = slots.get(role);
    if (slot && (!same(slot, account) || slot.controller.signal.aborted)) {
      if (!slot.controller.signal.aborted) void invalidate(role).catch(() => {});
      await detached(bounded(cleanup(slot), options.retirementMs ?? 20000), signal);
      if (slots.get(role) === slot) slots.delete(role);
      return acquire(role, account, signal);
    }
    if (!slot) {
      const controller = new AbortController();
      const network = account.network ?? 'signet', operator = operatorFor(network);
      const arkProvider = new RestArkProvider(operator);
      const getInfo = arkProvider.getInfo.bind(arkProvider);
      arkProvider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network, network); return info; };
      const config: Configuration = {
        identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }),
        arkProvider, indexerProvider: shareIndexerReads(new RestIndexerProvider(operator), operator),
        storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
        settlementConfig: false,
        watcherConfig: { failsafePollIntervalMs: 60000, reconnectDelayMs: 60000, maxReconnectAttempts: 1 },
      };
      slot = { generation: ++generations[role], account: { ...account }, operator, controller,
        pending: Promise.resolve().then(() => factory(config)), lane: Promise.resolve(), users: 0 };
      slots.set(role, slot);
      const created = slot;
      const timer = setTimeout(() => {
        if (current(role, created) && !created.wallet) void invalidate(role).catch(() => {});
      }, options.acquisitionMs ?? 20000);
      void created.pending.then(wallet => {
        clearTimeout(timer);
        if (current(role, created)) created.wallet = wallet;
        else void cleanup(created).catch(() => {});
      }, () => {
        clearTimeout(timer);
        if (slots.get(role) === created) slots.delete(role);
        created.controller.abort(new Error('Wallet acquisition failed.'));
      });
    }
    const selected = slot;
    const wallet = await detached(selected.pending, AbortSignal.any([signal, selected.controller.signal]));
    if (!current(role, selected)) throw Error('Wallet session retired.');
    return { wallet, slot: selected };
  }

  async function borrow<T>(role: Role, account: AccountSecret, signal: AbortSignal,
    use: (wallet: W, signal: AbortSignal) => Promise<T>, exclusive = false): Promise<T> {
    const { wallet, slot } = await acquire(role, account, signal);
    const leaseSignal = AbortSignal.any([signal, slot.controller.signal]);
    let release: (() => void) | undefined;
    if (exclusive) {
      const previous = slot.lane;
      slot.lane = new Promise<void>(resolve => { release = resolve; });
      try { await detached(previous, leaseSignal); } catch (error) {
        void previous.finally(() => release?.()); throw error;
      }
    }
    try { leaseSignal.throwIfAborted(); }
    catch(error){release?.();throw error;}
    if (!current(role, slot)) {release?.();throw Error('Wallet session retired.');}
    slot.users++;
    const execution=Promise.resolve().then(()=>use(wallet,leaseSignal)).then(result=>{
        leaseSignal.throwIfAborted();
        if (!current(role, slot)) throw Error('Wallet session retired.');
        return result;
    }).finally(()=>{if(--slot.users===0)slot.drained?.();release?.();});
    // Caller/local logout can leave immediately. The actual SDK execution still
    // owns its lane and resource until it stops; replacement stays quarantined.
    return detached(execution,leaseSignal);
  }
  return {
    // Read capability has no submission methods; both capabilities use one SDK object.
    read<T>(role: Role, account: AccountSecret, signal: AbortSignal, use: (wallet: W extends Wallet ? ReadWallet : W, signal: AbortSignal) => Promise<T>) {
      return borrow(role, account, signal, use as (wallet: W, signal: AbortSignal) => Promise<T>);
    },
    sign<T>(role: Role, account: AccountSecret, signal: AbortSignal, use: (wallet: W, signal: AbortSignal) => Promise<T>) {
      return borrow(role, account, signal, use, true);
    },
    retire: invalidate,
    select(role: Role, profileId: string | undefined, network: string | undefined) {
      const slot=slots.get(role);
      if(slot && (slot.account.profileId!==profileId || (slot.account.network??'signet')!==network))void invalidate(role).catch(()=>{});
    },
    dispose() { closed = true; return Promise.allSettled([invalidate('player'), invalidate('game')]).then(() => {}); },
  };
}

function detached<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? Error('Wallet operation interrupted.'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
function bounded<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Wallet cleanup unavailable.')), milliseconds);
    pending.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
