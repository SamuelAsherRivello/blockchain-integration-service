import { createOnboardingAdapter, onboardingScope } from './onboarding.ts';
import { reconstructWalletReservations } from './reservation-recovery.ts';
import { validContinueRecipient } from './continue-recipient.ts';
import { watchActivity } from './activity.ts';
import { loadSendFunds, quoteSend, reconcileSend, submitSend } from './sending.ts';
import { burnWalletAsset, deliverWalletAsset, listWalletAssets, loadMintAvailability, mintWalletAsset, reconcileWalletAssetDelivery, watchAssetChanges } from './assets.ts';
import { getBoardingAvailability, quoteBoarding, reconcileBoarding, submitBoarding } from './boarding.ts';
import { createAccount, identify, restoreAccount } from './account.ts';
import { loadBalance } from './balance.ts';
import { loadAddresses } from './addresses.ts';
import { fundTestAccount } from './funding.ts';
import { reconcileContinuation, submitContinuation } from './continuation.ts';
import type { BisContextDependencies } from '../state-layer-core/context-dependencies.ts';
import type { RoleWalletAccess } from './adapter-session.ts';

/** Binds the core's explicit wallet-operation contract to the existing Arkade adapters. */
export function createArkadeContextDependencies(overrides: Partial<BisContextDependencies> = {},session?:RoleWalletAccess): BisContextDependencies {
  const observe:BisContextDependencies['observeActivity']=(a,s,p)=>watchActivity(a,s,p,session);
  const defaults: BisContextDependencies = {
    create: createAccount,
    identifyAccount: identify,
    restore: restoreAccount,
    retireWallet:session?()=>{void session.retire().catch(()=>{});}:undefined,
    disposeWallets:session?()=>{void session.retire().catch(()=>{});}:undefined,
    readBalance: (account,signal)=>loadBalance(account,signal,session),
    fund: (account,signal,current)=>fundTestAccount(account,signal,current,session),
    readAddresses: (account,signal)=>loadAddresses(account,signal,session),
    observeActivity: observe,
    transfers: { quote: (a,n,s,d,_session,destination)=>quoteBoarding(a,n,s,d,session,destination), submit:(a,q,c)=>submitBoarding(a,q,c,session), reconcile:(a,s)=>reconcileBoarding(a,s,session), availability:(a,s,d)=>getBoardingAvailability(a,s,d,session) },
    assets: { list: (account,signal)=>listWalletAssets(account,signal,session), mint:(a,r,s,c)=>mintWalletAsset(a,r,s,c,session) },
    deliverAsset:(a,r,s,c)=>deliverWalletAsset(a,r,s,c,session),
    reconcileAssetDelivery:(a,id,s)=>reconcileWalletAssetDelivery(a,id,s,session),
    loadMintAvailability:(a,s)=>loadMintAvailability(a,s,session),
    sends: { funds:(a,s,p)=>loadSendFunds(a,s,p,session), quote:(a,r,n,s,p,i)=>quoteSend(a,r,n,s,p,i,session), submit:(a,q,c,j,p,i)=>submitSend(a,q,c,j,p,i,session), reconcile:reconcileSend },
    burn:(a,r,s,c)=>burnWalletAsset(a,r,s,c,session),
    continuation: { submit:(a,r,s,c)=>submitContinuation(a,r,s,c,session), reconcile:reconcileContinuation },
    observePayments:observe,
    observeAssets:(a,s,c)=>watchAssetChanges(a,s,c,session),
    onboardingFactory:(a,c)=>createOnboardingAdapter(a,c,undefined,session),
    onboardingScope,
    reconstructWalletReservations,
    validContinueRecipient,
  };
  return {
    ...defaults,
    ...overrides,
    transfers: { ...defaults.transfers, ...overrides.transfers },
    assets: { ...defaults.assets, ...overrides.assets },
    sends: { ...defaults.sends, ...overrides.sends },
    continuation: { ...defaults.continuation, ...overrides.continuation },
  };
}
