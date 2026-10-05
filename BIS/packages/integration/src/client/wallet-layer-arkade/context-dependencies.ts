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

/** Binds the core's explicit wallet-operation contract to the existing Arkade adapters. */
export function createArkadeContextDependencies(overrides: Partial<BisContextDependencies> = {}): BisContextDependencies {
  const defaults: BisContextDependencies = {
    create: createAccount,
    identifyAccount: identify,
    restore: restoreAccount,
    readBalance: loadBalance,
    fund: fundTestAccount,
    readAddresses: loadAddresses,
    observeActivity: watchActivity,
    transfers: { quote: quoteBoarding, submit: submitBoarding, reconcile: reconcileBoarding, availability: getBoardingAvailability },
    assets: { list: listWalletAssets, mint: mintWalletAsset },
    deliverAsset: deliverWalletAsset,
    reconcileAssetDelivery: reconcileWalletAssetDelivery,
    loadMintAvailability,
    sends: { funds: loadSendFunds, quote: quoteSend, submit: submitSend, reconcile: reconcileSend },
    burn: burnWalletAsset,
    continuation: { submit: submitContinuation, reconcile: reconcileContinuation },
    observePayments: watchActivity,
    observeAssets: watchAssetChanges,
    onboardingFactory: createOnboardingAdapter,
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
