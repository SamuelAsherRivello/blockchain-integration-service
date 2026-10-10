import { gamePlayerPayments, assertPlayerPaymentAvailable, type BisPlayerRecipient } from './game-player-payment.ts';
import { readSendRecord } from './sending.ts';
import { readLiveBoardingWait, readLiveBoardingState } from '../wallet-layer-arkade/boarding.ts';
import { watchGameWalletEvents } from '../wallet-layer-arkade/game-wallet-events.ts';
import { gameWalletBoarding } from './game-wallet-boarding.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { createAccount, restoreAccount, type AccountSecret } from '../wallet-layer-arkade/account.ts';
import { loadAddresses, type AccountAddresses } from '../wallet-layer-arkade/addresses.ts';
import { loadBalance, type BalanceAmounts } from '../wallet-layer-arkade/balance.ts';
import { createGameWalletStorage, type GameWalletStorage } from './game-wallet-storage.ts';
import { WalletRoleConflictError, withWalletRoleSelection } from './wallet-role.ts';
import {burnWalletAsset,deliverWalletAsset,listWalletAssets,loadMintAvailability,mintWalletAsset,reconcileWalletAssetDelivery} from '../wallet-layer-arkade/assets.ts';
import {withWalletMutation} from './boarding-record.ts';
import {validateMint,assetError,AssetError,readAssetRecords,type BisListAssetsResult,type BisMintAssetRequest,type BisMintAssetResult} from './assets.ts';
import {BurnError,validateBurn,type BisBurnAssetRequest,type BisBurnAssetResult} from './burning.ts';
import {AssetDeliveryError,readAssetDeliveryRecord,validateAssetDelivery,type BisAssetDeliveryRequest,type BisAssetDeliveryResult,type BisPendingAssetDeliveryResult} from './asset-delivery.ts';
import { testNetworks, type TestNetwork } from './test-network.ts';
import { readWithRetry } from './pending-read.ts';
import { clearBrowserGameWalletPreferences } from './logout-cleanup.ts';
import { prepareSharedAssetInventory, invalidateSharedAssetInventory } from './shared-asset-inventory.ts';

export type BisGameWalletReadStatus = 'storage' | 'wallet-read' | 'observation' | 'role-conflict' | 'network-mismatch';
export type BisGameWalletAvailabilityReason = 'player-wallet' | 'game-wallet' | 'role-conflict' | 'network-mismatch' | 'wallet-read' | 'insufficient-funds' | 'unresolved-operation' | 'ready';
export type BisGameWalletOperationScope = Readonly<{playerProfileId?: string; gameProfileId?: string; network: TestNetwork; selectionVersion: number}>;
export type BisGameWalletAvailability = Readonly<{available: boolean; reason: BisGameWalletAvailabilityReason; message: string; scope: BisGameWalletOperationScope}>;
export type BisGameWalletState = Readonly<{
  status: 'loading' | 'empty' | 'ready' | 'unavailable';
  profileId?: string; addresses?: AccountAddresses; balance?: BalanceAmounts; message?: string; readStatus?: BisGameWalletReadStatus; selectionVersion?: number; playerConnected?: boolean; network?: TestNetwork;
}>;
export function createBisGameWallet(...args:Parameters<typeof createLocalGameWallet>):ReturnType<typeof createLocalGameWallet> {
  if (args.length === 1) {
    const [options] = args;
    return createLocalGameWallet(options, {
      storage:createNetworkScopedGameWalletStorage(options.playerNetwork ?? (() => undefined)), restore:restoreAccount, create:createAccount, addresses:loadAddresses, balance:loadBalance, watch:watchGameWalletEvents,
    });
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
  storage: GameWalletStorage;
  restore: typeof restoreAccount;
  create?: typeof createAccount;
  addresses: typeof loadAddresses;
  balance: typeof loadBalance;
  watch: typeof watchGameWalletEvents | undefined;
};
export function createLocalGameWallet(options: { playerProfileId(): string | undefined; playerNetwork?(): TestNetwork | undefined }, dependencies: GameWalletDependencies = {
  storage: createGameWalletStorage(), restore: restoreAccount, create: createAccount, addresses: loadAddresses, balance: loadBalance, watch: watchGameWalletEvents,
}, boarding = gameWalletBoarding, payments = gamePlayerPayments, availability = assertPlayerPaymentAvailable, minting: {availability:typeof loadMintAvailability;mint:typeof mintWalletAsset;list?:typeof listWalletAssets;burn?:typeof burnWalletAsset} = {availability:loadMintAvailability,mint:mintWalletAsset,list:listWalletAssets,burn:burnWalletAsset}) {
  const storage: GameWalletStorage = dependencies.storage;
  let selectionVersion = 0, selectedProfileId: string | undefined;
  let state: BisGameWalletState = Object.freeze({status:'loading',selectionVersion});
  let operation = new AbortController(), disposed = false, importing = false, refreshQueued = false;
  const listeners = new Set<() => void>();
  const selectedNetwork = () => options.playerNetwork?.() ?? 'signet';
  const playerConnected = () => !!options.playerProfileId();
  const clearBrowserState = () => {
    clearBrowserGameWalletPreferences(globalThis.localStorage);
    clearBrowserGameWalletPreferences(globalThis.sessionStorage);
  };
  const publish = (next: Omit<BisGameWalletState,'selectionVersion'> | BisGameWalletState) => { if (!disposed) { state = Object.freeze({...next,selectionVersion,playerConnected:playerConnected(),network:selectedNetwork()}); listeners.forEach(l => l()); } };
  const selectProfile = (profileId: string | undefined) => {
    if (profileId === selectedProfileId) return;
    selectedProfileId = profileId;
    selectionVersion++;
  };
  const begin = () => { operation.abort(); operation = new AbortController(); return operation.signal; };
  async function inspect(account: AccountSecret | null, signal: AbortSignal) {
    if (signal.aborted || disposed) return;
    selectProfile(account?.profileId);
    if (!account) { publish({status:'empty'}); return; }
    const previous = state.profileId === account.profileId ? state : undefined;
    publish({status:'loading', profileId:account.profileId, ...(previous?.addresses ? {addresses:previous.addresses} : {}), ...(previous?.balance ? {balance:previous.balance} : {})});
    // Address discovery is enough for read-only Marketplace inventory. Keep
    // the balance read concurrent, but publish the address as soon as it is
    // available instead of making inventory wait for the slower balance read.
    const addressesTask=readWithRetry(attemptSignal => dependencies.addresses(account, attemptSignal), signal).then(value=>{
      if (signal.aborted || disposed) return value;
      publish({status:'loading',profileId:account.profileId,addresses:value,...(previous?.balance ? {balance:previous.balance} : {})});
      return value;
    });
    const balanceTask=readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
    const [addresses, balance] = await Promise.allSettled([addressesTask, balanceTask]);
    if (signal.aborted || disposed) return;
    publish({status: addresses.status === 'fulfilled' && balance.status === 'fulfilled' ? 'ready' : 'unavailable', profileId:account.profileId,
      ...(addresses.status === 'fulfilled' ? {addresses:addresses.value} : {}),
      ...(balance.status === 'fulfilled' ? {balance:balance.value} : {}),
      ...(addresses.status === 'rejected' || balance.status === 'rejected' ? {message:'Game wallet reads unavailable. Use Details to retry.',readStatus:'wallet-read' as const} : {})});
    if (addresses.status === 'fulfilled' && dependencies.watch) {
      const watch = () => dependencies.watch!(addresses.value.arkadeAddress, signal, async () => {
        if (signal.aborted || disposed) return;
        try {
          const next = await readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
          if (!signal.aborted && !disposed) publish({...state, status:'ready', balance:next, message:undefined});
        } catch {
          if (!signal.aborted && !disposed) publish({...state, status:'unavailable', balance:undefined, message:'Live balance unavailable. Use Details to retry.',readStatus:'observation'});
        }
      }, undefined, account.network ?? 'signet');
      void watch().catch(async () => {
        if (signal.aborted || disposed) return;
        try {
          const next = await readWithRetry(attemptSignal => dependencies.balance(account, attemptSignal), signal);
          if (signal.aborted || disposed) return;
          publish({...state, status:'ready', balance:next, message:undefined});
          void watch();
        } catch {
          if (!signal.aborted && !disposed) publish({...state, status:'unavailable', balance:undefined, message:'Live balance disconnected. Use Details to reconnect.',readStatus:'observation'});
        }
      });
    }
  }
  async function refresh() {
    if (disposed) return;
    if (importing) { refreshQueued = true; return; }
    if (!playerConnected()) { begin(); selectProfile(undefined); publish({status:'empty',message:'Connect a Player Wallet before using the Game Wallet.'}); return; }
    const signal = begin(); publish({status:'loading', profileId:state.profileId, ...(state.addresses ? {addresses:state.addresses} : {}), ...(state.balance ? {balance:state.balance} : {})});
    try {
      const account=await storage.load();
      if(account?.profileId===options.playerProfileId() || (account?.network !== undefined && account.network !== selectedNetwork())) {
        const roleConflict = account?.profileId===options.playerProfileId();
        selectProfile(undefined);publish({status:'unavailable',message:roleConflict ? 'This wallet is already configured as the Player Wallet. Select a separate Game Wallet.' : 'This Game Wallet belongs to another network. Select a wallet on the active Player network.',readStatus:roleConflict ? 'role-conflict' : 'network-mismatch'});return;
      }
      await inspect(account, signal);
    }
      catch { if (!signal.aborted) publish({status:'unavailable', message:'Game wallet storage unavailable. Use Details to retry.',readStatus:'storage'}); }
  }
  const unsubscribe = storage.subscribe(() => { void refresh(); });
  void refresh();
  async function selectedAccount() {
    const account = await storage.load();
    if (disposed || importing || !playerConnected() || !account || account.profileId !== state.profileId || account.profileId === options.playerProfileId() || (account.network !== undefined && account.network !== selectedNetwork())) throw Error('Connect a Player Wallet and select a separate Game Wallet first.');
    return account;
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
    try { availability(scope.gameProfileId); }
    catch (error) { return {available:false, reason:'unresolved-operation', message:error instanceof Error ? error.message : 'A previous wallet operation is unresolved.', scope}; }
    if (state.balance.availableSats < 1000) return {available:false, reason:'insufficient-funds', message:'The Game Wallet has fewer than 1,000 spendable sats.', scope};
    return {available:true, reason:'ready', message:'Game Wallet is ready for the requested operation.', scope};
  }
  function getPlayerPaymentBlockReason(): string | undefined {
    if (disposed || !state.profileId) return 'Awaiting Game Wallet';
    if (!options.playerProfileId()) return 'Awaiting Player';
    if (state.profileId === options.playerProfileId()) return 'Select A Different Wallet';
    if (paying) return 'Sending';
    try { availability(state.profileId); }
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
      try {return await minting.availability(await selectedAccount(),operation.signal);}
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
      const signal=operation.signal;
      try {
        const request=validateMint(input),account=await selectedAccount();
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)return assetError('account-changed');
          const owner='bis-game-wallet-mint-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new AssetError('unavailable');
          const result=await minting.mint(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
          return result;
        },account.profileId,account.network ?? 'signet');
      } catch(error) {return assetError(error instanceof AssetError?error.code:'unavailable',state.profileId,input.operationId);}
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
      try { availability(state.profileId); }
      catch (error) {
        // Known unresolved operations reserve spending; unreadable state is unknown, not zero.
        return error instanceof Error && error.message.includes('unresolved') ? 0 : undefined;
      }
      return state.balance.availableSats;
    },
    canPayPlayer() { return getPlayerPaymentBlockReason() === undefined; },
    hasPendingPlayerPayment() { try { return !!state.profileId && readSendRecord(state.profileId)?.status === 'pending'; } catch { return true; } },
    async payPlayer(recipient: BisPlayerRecipient, amountSats=1000, playerCurrent: () => boolean = () => options.playerProfileId() === recipient.profileId) {
      if (paying) throw Error('A payment is already in progress.');
      paying = true;
      const signal = operation.signal;
      try {
        const account = await selectedAccount();
        if (recipient.profileId !== options.playerProfileId()) throw Error('The player changed.');
        return await payments.pay(account, recipient, amountSats, signal, () => !disposed && !signal.aborted && state.profileId === account.profileId && options.playerProfileId() === recipient.profileId && playerCurrent());
      } finally { paying = false; }
    },
    async checkPlayerPayment() { return payments.check(await selectedAccount(), operation.signal); },
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    async quoteBoarding() {
      const account = await selectedAccount();
      return boarding.quote(account, operation.signal);
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
      const result = await readLiveBoardingState(account, signal);
      if (disposed || signal.aborted || state.profileId !== account.profileId) throw Error('The game wallet changed.');
      return result;
    },
    async checkLiveBoardingWait() {
      const signal = operation.signal;
      const account = await selectedAccount();
      const waiting = await readLiveBoardingWait(account, signal);
      if (disposed || signal.aborted || state.profileId !== account.profileId) throw Error('The game wallet changed.');
      return waiting;
    },
    async logout() {
      if (disposed || importing) return;
      const signal = begin();
      try { invalidateSharedAssetInventory(state.profileId, selectedNetwork(), 'game'); await storage.logout(); clearBrowserState(); if (!signal.aborted) { selectProfile(undefined); publish({status:'empty'}); } }
      catch { if (!signal.aborted) publish({...state, message:'Logout failed. Please retry.',readStatus:'storage'}); }
    },
    async reset() {
      if (disposed || importing) return false;
      const signal = begin();
      try { invalidateSharedAssetInventory(state.profileId, selectedNetwork(), 'game'); await storage.reset(); clearBrowserState(); if (!signal.aborted) { selectProfile(undefined); publish({status:'empty'}); } return true; }
      catch { if (!signal.aborted) publish({...state, message:'Game Wallet reset failed. Please retry.',readStatus:'storage'}); return false; }
    },
    async importWallet(phrase: string) {
      if (disposed || importing || !playerConnected()) { if (!disposed) publish({...state,message:'Connect a Player Wallet before using the Game Wallet.'}); return false; }
      importing = true; const previous = state, signal = begin(); publish({...previous, status:'loading', message:undefined});
      try {
        const account = await dependencies.restore(phrase, signal, selectedNetwork());
        signal.throwIfAborted();
        await selectSeparateGameWallet(account,signal);
        return true;
      } catch (error) {
        if (!signal.aborted) publish({...previous, message:error instanceof WalletRoleConflictError?'This recovery phrase belongs to the player wallet. Restore or create a separate game wallet.':'Import failed. Check the recovery phrase, connection, and use a wallet different from the player.'});
        return false;
      } finally { importing = false; if (refreshQueued) { refreshQueued = false; void refresh(); } }
    },
    async burnAsset(input:BisBurnAssetRequest):Promise<BisBurnAssetResult> {
      const signal=operation.signal;
      try {
        const request=validateBurn(input),account=await selectedAccount();
        if(!minting.burn)throw new BurnError('unavailable','Burn unavailable.');
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)throw new BurnError('account-changed','The game wallet changed.');
          const owner='bis-game-wallet-burn-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new BurnError('unavailable','Burn recovery could not be saved.');
          return minting.burn!(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
        },account.profileId,account.network ?? 'signet');
      } catch(error) {return {status:'error',code:error instanceof BurnError?error.code:'unavailable',message:error instanceof BurnError?error.message:'Burn unavailable.'};}
    },
    async deliverAsset(input:BisAssetDeliveryRequest):Promise<BisAssetDeliveryResult> {
      const signal=operation.signal;
      try {
        const request=validateAssetDelivery(input),account=await selectedAccount();
        return await withWalletMutation(async()=>{
          const current=await selectedAccount();
          if(current.profileId!==account.profileId||signal.aborted)throw new AssetDeliveryError('account-changed','The game wallet changed.');
          const owner='bis-game-wallet-delivery-owner:'+encodeURIComponent(account.profileId);
          localStorage.setItem(owner,'1');if(localStorage.getItem(owner)!=='1')throw new AssetDeliveryError('unavailable','Item delivery recovery could not be saved.');
          const result=await deliverWalletAsset(account,request,signal,()=>!disposed&&!signal.aborted&&state.profileId===account.profileId);
          if(result.status==='delivered'||result.status==='already-delivered')void refresh();
          return result;
        },account.profileId,account.network ?? 'signet');
      } catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'unavailable',message:error instanceof Error?error.message:'Item delivery unavailable.',profileId:state.profileId,operationId:input.operationId};}
    },
    async checkAssetDelivery(operationId:string):Promise<BisAssetDeliveryResult> {
      try {
        const account=await selectedAccount(),result=await withWalletMutation(()=>reconcileWalletAssetDelivery(account,operationId,operation.signal),account.profileId,account.network ?? 'signet');
        if(result.status==='delivered'||result.status==='already-delivered')void refresh();
        return result;
      } catch(error) {return {status:'error',code:error instanceof AssetDeliveryError?error.code:'unavailable',message:error instanceof Error?error.message:'Item delivery status unavailable.',profileId:state.profileId,operationId};}
    },
    async listAssets():Promise<BisListAssetsResult> {
      try {
        const account=await selectedAccount();
        if(!minting.list)return assetError('unavailable',account.profileId);
        const assets=await minting.list(account,operation.signal);
        if(disposed||operation.signal.aborted||state.profileId!==account.profileId)return assetError('account-changed',account.profileId);
        return {status:'success',profileId:account.profileId,assets};
      } catch(error) {return assetError(error instanceof AssetError?error.code:'unavailable',state.profileId);}
    },
    async prepareAssetInventory():Promise<BisListAssetsResult> {
      try { const account=await selectedAccount(), network=account.network ?? selectedNetwork(); return await prepareSharedAssetInventory({role:'game',profileId:account.profileId,network,load:signal=>minting.list ? minting.list(account,signal) : Promise.reject(Error('Game Wallet asset listing unavailable.'))}); }
      catch { return assetError('unavailable',state.profileId); }
    },
    async createWallet() {
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
    dispose() { disposed = true; operation.abort(); unsubscribe(); storage.dispose(); listeners.clear(); },
  };
}





