import { gamePlayerPayments, createGamePlayerPayments, assertPlayerPaymentAvailable, type BisPlayerRecipient } from './game-player-payment.ts';
import {createAppWalletSession} from '../wallet-layer-arkade/app-wallet-session.ts';
import {appWalletOwner,appPlayerEligible} from '../wallet-layer-arkade/app-wallet-composition.ts';
import {bindRoleWallet} from '../wallet-layer-arkade/adapter-session.ts';
import {quoteSend,submitSend,reconcileSend} from '../wallet-layer-arkade/sending.ts';
import { readSendRecord } from './sending.ts';
import { readLiveBoardingWait, readLiveBoardingState } from '../wallet-layer-arkade/boarding.ts';
import { watchGameWalletEvents } from '../wallet-layer-arkade/game-wallet-events.ts';
import { gameWalletBoarding } from './game-wallet-boarding.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { createAccount, restoreAccount, identify, type AccountSecret } from '../wallet-layer-arkade/account.ts';
import { loadAddresses, type AccountAddresses } from '../wallet-layer-arkade/addresses.ts';
import { loadBalance, type BalanceAmounts } from '../wallet-layer-arkade/balance.ts';
import { createGameWalletStorage, type GameWalletStorage } from './game-wallet-storage.ts';
import { WalletRoleConflictError, withWalletRoleSelection } from './wallet-role.ts';
import {burnWalletAsset,deliverWalletAsset,listWalletAssets,loadMintAvailability,mintWalletAsset,reconcileWalletAssetDelivery} from '../wallet-layer-arkade/assets.ts';
import {withWalletMutation} from './boarding-record.ts';
import {validateMint,assetError,AssetError,readAssetRecords,type BisListAssetsResult,type BisMintAssetRequest,type BisMintAssetResult} from './assets.ts';
import {BurnError,validateBurn,readBurnRecord,type BisBurnAssetRequest,type BisBurnAssetResult} from './burning.ts';
import {AssetDeliveryError,readAssetDeliveryRecord,validateAssetDelivery,type BisAssetDeliveryRequest,type BisAssetDeliveryResult,type BisPendingAssetDeliveryResult} from './asset-delivery.ts';
import { testNetworks, type TestNetwork } from './test-network.ts';
import { readWithRetry } from './pending-read.ts';
import { clearBrowserGameWalletPreferences } from './logout-cleanup.ts';
import { prepareSharedAssetInventory, invalidateSharedAssetInventory } from './shared-asset-inventory.ts';
import { diagnoseAssetFailure } from './asset-operation-diagnostics.ts';
import { walletSourceKey, type WalletAccount } from '../wallet-layer-arkade/wallet-identity.ts';
import { createServerFirstStorage, createServerProfileMemory } from './server-first-game-wallet.ts';
import { walletReservations } from './wallet-reservations.ts';
import type { ServerWalletRequirement } from '../wallet-layer-arkade/server-wallet.ts';
import type {GameWalletWorkflowMode} from './game-wallet-workflow.ts';
import { readLocalMarketplaceCheckouts, readLocalMarketplaceCheckout } from './marketplace-checkout.ts';

const hasPendingGameCheckout = (profileId:string) => readLocalMarketplaceCheckouts().some(record=>record.status==='pending'&&record.request.game.profileId===profileId);

export type BisGameWalletReadStatus = 'storage' | 'wallet-read' | 'observation' | 'role-conflict' | 'network-mismatch';
export type BisGameWalletAvailabilityReason = 'player-wallet' | 'game-wallet' | 'role-conflict' | 'network-mismatch' | 'wallet-read' | 'insufficient-funds' | 'unresolved-operation' | 'ready';
export type BisGameWalletOperationScope = Readonly<{playerProfileId?: string; gameProfileId?: string; network: TestNetwork; selectionVersion: number}>;
export type BisGameWalletAvailability = Readonly<{available: boolean; reason: BisGameWalletAvailabilityReason; message: string; scope: BisGameWalletOperationScope}>;
export type BisGameWalletState = Readonly<{
  workflowMode?:GameWalletWorkflowMode;
  source?: 'server' | 'manual'; serverStatus?: 'connected' | 'absent' | 'error'; serverMessage?: string;
  status: 'loading' | 'empty' | 'ready' | 'unavailable';
  profileId?: string; addresses?: AccountAddresses; balance?: BalanceAmounts; message?: string; readStatus?: BisGameWalletReadStatus; selectionVersion?: number; playerConnected?: boolean; network?: TestNetwork;
}>;
const activeGameStores = new WeakMap<object, GameWalletStorage<WalletAccount>>();
/** Private capability for contract adapters; never a package export. */
export const gameWalletAccountStore = (wallet: object) => activeGameStores.get(wallet);
export function createBisGameWallet(...args:Parameters<typeof createLocalGameWallet>):ReturnType<typeof createLocalGameWallet> {
  if (args.length === 1) {
    const [options] = args;
    const shared=appWalletOwner(options.playerSubscribe),owner=shared??createAppWalletSession(),access=bindRoleWallet(owner,'game');
    const backend=createServerFirstStorage(
      createNetworkScopedGameWalletStorage(options.playerNetwork ?? (() => undefined)),
      () => options.playerNetwork?.() ?? 'signet', undefined,
      createServerProfileMemory(globalThis.localStorage), undefined, options.manualWalletOnly === true,
    );
    const storage=backend.storage;
    const eligible=appPlayerEligible(options.playerSubscribe)??(()=>true);
    const effectiveOptions={...options,
      playerProfileId:()=>eligible()?options.playerProfileId():undefined,
      playerSessionKey:()=>JSON.stringify([options.playerSessionKey?.()??[options.playerProfileId(),options.playerNetwork?.()],eligible()]),
    };
    const controller=createLocalGameWallet(effectiveOptions, {
      storage, probe:backend.refresh, source:backend.source,restore:async(p,s,n)=>{
        if(await identify(p)===options.playerProfileId())throw new WalletRoleConflictError('Select a separate Game Wallet.');
        // Restore validation must not depend on a complete retained-wallet
        // snapshot. A valid but empty/fresh Signet wallet still needs to be
        // importable when contract or indexer reads are unavailable; the
        // retained Game session is acquired after selection for normal reads.
        return restoreAccount(p,s,n);
      },create:(s,n)=>createAccount(s,n,access),
      selectForOperation:(account,requirement,signal,current)=>{
        const player=options.playerProfileId();
        return backend.selectForOperation(account,{...requirement,...(player&&/^[0-9a-f]{64}$/.test(player)?{excludedProfiles:[player]}:{})},signal,candidate=>current()&&(!candidate||candidate.profileId!==options.playerProfileId())&&!owner.hasActiveSigning('game')&&!hasPendingGameCheckout(account.profileId)&&walletReservations(account.profileId,account.network??'signet').length===0);
      },
      addresses:(a,s)=>loadAddresses(a,s,access),balance:(a,s)=>loadBalance(a,s,access),
      watch:async(_address,signal,changed)=>{const account=await storage.load();if(!account)throw Error('Game wallet changed.');return access.observe(account,signal,()=>{void changed();});},
      retire:()=>{void access.retire().catch(()=>{});},
      dispose:()=>{if(shared)void access.retire().catch(()=>{});else void owner.dispose();},
      liveBoardingState:(a,s)=>readLiveBoardingState(a,s,access),liveBoardingWait:(a,s)=>readLiveBoardingWait(a,s,access),
      deliver:(a,r,s,c)=>deliverWalletAsset(a,r,s,c,access),reconcileDelivery:(a,id,s)=>reconcileWalletAssetDelivery(a,id,s,access),
    },{
      quote:(a,s,n)=>gameWalletBoarding.quote(a,s,n,access),submit:(a,q,c)=>gameWalletBoarding.submit(a,q,c,access),check:(a,s)=>gameWalletBoarding.check(a,s,access),
    },createGamePlayerPayments({quote:(a,r,n,s,p,i)=>quoteSend(a,r,n,s,p,i,access),submit:(a,q,c,j,p,i)=>submitSend(a,q,c,j,p,i,access),reconcile:reconcileSend}),assertPlayerPaymentAvailable,{
      availability:(a,s)=>loadMintAvailability(a,s,access),mint:(a,r,s,c)=>mintWalletAsset(a,r,s,c,access),
      list:(a,s)=>listWalletAssets(a,s,access),burn:(a,r,s,c)=>burnWalletAsset(a,r,s,c,access),
    });
    activeGameStores.set(controller, storage);
    controller.subscribe(()=>{const state=controller.getState();if(state.status==='ready'||state.status==='empty')owner.select('game',state.profileId,state.network);});
    return controller;
  }
  return createLocalGameWallet(...args);
}
/**
 * The Player context owns the network preference. Resolve the Game Wallet store
 * at each operation boundary so a wallet selected on Signet can never be read
 * as the active Mutinynet wallet after the Player context changes network.
 */
export function createNetworkScopedGameWalletStorage(selectedNetwork: () => TestNetwork | undefined, createStorage: (network: TestNetwork) => GameWalletStorage = createGameWalletStorage): GameWalletStorage {
  const stores = new Map<TestNetwork, GameWalletStorage>();
  const subscriptions = new Map<() => void, Map<GameWalletStorage, () => void>>();
  const current = () => {
    const network = selectedNetwork() ?? 'signet';
    let store = stores.get(network);
    if (!store) { store = createStorage(network); stores.set(network, store); }
    for (const [listener, attached] of subscriptions) {
      if (!attached.has(store)) attached.set(store, store.subscribe(listener));
    }
    return store;
  };
  const all = () => testNetworks.map(({id}) => {
    let store = stores.get(id);
    if (!store) { store = createStorage(id); stores.set(id, store); }
    return store;
  });
  return Object.freeze({
    load: () => current().load(),
    select: (account: AccountSecret) => current().select(account),
    logout: () => Promise.all(all().map(store => store.logout())).then(() => undefined),
    reset: () => Promise.all(all().map(store => store.reset())).then(() => undefined),
    subscribe(listener: () => void) {
      const attached = new Map<GameWalletStorage, () => void>();
      subscriptions.set(listener, attached);
      current();
      return () => { for (const unsubscribe of attached.values()) unsubscribe(); subscriptions.delete(listener); };
    },
    dispose() {
      for (const attached of subscriptions.values()) for (const unsubscribe of attached.values()) unsubscribe();
      subscriptions.clear(); for (const store of stores.values()) store.dispose(); stores.clear();
    },
  });
}
type GameWalletDependencies = {
  selectForOperation?(account:WalletAccount,requirement:ServerWalletRequirement,signal:AbortSignal,current:()=>boolean):Promise<WalletAccount>;
  probe?():Promise<void>;
  source?():Pick<BisGameWalletState,'source'|'serverStatus'|'serverMessage'|'workflowMode'>;
  retire?():void;
  dispose?():void;
  liveBoardingState?:Two<typeof readLiveBoardingState>;
  liveBoardingWait?:Two<typeof readLiveBoardingWait>;
  deliver?:Four<typeof deliverWalletAsset>;
  reconcileDelivery?:(account:WalletAccount,id:string,signal:AbortSignal)=>ReturnType<typeof reconcileWalletAssetDelivery>;
  storage: GameWalletStorage<WalletAccount>;
  restore: (phrase:string,signal:AbortSignal,network?:TestNetwork)=>Promise<AccountSecret>;
  create?: (signal:AbortSignal,network?:TestNetwork)=>Promise<AccountSecret>;
  addresses: Two<typeof loadAddresses>;
  balance: Two<typeof loadBalance>;
  watch: typeof watchGameWalletEvents | undefined;
};
// Adapter resource capabilities never become parameters in the public controller.
type Two<F extends (...args:never[])=>unknown>=(a:Parameters<F>[0],b:Parameters<F>[1])=>ReturnType<F>;
type Three<F extends (...args:never[])=>unknown>=(a:Parameters<F>[0],b:Parameters<F>[1],c:Parameters<F>[2])=>ReturnType<F>;
type Four<F extends (...args:never[])=>unknown>=(a:Parameters<F>[0],b:Parameters<F>[1],c:Parameters<F>[2],d:Parameters<F>[3])=>ReturnType<F>;
export type GameWalletPlayerOptions = { playerProfileId(): string | undefined; playerNetwork?(): TestNetwork | undefined; playerSubscribe?(listener:()=>void):()=>void; playerSessionKey?():string; manualWalletOnly?: boolean };
export function createLocalGameWallet(options: GameWalletPlayerOptions, dependencies: GameWalletDependencies = {
  storage: createGameWalletStorage(), restore: restoreAccount, create: createAccount, addresses: loadAddresses, balance: loadBalance, watch: watchGameWalletEvents,
}, boarding: {quote:Three<typeof gameWalletBoarding.quote>;submit:(a:WalletAccount,q:BoardingQuote,c:()=>boolean)=>ReturnType<typeof gameWalletBoarding.submit>;check:Two<typeof gameWalletBoarding.check>} = gameWalletBoarding, payments = gamePlayerPayments, availability = assertPlayerPaymentAvailable, minting: {availability:Two<typeof loadMintAvailability>;mint:Four<typeof mintWalletAsset>;list?:Two<typeof listWalletAssets>;burn?:Four<typeof burnWalletAsset>} = {availability:loadMintAvailability,mint:mintWalletAsset,list:listWalletAssets,burn:burnWalletAsset}) {
  const storage = dependencies.storage;
  let selectionVersion = 0, selectedProfileId: string | undefined;
  let state: BisGameWalletState = Object.freeze({status:'loading',...dependencies.source?.(),selectionVersion});
  let operation = new AbortController(), disposed = false, importing = false, refreshQueued = false;
  // A saved Game Wallet's public addresses do not authorize any operation. Start
  // deriving them while Player storage is hydrating so connected Marketplace
  // labels do not inherit that otherwise unrelated startup delay. The result is
  // deliberately not published until the normal Player-scoped inspection below.
  const addressPrewarm = new AbortController();
  let prewarming: Promise<void> | undefined;
  let prewarmingSource: string | undefined;
  let prewarmedAddresses: { source: string; value: AccountAddresses } | undefined;
  const listeners = new Set<() => void>();
  const selectedNetwork = () => options.playerNetwork?.() ?? 'signet';
  const playerConnected = () => !!options.playerProfileId();
  const clearBrowserState = () => {
    clearBrowserGameWalletPreferences(globalThis.localStorage);
    clearBrowserGameWalletPreferences(globalThis.sessionStorage);
  };
  const publish = (next: Omit<BisGameWalletState,'selectionVersion'> | BisGameWalletState) => { if (!disposed) { state = Object.freeze({...next,...dependencies.source?.(),selectionVersion,playerConnected:playerConnected(),network:selectedNetwork()}); listeners.forEach(l => l()); } };
  const selectProfile = (profileId: string | undefined) => {
    if (profileId === selectedProfileId) return;
    selectedProfileId = profileId;
    selectionVersion++;
  };
  const playerScope=()=>options.playerSessionKey?.() ?? JSON.stringify([options.playerProfileId(),selectedNetwork()]);
  const readScopes=new WeakMap<AbortSignal,string>();
  const begin = () => { operation.abort(); operation = new AbortController();readScopes.set(operation.signal,playerScope()); return operation.signal; };
  const currentRead=(signal:AbortSignal)=>!disposed&&!signal.aborted&&signal===operation.signal&&readScopes.get(signal)===playerScope();
  function prewarmStoredAddresses() {
    if (prewarming || disposed || addressPrewarm.signal.aborted) return;
    prewarming = (async () => {
      try {
        const account = await storage.load();
        if (!account || addressPrewarm.signal.aborted) return;
        const scopedAccount = {...account,network:account.network ?? selectedNetwork()};
        const source = walletSourceKey(scopedAccount);
        prewarmingSource = source;
        const value = await dependencies.addresses(scopedAccount,addressPrewarm.signal);
        if (!addressPrewarm.signal.aborted && !disposed) prewarmedAddresses = {source,value};
      } catch {
        // The normal Player-scoped read owns visible unavailable/mismatch state.
      }
    })().finally(() => { prewarming = undefined; prewarmingSource = undefined; });
  }
  async function inspect(account: WalletAccount | null, signal: AbortSignal, selectFunded = true) {
    if (!currentRead(signal)) return;
    if (account) account={...account,network:account.network ?? selectedNetwork()};
    selectProfile(account?.profileId);
    if (!account) { publish({status:'empty'}); return; }
    const previous = state.profileId === account.profileId ? state : undefined;
    publish({status:'loading', profileId:account.profileId, ...(previous?.addresses ? {addresses:previous.addresses} : {}), ...(previous?.balance ? {balance:previous.balance} : {})});
    // Address discovery is enough for read-only Marketplace inventory. Keep
    // the balance read concurrent, but publish the address as soon as it is
    // available instead of making inventory wait for the slower balance read.
    const addressesTask=(async()=>{
      const source=walletSourceKey(account);
      const takePrewarmed=()=>{
        if(prewarmedAddresses?.source!==source)return undefined;
        const value=prewarmedAddresses.value;
        prewarmedAddresses=undefined;
        return value;
      };
      let value=takePrewarmed();
      if(!value&&prewarming&&prewarmingSource===source){
        await prewarming;
        value=takePrewarmed();
      }
      return value??readWithRetry(attemptSignal => dependencies.addresses(account, attemptSignal), signal);
    })().then(value=>{
      if (!currentRead(signal)) return value;
      publish({status:'loading',profileId:account.profileId,addresses:value,...(previous?.balance ? {balance:previous.balance} : {})});
      return value;
    });
    const balanceTask=readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
    const [addresses, balance] = await Promise.allSettled([addressesTask, balanceTask]);
    if (!currentRead(signal)) return;
    let selectionMessage: string | undefined;
    if (selectFunded && 'server' in account && balance.status === 'fulfilled' && balance.value.availableSats < 1000 && dependencies.selectForOperation) {
      try {
        const next = await dependencies.selectForOperation(account,{arkadeSats:1000},signal,()=>currentRead(signal)&&!hasPendingGameCheckout(account!.profileId));
        if (!currentRead(signal)) return;
        if (next.profileId !== account.profileId) { await inspect(next,signal,false); return; }
      } catch (error) {
        if (!currentRead(signal)) return;
        selectionMessage = error instanceof Error ? error.message : 'Funded Game Wallet selection unavailable. Retry.';
      }
    }
    publish({status: addresses.status === 'fulfilled' && balance.status === 'fulfilled' ? 'ready' : 'unavailable', profileId:account.profileId,
      ...(selectionMessage ? {message:selectionMessage} : {}),
      ...(addresses.status === 'fulfilled' ? {addresses:addresses.value} : {}),
      ...(balance.status === 'fulfilled' ? {balance:balance.value} : {}),
      ...(addresses.status === 'rejected' || balance.status === 'rejected' ? {message:'Game wallet reads unavailable. Use Details to retry.',readStatus:'wallet-read' as const} : {})});
    if (addresses.status === 'fulfilled' && dependencies.watch) {
      const watch = () => dependencies.watch!(addresses.value.arkadeAddress, signal, async () => {
        if (!currentRead(signal)) return;
        try {
          const next = await readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
          if (currentRead(signal)) publish({...state, status:'ready', balance:next, message:undefined});
        } catch {
          if (currentRead(signal)) publish({...state, status:'unavailable', balance:undefined, message:'Live balance unavailable. Use Details to retry.',readStatus:'observation'});
        }
      }, undefined, account.network ?? 'signet');
      void watch().catch(async () => {
        if (!currentRead(signal)) return;
        try {
          const next = await readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
          if (!currentRead(signal)) return;
          publish({...state, status:'ready', balance:next, message:undefined});
          void watch();
        } catch {
          if (currentRead(signal)) publish({...state, status:'unavailable', balance:undefined, message:'Live balance disconnected. Use Details to reconnect.',readStatus:'observation'});
        }
      });
    }
  }
  let refreshing:Promise<void>|undefined,refreshingScope:string|undefined;
  function refresh(force=true):Promise<void> {
    const scope=playerScope();
    if(!force&&refreshing&&refreshingScope===scope&&!operation.signal.aborted)return refreshing;
    refreshingScope=scope;
    const work=runRefresh();refreshing=work;
    void work.finally(()=>{if(refreshing===work)refreshing=undefined;});
    return work;
  }
  async function runRefresh() {
    if (disposed) return;
    if (importing) { refreshQueued = true; return; }
    const expectedScope=playerScope(),expectedNetwork=selectedNetwork();
    if(dependencies.probe){publish({...state,status:'loading'});await dependencies.probe();}
    if(disposed||expectedScope!==playerScope()||expectedNetwork!==selectedNetwork())return;
    if (!playerConnected()) { prewarmStoredAddresses(); begin(); selectProfile(undefined); publish({status:'empty',message:'Connect a Player Wallet before using the Game Wallet.'}); return; }
    const signal = begin(); publish({status:'loading', profileId:state.profileId, ...(state.addresses ? {addresses:state.addresses} : {}), ...(state.balance ? {balance:state.balance} : {})});
    try {
      let account=await storage.load();
      if(!currentRead(signal))return;
      if(account&&'server' in account&&account.profileId===options.playerProfileId()&&dependencies.selectForOperation) {
        try { account=await dependencies.selectForOperation(account,{},signal,()=>currentRead(signal)&&!hasPendingGameCheckout(account!.profileId)); }
        catch { /* The specific role-conflict state below remains authoritative. */ }
        if(!currentRead(signal))return;
      }
      if(account?.profileId===options.playerProfileId() || (account?.network !== undefined && account.network !== selectedNetwork())) {
        const roleConflict = account?.profileId===options.playerProfileId();
        selectProfile(undefined);publish({status:'unavailable',message:roleConflict ? 'This wallet is already configured as the Player Wallet. Select a separate Game Wallet.' : 'This Game Wallet belongs to another network. Select a wallet on the active Player network.',readStatus:roleConflict ? 'role-conflict' : 'network-mismatch'});return;
      }
      await inspect(account, signal);
    }
      catch { if (currentRead(signal)) publish({status:'unavailable', message:'Game wallet storage unavailable. Use Details to retry.',readStatus:'storage'}); }
  }
  const unsubscribe = storage.subscribe(() => {
    // External replacement invalidates the signer before an asynchronous store
    // reload. Our own candidate selection is promoted, not retired/recreated.
    if(!importing)dependencies.retire?.();
    begin();refreshing=undefined;void refresh(false);
  });
  let observedPlayerScope=playerScope();
  const unsubscribePlayer=options.playerSubscribe?.(()=>{
    const next=playerScope();if(next===observedPlayerScope)return;
    observedPlayerScope=next;begin();void refresh(false);
  });
  void refresh(false);
  async function selectedAccount() {
    const signal=operation.signal,scope=playerScope();
    const account = await readWithRetry(() => storage.load(),signal,30000,1);
    if (disposed || signal.aborted || signal!==operation.signal || scope!==playerScope() || importing || !playerConnected() || !account || account.profileId !== state.profileId || account.profileId === options.playerProfileId() || (account.network !== undefined && account.network !== selectedNetwork())) throw Error('Connect a Player Wallet and select a separate Game Wallet first.');
    return {...account,network:account.network ?? selectedNetwork()};
  }
  async function newOperationAccount(requirement:ServerWalletRequirement, existing?: (account:WalletAccount)=>boolean) {
    const signal=operation.signal,scope=playerScope(),account=await selectedAccount();
    if(!dependencies.selectForOperation||!('server' in account)||existing?.(account))return {account,signal};
    if(hasPendingGameCheckout(account.profileId))throw Error('A Marketplace checkout is pinned to this Game Wallet. Reconcile it before selecting another signer.');
    const next=await dependencies.selectForOperation(account,requirement,signal,()=>!disposed&&!signal.aborted&&signal===operation.signal&&scope===playerScope()&&state.profileId===account.profileId&&!hasPendingGameCheckout(account.profileId));
    if(disposed||signal.aborted||signal!==operation.signal||scope!==playerScope())throw Error('The player or game wallet changed.');
    if(next.profileId===account.profileId)return {account,signal};
    const fresh=begin();
    await inspect(next,fresh,false);
    return {account:await selectedAccount(),signal:fresh};
  }
  async function selectSeparateGameWallet(account: AccountSecret, signal: AbortSignal) {
    if (!playerConnected() || (account.network !== undefined && account.network !== selectedNetwork())) throw Error('Connect a Player Wallet on the same network first.');
    await withWalletRoleSelection(account.profileId,options.playerProfileId,'This wallet is already configured as the Player Wallet. Restore or create a separate Game Wallet.',async()=>{
      await storage.select(account);signal.throwIfAborted();selectProfile(account.profileId);publish({status:'loading',profileId:account.profileId});
    });
    await inspect(account,signal);
  }
  let paying = false;
  const getOperationScope = (): BisGameWalletOperationScope => Object.freeze({
    playerProfileId: options.playerProfileId(),
    gameProfileId: state.profileId,
    network: selectedNetwork(),
    selectionVersion,
  });
  function getOperationAvailability(): BisGameWalletAvailability {
    const scope = getOperationScope();
    if (!scope.playerProfileId) return {available:false, reason:'player-wallet', message:'Connect a Player Wallet first.', scope};
    if (state.readStatus === 'role-conflict') return {available:false, reason:'role-conflict', message:'The Player Wallet and Game Wallet must be different.', scope};
    if (state.readStatus === 'network-mismatch') return {available:false, reason:'network-mismatch', message:'Player Wallet and Game Wallet must use the same network.', scope};
    if (!scope.gameProfileId) return {available:false, reason:'game-wallet', message:'Select a separate Game Wallet first.', scope};
    if (scope.playerProfileId === scope.gameProfileId) return {available:false, reason:'role-conflict', message:'The Player Wallet and Game Wallet must be different.', scope};
    if (state.status === 'loading' || state.status === 'unavailable' || !state.balance) return {available:false, reason:'wallet-read', message:state.message ?? 'Game Wallet public data is unavailable. Refresh and retry.', scope};
    try { availability(scope.gameProfileId,scope.network); }
    catch (error) { return {available:false, reason:'unresolved-operation', message:error instanceof Error ? error.message : 'A previous wallet operation is unresolved.', scope}; }
    if (state.balance.availableSats < 1000) return {available:false, reason:'insufficient-funds', message:'The Game Wallet has fewer than 1,000 spendable sats.', scope};
    return {available:true, reason:'ready', message:'Game Wallet is ready for the requested operation.', scope};
  }
  function getPlayerPaymentBlockReason(): string | undefined {
    if (disposed || !state.profileId) return 'Awaiting Game Wallet';
    if (!options.playerProfileId()) return 'Awaiting Player';
    if (state.profileId === options.playerProfileId()) return 'Select A Different Wallet';
    if (paying) return 'Sending';
    try { availability(state.profileId,selectedNetwork()); }
    catch (error) {
      return error instanceof Error && error.message.startsWith('A transfer is unresolved.')
        ? 'Awaiting Confirmation' : 'Wallet Operation Unresolved';
    }
    if (state.status === 'loading') return 'Awaiting Balance';
    if (state.status !== 'ready' || !state.balance) return 'Wallet Unavailable';
    if (state.balance.availableSats < 1000) return 'Awaiting Balance';
  }
  return {
    async getMintAvailability() {
      try {const {account,signal}=await newOperationAccount({purpose:'mint'});return await minting.availability(account,signal);}
      catch {return {canMint:false,reason:state.profileId?'Balance unavailable':'Awaiting Game Wallet'};}
    },
    async getPendingAssetMint() {
      const account=await selectedAccount();
      return {status:'success' as const,profileId:account.profileId,request:readAssetRecords(account.profileId,account.network ?? 'signet').find(r=>r.status==='pending')?.request??null};
    },
    async getPendingAssetDelivery():Promise<BisPendingAssetDeliveryResult> {
      try {
        const account=await selectedAccount(), delivery=readAssetDeliveryRecord(account.profileId,undefined,account.network ?? 'signet');
        if(!delivery)return {status:'success',profileId:account.profileId,request:null};
        const mint=readAssetRecords(account.profileId,account.network ?? 'signet').find(record=>record.status==='succeeded'&&record.asset?.assetId===delivery.request.assetId);
        return {status:'success',profileId:account.profileId,request:delivery.request,...(mint?.request?{mintRequest:mint.request}:{})};
      } catch(error) { return {status:'error',code:'outcome-unknown',message:error instanceof Error?error.message:'Asset delivery recovery is unavailable.'}; }
    },
    async mintAsset(input:BisMintAssetRequest):Promise<BisMintAssetResult> {
      try {
        const request=validateMint(input);
        const {account,signal}=await newOperationAccount({purpose:'mint'},a=>readAssetRecords(a.profileId,a.network??'signet').some(record=>record.request.operationId===request.operationId));
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)return assetError('account-changed');
          const owner='bis-game-wallet-mint-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new AssetError('unavailable');
          const result=await minting.mint(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
          invalidateSharedAssetInventory(account.profileId, account.network, 'game');
          return result;
        },account.profileId,account.network ?? 'signet');
      } catch(error) {const code=error instanceof AssetError?error.code:'unavailable';return assetError(code,state.profileId,input.operationId,diagnoseAssetFailure({phase:'mint',error,profileId:state.profileId,operationId:input.operationId,network:selectedNetwork()}));}
    },
    getPlayerPaymentBlockReason,
    getOperationScope,
    getOperationAvailability,
    isOperationScopeCurrent(scope: BisGameWalletOperationScope) {
      const current = getOperationScope();
      return current.playerProfileId === scope.playerProfileId && current.gameProfileId === scope.gameProfileId && current.network === scope.network && current.selectionVersion === scope.selectionVersion;
    },
    getPlayerPaymentBalance(): number | undefined {
      if (disposed || state.status !== 'ready' || !state.profileId || !state.balance) return;
      try { availability(state.profileId,selectedNetwork()); }
      catch (error) {
        // Known unresolved operations reserve spending; unreadable state is unknown, not zero.
        return error instanceof Error && error.message.includes('unresolved') ? 0 : undefined;
      }
      return state.balance.availableSats;
    },
    canPayPlayer() { return getPlayerPaymentBlockReason() === undefined; },
    hasPendingPlayerPayment() { try { return !!state.profileId && readSendRecord(state.profileId,undefined,selectedNetwork())?.status === 'pending'; } catch { return true; } },
    async payPlayer(recipient: BisPlayerRecipient, amountSats=1000, playerCurrent: () => boolean = () => options.playerProfileId() === recipient.profileId, checkoutId?:string) {
      if (paying) throw Error('A payment is already in progress.');
      paying = true;
      try {
        if (recipient.profileId !== options.playerProfileId()) throw Error('The player changed.');
        let selected:{account:WalletAccount;signal:AbortSignal};
        if(checkoutId!==undefined) {
          const account=await selectedAccount(),record=readLocalMarketplaceCheckout(checkoutId);
          if(!record||record.status!=='pending'||record.phase!=='payment-submitted'||record.request.direction!=='sell'||record.request.game.profileId!==account.profileId||record.request.game.address!==state.addresses?.arkadeAddress||record.request.player.profileId!==recipient.profileId||record.request.player.address!==recipient.address||record.request.priceSats!==amountSats)throw Error('Marketplace payment scope changed. Reconcile the original checkout.');
          selected={account,signal:operation.signal};
        } else selected=await newOperationAccount({arkadeSats:amountSats});
        const {account,signal}=selected;
        return await payments.pay(account, recipient, amountSats, signal, () => !disposed && !signal.aborted && state.profileId === account.profileId && options.playerProfileId() === recipient.profileId && playerCurrent());
      } finally { paying = false; }
    },
    async checkPlayerPayment() { return payments.check(await selectedAccount(), operation.signal); },
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    async quoteBoarding(requestedSats?: number) {
      if (requestedSats !== undefined && (!Number.isSafeInteger(requestedSats) || requestedSats <= 0)) throw Error('Choose a positive whole-sat boarding amount.');
      const {account,signal}=await newOperationAccount({purpose:'boarding'});
      return boarding.quote(account, signal, requestedSats);
    },
    async board(quote: BoardingQuote) {
      const account = await selectedAccount();
      const signal = operation.signal;
      if (quote.profileId !== account.profileId) throw Error('Review a fresh boarding quote.');
      return boarding.submit(account, quote, () => !disposed && !signal.aborted && state.profileId === account.profileId);
    },
    async checkBoarding() {
      const account = await selectedAccount();
      return boarding.check(account, operation.signal);
    },
    async checkLiveBoardingState() {
      const signal = operation.signal;
      const account = await selectedAccount();
      const result = await (dependencies.liveBoardingState??readLiveBoardingState)(account, signal);
      if (disposed || signal.aborted || state.profileId !== account.profileId) throw Error('The game wallet changed.');
      return result;
    },
    async checkLiveBoardingWait() {
      const signal = operation.signal;
      const account = await selectedAccount();
      const waiting = await (dependencies.liveBoardingWait??readLiveBoardingWait)(account, signal);
      if (disposed || signal.aborted || state.profileId !== account.profileId) throw Error('The game wallet changed.');
      return waiting;
    },
    async logout() {
      if(state.source==='server')return;
      if (disposed || importing) return;
      dependencies.retire?.();
      const signal = begin();
      try { invalidateSharedAssetInventory(state.profileId, selectedNetwork(), 'game'); await storage.logout(); clearBrowserState(); if (!signal.aborted) { selectProfile(undefined); publish({status:'empty'}); } }
      catch { if (!signal.aborted) publish({...state, message:'Logout failed. Please retry.',readStatus:'storage'}); }
    },
    async reset() {
      if (disposed || importing) return false;
      dependencies.retire?.();
      const signal = begin();
      try { invalidateSharedAssetInventory(state.profileId, selectedNetwork(), 'game'); await storage.reset(); clearBrowserState(); if (!signal.aborted) { selectProfile(undefined); publish({status:'empty'}); } return true; }
      catch { if (!signal.aborted) publish({...state, message:'Game Wallet reset failed. Please retry.',readStatus:'storage'}); return false; }
    },
    async importWallet(phrase: string) {
      if(state.workflowMode==='server'||state.source==='server') { publish({...state,message:'The selected BIS Game Wallet is controlled by the game server. Retry its connection before starting new work.'}); return false; }
      if(state.serverStatus==='error'&&!options.manualWalletOnly) { publish({...state,message:state.serverMessage ?? 'The BIS Game Wallet source is unavailable. Check the connection and try again.'}); return false; }
      if (disposed || importing || !playerConnected()) { if (!disposed) publish({...state,message:'Connect a Player Wallet before using the Game Wallet.'}); return false; }
      importing = true; const previous = state, signal = begin(); publish({...previous, status:'loading', message:undefined});
      try {
        const account = await dependencies.restore(phrase, signal, selectedNetwork());
        signal.throwIfAborted();
        await selectSeparateGameWallet(account,signal);
        return true;
      } catch (error) {
        if (!signal.aborted) {
          const network = selectedNetwork() === 'signet' ? 'Signet' : 'Mutinynet';
          const message = error instanceof WalletRoleConflictError
            ? 'This recovery phrase belongs to the player wallet. Restore or create a separate game wallet.'
            : error instanceof Error && error.message === 'Invalid recovery phrase.'
              ? 'That recovery phrase is not valid. Check the words and try again.'
              : `Could not verify this wallet on ${network}. The phrase may be valid, but the ${network} service or wallet data was unavailable. Check the connection and try again.`;
          publish({...previous, message});
        }
        return false;
      } finally { importing = false; if (refreshQueued) { refreshQueued = false; void refresh(); } }
    },
    async burnAsset(input:BisBurnAssetRequest):Promise<BisBurnAssetResult> {
      try {
        const request=validateBurn(input);
        const {account,signal}=await newOperationAccount({purpose:'asset',asset:{assetId:request.assetId,quantity:request.quantity,exact:true}},a=>!!readBurnRecord(a.profileId,request.operationId,a.network??'signet'));
        if(!minting.burn)throw new BurnError('unavailable','Burn unavailable.');
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)throw new BurnError('account-changed','The game wallet changed.');
          const owner='bis-game-wallet-burn-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new BurnError('unavailable','Burn recovery could not be saved.');
          const result=await minting.burn!(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
          invalidateSharedAssetInventory(account.profileId,account.network,'game');
          return result;
        },account.profileId,account.network ?? 'signet');
      } catch(error) {return {status:'error',code:error instanceof BurnError?error.code:'unavailable',message:error instanceof BurnError?error.message:'Burn unavailable.'};}
    },
    async deliverAsset(input:BisAssetDeliveryRequest):Promise<BisAssetDeliveryResult> {
      try {
        const request=validateAssetDelivery(input);
        const {account,signal}=await newOperationAccount({purpose:'asset',asset:{assetId:request.assetId,quantity:request.quantity}},a=>{
          if(readAssetDeliveryRecord(a.profileId,request.operationId,a.network??'signet'))return true;
          const checkout=readLocalMarketplaceCheckout(request.operationId);
          if(!checkout)return false;
          if(checkout.status!=='pending'||checkout.phase!=='delivery-submitted'||checkout.request.direction!=='buy'||checkout.request.game.profileId!==a.profileId||checkout.request.game.address!==state.addresses?.arkadeAddress||checkout.request.player.profileId!==options.playerProfileId()||checkout.request.player.address!==request.recipient||checkout.request.assetId!==request.assetId||checkout.request.quantity!==request.quantity)throw Error('Marketplace delivery scope changed. Reconcile the original checkout.');
          return true;
        });
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)throw new AssetDeliveryError('account-changed','The game wallet changed.');
          const owner='bis-game-wallet-delivery-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new AssetDeliveryError('unavailable','Item delivery recovery could not be saved.');
          const result=await (dependencies.deliver??deliverWalletAsset)(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
          if(result.status==='delivered'||result.status==='already-delivered'){invalidateSharedAssetInventory(account.profileId,account.network,'game');void refresh();}
          return result;
        },account.profileId,account.network ?? 'signet');
      } catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'unavailable',message:error instanceof Error?error.message:'Item delivery unavailable.',profileId:state.profileId,operationId:input.operationId};}
    },
    async checkAssetDelivery(operationId:string):Promise<BisAssetDeliveryResult> {
      try {
        const account=await selectedAccount(),result=await withWalletMutation(()=>(dependencies.reconcileDelivery??reconcileWalletAssetDelivery)(account,operationId,operation.signal),account.profileId,account.network ?? 'signet');
        if(result.status==='delivered'||result.status==='already-delivered'){invalidateSharedAssetInventory(account.profileId,account.network,'game');void refresh();}
        return result;
      } catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'unavailable',message:error instanceof Error?error.message:'Item delivery status unavailable.',profileId:state.profileId,operationId};}
    },
    async listAssets():Promise<BisListAssetsResult> {
      const signal=operation.signal,scope=playerScope();
      try {
        const account=await selectedAccount();
        if(!minting.list)return assetError('unavailable',account.profileId);
        const assets=await minting.list(account,signal);
        if(disposed||signal.aborted||signal!==operation.signal||scope!==playerScope()||state.profileId!==account.profileId)return assetError('account-changed',account.profileId);
        return {status:'success',profileId:account.profileId,assets};
      } catch(error) {return assetError(error instanceof AssetError?error.code:'unavailable',state.profileId);}
    },
    async prepareAssetInventory(force = false):Promise<BisListAssetsResult> {
      try { const account=await selectedAccount(), network=account.network ?? selectedNetwork(); return await prepareSharedAssetInventory({role:'game',profileId:account.profileId,network,force,load:signal=>minting.list ? minting.list(account,signal) : Promise.reject(Error('Game Wallet asset listing unavailable.'))}); }
      catch { return assetError('unavailable',state.profileId); }
    },
    async createWallet() {
      if(state.workflowMode==='server'||state.source==='server'||state.serverStatus==='error')return;
      if (disposed || importing || !playerConnected()) { if (!disposed) publish({...state,message:'Connect a Player Wallet before using the Game Wallet.'}); return; }
      importing = true;
      const signal = begin();
      try {
        const account = await (dependencies.create ?? createAccount)(signal, selectedNetwork());
        signal.throwIfAborted();
        if (account.profileId === options.playerProfileId()) throw Error();
        return account;
      } catch {
        if (!signal.aborted) publish({...state, message:'Game wallet creation failed. Check the connection and try again.'});
      } finally {
        importing = false;
        if (refreshQueued) { refreshQueued = false; void refresh(); }
      }
    },
    async selectWallet(account: AccountSecret) {
      if (disposed || importing || !playerConnected()) { if (!disposed) publish({...state,message:'Connect a Player Wallet before using the Game Wallet.'}); return false; }
      if (account.profileId === options.playerProfileId()) {
        publish({...state,message:'This wallet is already configured as the Player Wallet. Select a separate Game Wallet.'});
        return false;
      }
      importing = true;
      const previous = state, signal = begin(); publish({...previous, status:'loading', message:undefined});
      try {
        await selectSeparateGameWallet(account,signal);
        return true;
      } catch (error) {
        if (!signal.aborted) publish({...previous, message:error instanceof WalletRoleConflictError?'This wallet is already configured as the Player Wallet. Select a separate Game Wallet.':'Game wallet setup failed. Check the connection and try again.'});
        return false;
      } finally {
        importing = false;
        if (refreshQueued) { refreshQueued = false; void refresh(); }
      }
    },
    dispose() { if(disposed)return;dependencies.dispose?.();disposed = true; addressPrewarm.abort(); operation.abort(); unsubscribe(); unsubscribePlayer?.(); storage.dispose(); listeners.clear(); },
  };
}





