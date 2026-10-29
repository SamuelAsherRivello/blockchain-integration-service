import { signingIdentity, readonlyIdentity, walletSourceKey } from './wallet-identity.ts';
import { Wallet, MnemonicIdentity, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, InMemoryIntentRepository, IndexedDBIntentRepository, EsploraProvider } from '@arkade-os/sdk';
import {testNetwork} from '../state-layer-core/test-network.ts';
import { arkadeReadOperatorFor, operatorFor, requireNetwork, type WalletAccount } from './account.ts';
import { shareIndexerReads } from './indexer-reads.ts';
import { projectConfiguredAddresses } from './address-projection.ts';
import type { AccountAddresses } from './addresses.ts';
import { finalizeServerArkadeTransaction, submitServerArkadeTransaction, type ServerSigningOperation, type ServerContractIntent } from './server-wallet.ts';
import {serverTreasureAuthority,createLeasedTreasureServerTransport,type TreasureServerPersistence} from './server-wallet.ts';
import type { AppPlayerProof } from './app-player-proof.ts';
import { prepareServerSettlement, captureServerSettlementEvent, selectImplicitServerSettlement } from './server-settlement.ts';

type Role = 'player' | 'game';
type Disposable = { dispose(): Promise<void> };
export type AppTreasureServerCapability=Readonly<{
  authority:'owner'|'player-proof';
  transport:(persistence:TreasureServerPersistence)=>ReturnType<typeof createLeasedTreasureServerTransport>;
}>;
type Configuration = Parameters<typeof Wallet.create>[0];
type ReadWallet = Pick<Wallet, 'getAddress' | 'getBoardingAddress' | 'getBalance' | 'getVtxos' | 'getContractManager' | 'getProviderConnectionState'>;
type Slot<W> = {
  generation: number; account: WalletAccount; operator: string;
  controller: AbortController; pending: Promise<W>; wallet?: W;
  addresses: Promise<AccountAddresses>;
  startAddresses(): void;
  cleanup?: Promise<void>; lane: Promise<void>; users: number; drained?: () => void;
  signingOperation: { active?: ServerSigningOperation };
};

// Arkade persists the signed settlement intent before registering it with the
// operator.  Keeping that record only in a session-local repository turns a
// refresh, tab crash, or interrupted callback into an unrecoverable "unknown"
// operation even though the operator may still settle it.  Use a dedicated
// database: the SDK explicitly prohibits sharing its intent schema with the
// wallet/contract repositories.  The name contains only public local scope.
function settlementIntentRepository(role: Role, account: WalletAccount) {
  const network=account.network ?? 'signet';
  if(typeof indexedDB==='undefined')return new InMemoryIntentRepository();
  return new IndexedDBIntentRepository(`bis-settlement-intents-v1:${network}:${role}:${encodeURIComponent(account.profileId)}`);
}

/** Private, app-local resource owner. No process-global identity/phrase cache.
 * Borrowers must not dispose or retain wallets beyond their callback. Navigation
 * cancellation detaches a borrower, not initialization. Only retirement disposes.
 * Signing material remains ephemeral; the SDK intent journal is the sole
 * durable recovery record and contains no recovery phrase. Do not log either.
 * Automatic SDK transactions are disabled, not merely hidden from the UI.
 */
export function createAppWalletSession<W extends Disposable = Wallet>(options: {
  playerProof?: AppPlayerProof;
  marketplacePayment?: (account: WalletAccount, inputs: readonly { txid: string; vout: number }[]) => string | undefined;
  createWallet?: (config: Configuration) => Promise<W>;
  acquisitionMs?: number; retirementMs?: number;
} = {}) {
  const slots = new Map<Role, Slot<W>>();
  const generations: Record<Role, number> = { player: 0, game: 0 };
  let closed = false;
  const factory = options.createWallet ?? (config => Wallet.create(config) as unknown as Promise<W>);
  const same = (slot: Slot<W>, account: WalletAccount) => slot.account.profileId === account.profileId &&
    walletSourceKey(slot.account) === walletSourceKey(account) && (slot.account.network ?? 'signet') === (account.network ?? 'signet') &&
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
  async function acquireSlot(role: Role, account: WalletAccount, signal: AbortSignal, earlyAddresses=false): Promise<Slot<W>> {
    signal.throwIfAborted();
    if (closed) throw Error('Wallet session closed.');
    let slot = slots.get(role);
    if (slot && (!same(slot, account) || slot.controller.signal.aborted)) {
      if (!slot.controller.signal.aborted) void invalidate(role).catch(() => {});
      await detached(bounded(cleanup(slot), options.retirementMs ?? 20000), signal);
      if (slots.get(role) === slot) slots.delete(role);
      return acquireSlot(role, account, signal,earlyAddresses);
    }
    if (!slot) {
      const controller = new AbortController();
      const network = account.network ?? 'signet', operator = operatorFor(network);
      const readOperator = arkadeReadOperatorFor(network);
      const arkProvider = new RestArkProvider(readOperator);
      let resolveAddresses!: (value:AccountAddresses) => void;
      let rejectAddresses!: (reason:unknown) => void;
      const addresses = new Promise<AccountAddresses>((resolve,reject)=>{resolveAddresses=resolve;rejectAddresses=reject;});
      // A role may be acquired for balance only; rejection is still observed.
      void addresses.catch(()=>{});
      const getInfo = arkProvider.getInfo.bind(arkProvider);
      const loadInfo = async () => {
        try {
          const info = await getInfo(); requireNetwork(info.network, network);
          const addressIdentity='server' in account?await readonlyIdentity(account):identity;
          void projectConfiguredAddresses(addressIdentity,info,network).then(resolveAddresses,rejectAddresses);
          return info;
        } catch(error) {rejectAddresses(error);throw error;}
      };
      // Start the one bootstrap configuration read alongside mnemonic key
      // derivation. SDK setup consumes this exact promise once; subsequent
      // provider reads still fetch live configuration normally.
      let bootstrapInfo:ReturnType<typeof loadInfo>|undefined;
      const startInfo=()=>{if(!bootstrapInfo){bootstrapInfo=loadInfo();void bootstrapInfo.catch(()=>{});}return bootstrapInfo;};
      let bootstrapConsumed=false;
      arkProvider.getInfo=()=>{
        if(!bootstrapConsumed){bootstrapConsumed=true;return startInfo();}
        return loadInfo();
      };
      // MnemonicIdentity construction performs synchronous seed/HD work too.
      // Start I/O first so that cost overlaps the bootstrap response wait.
      if(earlyAddresses)startInfo();
      const signingOperation: { active?: ServerSigningOperation } = {};
      const identity = signingIdentity(account, () => signingOperation.active);
      const config: Configuration = {
        identity,
        arkProvider, indexerProvider: shareIndexerReads(new RestIndexerProvider(readOperator), operator),
        onchainProvider:new EsploraProvider(testNetwork(network).explorerApiUrl,{forcePolling:true,pollingInterval:15000}),
        storage: {
          walletRepository: new InMemoryWalletRepository(),
          contractRepository: new InMemoryContractRepository(),
          intentRepository: settlementIntentRepository(role,account),
        },
        settlementConfig: false,
        watcherConfig: { failsafePollIntervalMs: 60000, reconnectDelayMs: 60000, maxReconnectAttempts: 1 },
      };
      slot = { generation: ++generations[role], account: { ...account }, operator, controller,
        pending: Promise.resolve().then(() => factory(config)), addresses, startAddresses:()=>{void startInfo();}, lane: Promise.resolve(), users: 0, signingOperation };
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
    if(earlyAddresses&&!slot.wallet)slot.startAddresses();
    return slot;
  }
  async function acquire(role:Role, account:WalletAccount, signal:AbortSignal) {
    const slot=await acquireSlot(role,account,signal);
    const selected = slot;
    const wallet = await detached(selected.pending, AbortSignal.any([signal, selected.controller.signal]));
    if (!current(role, selected)) throw Error('Wallet session retired.');
    return { wallet, slot: selected };
  }

  async function borrow<T>(role: Role, account: WalletAccount, signal: AbortSignal,
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
    const signingOperation: ServerSigningOperation | undefined = exclusive ? Object.freeze({ id: crypto.randomUUID(), signal: leaseSignal, playerProof: options.playerProof, payment: {}, settlement: {},submission:{authorizations:[]} }) : undefined;
    if (signingOperation) slot.signingOperation.active = signingOperation;
    slot.users++;
    const execution=Promise.resolve().then(async()=>{
      const resource = wallet as unknown as Wallet;
      if (!signingOperation || !('server' in account) || typeof resource.buildAndSubmitOffchainTx !== 'function') return use(wallet,leaseSignal);
      const original = resource.buildAndSubmitOffchainTx;
      const originalSettle = resource.settle;
      const arkProvider=resource.arkProvider;
      const originalArkSubmit=arkProvider?.submitTx,originalArkFinalize=arkProvider?.finalizeTx;
      if(arkProvider){
        arkProvider.submitTx=async(signedArkTx,checkpointTxs)=>submitServerArkadeTransaction(account,signingOperation,signedArkTx,checkpointTxs);
        arkProvider.finalizeTx=async(arkTxid,finalCheckpointTxs)=>finalizeServerArkadeTransaction(account,signingOperation,arkTxid,finalCheckpointTxs);
      }
      if (typeof originalSettle === 'function' && role === 'game') resource.settle = async function(params, callback) {
        leaseSignal.throwIfAborted();
        const selected = params ?? await selectImplicitServerSettlement(this);
        leaseSignal.throwIfAborted();
        const previous = signingOperation.settlement!.active;
        const gameAddress = await this.getAddress();
        leaseSignal.throwIfAborted();
        const settlement = prepareServerSettlement(selected, account.network ?? 'signet', account.server.publicKey, gameAddress);
        signingOperation.settlement!.active = settlement;
        try { return await originalSettle.call(this, selected, async event => {
          // No await before capture: SDK batch handling starts immediately.
          if (!leaseSignal.aborted && signingOperation.settlement!.active === settlement) captureServerSettlementEvent(settlement, event);
          await callback?.(event);
        }); }
        finally { signingOperation.settlement!.active = previous; }
      };
      resource.buildAndSubmitOffchainTx = async function(inputs, outputs) {
        leaseSignal.throwIfAborted();
        const previous = signingOperation.payment!.active;
        const outpoints = inputs.map(input => ({ txid: input.txid, vout: input.vout }));
        signingOperation.payment!.active = { outpoints, ...(role === 'game' ? { marketplacePayment: options.marketplacePayment?.(account, outpoints) } : {}) };
        try { return await original.call(this,inputs,outputs); }
        finally { signingOperation.payment!.active = previous; }
      };
      try { return await use(wallet,leaseSignal); }
      finally { resource.buildAndSubmitOffchainTx = original; resource.settle = originalSettle;if(arkProvider){arkProvider.submitTx=originalArkSubmit;arkProvider.finalizeTx=originalArkFinalize;} }
    }).then(result=>{
        leaseSignal.throwIfAborted();
        if (!current(role, slot)) throw Error('Wallet session retired.');
        return result;
    }).finally(()=>{
      // Caller cancellation does not release or replace this binding. Only the
      // actual SDK execution can finish the lease and admit the next operation.
      if (signingOperation && slot.signingOperation.active === signingOperation) slot.signingOperation.active = undefined;
      if(--slot.users===0)slot.drained?.();release?.();
    });
    // Caller/local logout can leave immediately. The actual SDK execution still
    // owns its lane and resource until it stops; replacement stays quarantined.
    return detached(execution,leaseSignal);
  }
  return {
    hasActiveSigning(role: Role) { return slots.get(role)?.signingOperation.active !== undefined; },
    async addresses(role:Role,account:WalletAccount,signal:AbortSignal):Promise<AccountAddresses> {
      const slot=await acquireSlot(role,account,signal,true);
      const active=AbortSignal.any([signal,slot.controller.signal,AbortSignal.timeout(options.acquisitionMs ?? 20000)]);
      // A completed wallet remains authoritative if its receive address changes.
      const fromWallet=async (resource:W)=>{
        const wallet=resource as unknown as Pick<Wallet,'getAddress'|'getBoardingAddress'>;
        const [arkadeAddress,bitcoinAddress]=await Promise.all([wallet.getAddress(),wallet.getBoardingAddress()]);
        return Object.freeze({arkadeAddress,bitcoinAddress});
      };
      // Hosted identities expose public addresses from the read-only projection.
      // Calling Wallet.getAddress() can initialize the server signer session
      // even though rendering an address needs no signing capability.
      const result=await ('server' in account||!slot.wallet ? detached(slot.addresses,active) : borrow(role,account,active,fromWallet));
      active.throwIfAborted();
      if(!current(role,slot)||!same(slot,account))throw Error('Wallet session retired.');
      return result;
    },
    // Read capability has no submission methods; both capabilities use one SDK object.
    read<T>(role: Role, account: WalletAccount, signal: AbortSignal, use: (wallet: W extends Wallet ? ReadWallet : W, signal: AbortSignal) => Promise<T>) {
      return borrow(role, account, signal, use as (wallet: W, signal: AbortSignal) => Promise<T>);
    },
    sign<T>(role: Role, account: WalletAccount, signal: AbortSignal, use: (wallet: W, signal: AbortSignal) => Promise<T>) {
      return borrow(role, account, signal, use, true);
    },
    /** Direct contract adapters use the same exclusive Game lease as SDK sends.
     * They prepare and submit themselves; this supplies only the scoped signer.
     */
    signContract<T>(account: WalletAccount, signal: AbortSignal, use: (identity: ReturnType<typeof signingIdentity>, prepare: (inputs: readonly { txid: string; vout: number }[], contract: ServerContractIntent) => void,treasure?:AppTreasureServerCapability) => Promise<T>) {
      return borrow('game', account, signal, async (_wallet, active) => {
        const slot = slots.get('game'), operation = slot?.signingOperation.active;
        if (!slot || !operation || !current('game', slot)) throw Error('Game signing operation ended.');
        const identity = signingIdentity(account, () => slot.signingOperation.active);
        const authority='server' in account?serverTreasureAuthority(account):undefined;
        const treasure:AppTreasureServerCapability|undefined=authority&&'server' in account?{authority,
          transport:persistence=>createLeasedTreasureServerTransport(account,()=>slot.signingOperation.active,{
            ...persistence,signal:AbortSignal.any([active,persistence.signal??new AbortController().signal]),
            isCurrent:()=>current('game',slot)&&slot.signingOperation.active===operation&&persistence.isCurrent(),
          })}:undefined;
        return use(identity, (inputs, contract) => {
          active.throwIfAborted();
          if (!current('game', slot) || slot.signingOperation.active !== operation) throw Error('Game signing operation ended.');
          operation.payment!.active = { outpoints: inputs.map(({ txid, vout }) => ({ txid, vout })), contract: Object.freeze({ ...contract }) };
        },treasure);
      }, true);
    },
    // Any operation needing simultaneous role leases uses this fixed order;
    // ordinary payer/recipient operations borrow only the submitting role.
    signBoth<T>(accounts:{player:WalletAccount;game:WalletAccount},signal:AbortSignal,use:(wallets:{player:W;game:W},signal:AbortSignal)=>Promise<T>){
      return borrow('player',accounts.player,signal,(player,playerSignal)=>
        borrow('game',accounts.game,playerSignal,(game,active)=>use({player,game},active),true),true);
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
