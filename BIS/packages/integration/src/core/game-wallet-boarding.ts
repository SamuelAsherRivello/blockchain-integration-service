import {eligibleUnreservedCoins,walletReservations} from './wallet-reservations.ts';
import { assertNoPendingSend } from './sending.ts';
import { quoteBoarding, submitBoarding, reconcileBoarding } from '../arkade/boarding.ts';
import type { AccountSecret } from '../arkade/account.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { assertNoPendingBoarding, withWalletMutation } from './boarding-record.ts';
import { transferStatus } from './boarding-status.ts';

export const gameBoardingOwnerPrefix = 'bis-game-wallet-boarding-owner:';
export function preserveGameBoarding(profileId: string) {
  const key = gameBoardingOwnerPrefix + encodeURIComponent(profileId);
  localStorage.setItem(key, '1');
  if (localStorage.getItem(key) !== '1') throw Error('Recovery storage unavailable.');
}
export const gameWalletBoarding = {
  async quote(account: AccountSecret, signal: AbortSignal) {
    eligibleUnreservedCoins([],walletReservations(account.profileId));

    return quoteBoarding(account, undefined, signal, 'to-arkade');
  },
  async submit(account: AccountSecret, quote: BoardingQuote, current: () => boolean) {
    return withWalletMutation(async () => {
      eligibleUnreservedCoins([],walletReservations(account.profileId));

      if (!current() || quote.direction !== 'to-arkade') throw Error('Review a fresh boarding quote.');
      preserveGameBoarding(account.profileId);
      return transferStatus(await submitBoarding(account, quote, current));
    }, account.profileId);
  },
  async check(account: AccountSecret, signal: AbortSignal) {
    return transferStatus(await reconcileBoarding(account, signal));
  },
};
