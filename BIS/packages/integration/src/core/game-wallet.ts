import { gamePlayerPayments, assertPlayerPaymentAvailable, type BisPlayerRecipient } from './game-player-payment.ts';
import { readSendRecord } from './sending.ts';
import { readLiveBoardingWait, readLiveBoardingState } from '../arkade/boarding.ts';
import { watchGameWalletEvents } from '../arkade/game-wallet-events.ts';
import { gameWalletBoarding } from './game-wallet-boarding.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { createAccount, restoreAccount, type AccountSecret } from '../arkade/account.ts';
import { loadAddresses, type AccountAddresses } from '../arkade/addresses.ts';
import { loadBalance, type BalanceAmounts } from '../arkade/balance.ts';
import { createGameWalletStorage, type GameWalletStorage } from './game-wallet-storage.ts';
import {burnWalletAsset,listWalletAssets,loadMintAvailability,mintWalletAsset} from '../arkade/assets.ts';
import {withWalletMutation} from './boarding-record.ts';
import {validateMint,assetError,AssetError,readAssetRecords,type BisListAssetsResult,type BisMintAssetRequest,type BisMintAssetResult} from './assets.ts';
import {BurnError,validateBurn,type BisBurnAssetRequest,type BisBurnAssetResult} from './burning.ts';

export type BisGameWalletState = Readonly<{
  status: 'loading' | 'empty' | 'ready' | 'unavailable';
  profileId?: string; addresses?: AccountAddresses; balance?: BalanceAmounts; message?: string; selectionVersion?: number;
}>;
export function createBisGameWallet(...args:Parameters<typeof createLocalGameWallet>):ReturnType<typeof createLocalGameWallet> {
  return createLocalGameWallet(...args);
}
type GameWalletDependencies = {
  storage: GameWalletStorage;
  restore: typeof restoreAccount;
  create?: typeof createAccount;
  addresses: typeof loadAddresses;
  balance: typeof loadBalance;
  watch: typeof watchGameWalletEvents | undefined;
};
export function createLocalGameWallet(options: { playerProfileId(): string | undefined }, dependencies: GameWalletDependencies = {
  storage: createGameWalletStorage(), restore: restoreAccount, create: createAccount, addresses: loadAddresses, balance: loadBalance, watch: watchGameWalletEvents,
}, boarding = gameWalletBoarding, payments = gamePlayerPayments, availability = assertPlayerPaymentAvailable, minting: {availability:typeof loadMintAvailability;mint:typeof mintWalletAsset;list?:typeof listWalletAssets;burn?:typeof burnWalletAsset} = {availability:loadMintAvailability,mint:mintWalletAsset,list:listWalletAssets,burn:burnWalletAsset}) {
  const storage: GameWalletStorage = dependencies.storage;
  let selectionVersion = 0, selectedProfileId: string | undefined;
  let state: BisGameWalletState = Object.freeze({status:'loading',selectionVersion});
  let operation = new AbortController(), disposed = false, importing = false, refreshQueued = false;
  const listeners = new Set<() => void>();
  const publish = (next: Omit<BisGameWalletState,'selectionVersion'> | BisGameWalletState) => { if (!disposed) { state = Object.freeze({...next,selectionVersion}); listeners.forEach(l => l()); } };
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
    publish({status:'loading', profileId:account.profileId});
    const [addresses, balance] = await Promise.allSettled([dependencies.addresses(account, signal), dependencies.balance(account, signal)]);
    if (signal.aborted || disposed) return;
    publish({status: addresses.status === 'fulfilled' && balance.status === 'fulfilled' ? 'ready' : 'unavailable', profileId:account.profileId,
      ...(addresses.status === 'fulfilled' ? {addresses:addresses.value} : {}),
      ...(balance.status === 'fulfilled' ? {balance:balance.value} : {}),
      ...(addresses.status === 'rejected' || balance.status === 'rejected' ? {message:'Game wallet reads unavailable. Use Details to retry.'} : {})});
    if (addresses.status === 'fulfilled' && dependencies.watch) {
      void dependencies.watch(addresses.value.arkadeAddress, signal, async () => {
        if (signal.aborted || disposed) return;
        try {
          const next = await dependencies.balance(account, signal);
          if (!signal.aborted && !disposed) publish({...state, status:'ready', balance:next, message:undefined});
        } catch {
          if (!signal.aborted && !disposed) publish({...state, status:'unavailable', balance:undefined, message:'Live balance unavailable. Use Details to retry.'});
        }
      }).catch(() => {
        if (!signal.aborted && !disposed) publish({...state, status:'unavailable', balance:undefined, message:'Live balance disconnected. Use Details to reconnect.'});
      });
    }
  }
  async function refresh() {
    if (disposed) return;
    if (importing) { refreshQueued = true; return; }
    const signal = begin(); publish({status:'loading', profileId:state.profileId});
    try { await inspect(await storage.load(), signal); }
      catch { if (!signal.aborted) publish({status:'unavailable', message:'Game wallet storage unavailable. Use Details to retry.'}); }
  }
  const unsubscribe = storage.subscribe(() => { void refresh(); });
  void refresh();
  async function selectedAccount() {
    const account = await storage.load();
    if (disposed || importing || !account || account.profileId !== state.profileId || account.profileId === options.playerProfileId()) throw Error('Select a separate game wallet first.');
    return account;
  }
  let paying = false;
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
      return {status:'success' as const,profileId:account.profileId,request:readAssetRecords(account.profileId).find(r=>r.status==='pending')?.request??null};
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
        },account.profileId);
      } catch(error) {return assetError(error instanceof AssetError?error.code:'unavailable',state.profileId,input.operationId);}
    },
    getPlayerPaymentBlockReason,
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
    async payPlayer(recipient: BisPlayerRecipient, playerCurrent: () => boolean = () => options.playerProfileId() === recipient.profileId) {
      if (paying) throw Error('A payment is already in progress.');
      paying = true;
      const signal = operation.signal;
      try {
        const account = await selectedAccount();
        if (recipient.profileId !== options.playerProfileId()) throw Error('The player changed.');
        return await payments.pay(account, recipient, signal, () => !disposed && !signal.aborted && state.profileId === account.profileId && options.playerProfileId() === recipient.profileId && playerCurrent());
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
      try { await storage.logout(); if (!signal.aborted) { selectProfile(undefined); publish({status:'empty'}); } }
      catch { if (!signal.aborted) publish({...state, message:'Logout failed. Please retry.'}); }
    },
    async importWallet(phrase: string) {
      if (disposed || importing) return false;
      importing = true; const previous = state, signal = begin(); publish({...previous, status:'loading', message:undefined});
      try {
        const account = await dependencies.restore(phrase, signal);
        signal.throwIfAborted();
        if (account.profileId === options.playerProfileId()) {
          publish({...previous, message:'This recovery phrase belongs to the player wallet. Restore or create a separate game wallet.'});
          return false;
        }
        await storage.select(account);
        await inspect(account, signal);
        return true;
      } catch {
        if (!signal.aborted) publish({...previous, message:'Import failed. Check the recovery phrase, connection, and use a wallet different from the player.'});
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
        },account.profileId);
      } catch(error) {return {status:'error',code:error instanceof BurnError?error.code:'unavailable',message:error instanceof BurnError?error.message:'Burn unavailable.'};}
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
    async createWallet() {
      if (disposed || importing) return;
      importing = true;
      const signal = begin();
      try {
        const account = await (dependencies.create ?? createAccount)(signal);
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
      if (disposed || importing || account.profileId === options.playerProfileId()) return false;
      importing = true;
      const previous = state, signal = begin(); publish({...previous, status:'loading', message:undefined});
      try {
        await storage.select(account);
        signal.throwIfAborted();
        await inspect(account, signal);
        return true;
      } catch {
        if (!signal.aborted) publish({...previous, message:'Game wallet setup failed. Check the connection and try again.'});
        return false;
      } finally {
        importing = false;
        if (refreshQueued) { refreshQueued = false; void refresh(); }
      }
    },
    dispose() { disposed = true; operation.abort(); unsubscribe(); storage.dispose(); listeners.clear(); },
  };
}





