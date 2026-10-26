import {eligibleUnreservedCoins,walletReservations} from './wallet-reservations.ts';
import { assertNoPendingSend } from './sending.ts';
import { quoteBoarding, submitBoarding, reconcileBoarding } from '../wallet-layer-arkade/boarding.ts';
import type { WalletAccount } from '../wallet-layer-arkade/account.ts';
import type { BoardingQuote } from './boarding-quote.ts';
import { assertNoPendingBoarding, withWalletMutation } from './boarding-record.ts';
import { transferStatus } from './boarding-status.ts';
import type {RoleWalletAccess} from '../wallet-layer-arkade/adapter-session.ts';

export const gameBoardingOwnerPrefix = 'bis-game-wallet-boarding-owner:';
export function preserveGameBoarding(profileId: string) {
  const key = gameBoardingOwnerPrefix + encodeURIComponent(profileId);
  localStorage.setItem(key, '1');
  if (localStorage.getItem(key) !== '1') throw Error('Recovery storage unavailable.');
}
export const gameWalletBoarding = {
  async quote(account: WalletAccount, signal: AbortSignal,session?:RoleWalletAccess) {
    eligibleUnreservedCoins([],walletReservations(account.profileId,account.network??'signet'));

    return quoteBoarding(account, undefined, signal, 'to-arkade',session);
  },
  async submit(account: WalletAccount, quote: BoardingQuote, current: () => boolean,session?:RoleWalletAccess) {
    return withWalletMutation(async () => {
      eligibleUnreservedCoins([],walletReservations(account.profileId,account.network??'signet'));

      if (!current() || quote.direction !== 'to-arkade') throw Error('Review a fresh boarding quote.');
      preserveGameBoarding(account.profileId);
      return transferStatus(await submitBoarding(account, quote, current,session));
    }, account.profileId,account.network??'signet');
  },
  async check(account: WalletAccount, signal: AbortSignal,session?:RoleWalletAccess) {
    return transferStatus(await reconcileBoarding(account, signal,session));
  },
};
