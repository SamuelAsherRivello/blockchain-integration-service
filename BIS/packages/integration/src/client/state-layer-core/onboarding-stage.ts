import type {BisBalance} from './context.ts';
import type {OnboardingView} from './onboarding-service.ts';

/**
 * Maps independently observed wallet evidence to the furthest trustworthy
 * onboarding stage. Later evidence always wins, so reopening the page cannot
 * regress a wallet that already has spendable Arkade sats.
 */
export type OnboardingReadiness=Readonly<{stage:1|2|3|4|5;label:'Start?'|'Pending'|'Complete'}>;
export function onboardingReadiness(view?: OnboardingView, balance?: BisBalance): OnboardingReadiness {
  const record = view?.record;
  const stage:1|2|3|4|5=balance?.status === 'ready' && balance.arkadeSats > 0 ? 5
    : view?.status === 'complete' || record?.status === 'complete' ? 5
    : record?.plan ? record.returning?.phase === 'receipt-verified' ? 4 : 3
    : (view?.transactions.some(transaction => transaction.kind === 'incoming') ?? false) || balance?.status === 'ready' && balance.bitcoinSats > 0 ? 2
    : 1;
  return {stage,label:stage===5?'Complete':stage===1?'Start?':'Pending'};
}
export const onboardingStage=(view?:OnboardingView,balance?:BisBalance)=>onboardingReadiness(view,balance).stage;
