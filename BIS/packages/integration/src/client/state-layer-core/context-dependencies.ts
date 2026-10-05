import type { OnboardingAdapter } from './onboarding-service.ts';
import type { AccountSecret } from '../wallet-layer-arkade/account.ts';
import type { BalanceAmounts } from '../wallet-layer-arkade/balance.ts';
import type { AccountAddresses } from '../wallet-layer-arkade/addresses.ts';
import type { createAccount, identify, restoreAccount } from '../wallet-layer-arkade/account.ts';
import type { loadBalance } from '../wallet-layer-arkade/balance.ts';
import type { fundTestAccount } from '../wallet-layer-arkade/funding.ts';
import type { loadAddresses } from '../wallet-layer-arkade/addresses.ts';
import type { watchActivity } from '../wallet-layer-arkade/activity.ts';
import type { quoteBoarding, submitBoarding, reconcileBoarding, getBoardingAvailability } from '../wallet-layer-arkade/boarding.ts';
import type { listWalletAssets, mintWalletAsset, burnWalletAsset, deliverWalletAsset, reconcileWalletAssetDelivery, loadMintAvailability, watchAssetChanges } from '../wallet-layer-arkade/assets.ts';
import type { loadSendFunds, quoteSend, submitSend, reconcileSend } from '../wallet-layer-arkade/sending.ts';
import type { submitContinuation, reconcileContinuation } from '../wallet-layer-arkade/continuation.ts';
import type { createOnboardingAdapter, onboardingScope } from '../wallet-layer-arkade/onboarding.ts';
import type { reconstructWalletReservations } from '../wallet-layer-arkade/reservation-recovery.ts';
import type { validContinueRecipient } from '../wallet-layer-arkade/continue-recipient.ts';

/** Runtime wallet operations required by the state-core context. This stays internal to the integration source surface. */
export type BisContextDependencies = Readonly<{
  create: typeof createAccount;
  identifyAccount: typeof identify;
  restore: typeof restoreAccount;
  readBalance: typeof loadBalance;
  fund: typeof fundTestAccount;
  readAddresses: typeof loadAddresses;
  observeActivity: typeof watchActivity;
  transfers: Readonly<{ quote: typeof quoteBoarding; submit: typeof submitBoarding; reconcile: typeof reconcileBoarding; availability?: typeof getBoardingAvailability }>;
  assets: Readonly<{ list: typeof listWalletAssets; mint: typeof mintWalletAsset }>;
  deliverAsset: typeof deliverWalletAsset;
  reconcileAssetDelivery: typeof reconcileWalletAssetDelivery;
  loadMintAvailability: typeof loadMintAvailability;
  sends: Readonly<{ funds: typeof loadSendFunds; quote: typeof quoteSend; submit: typeof submitSend; reconcile: typeof reconcileSend }>;
  burn: typeof burnWalletAsset;
  continuation: Readonly<{ submit: typeof submitContinuation; reconcile: typeof reconcileContinuation }>;
  observePayments?: typeof watchActivity;
  observeAssets?: typeof watchAssetChanges;
  onboardingFactory?: (account: AccountSecret, current: () => boolean) => OnboardingAdapter;
  onboardingScope: typeof onboardingScope;
  reconstructWalletReservations: typeof reconstructWalletReservations;
  validContinueRecipient: typeof validContinueRecipient;
}>;

export type { AccountAddresses, AccountSecret, BalanceAmounts };
