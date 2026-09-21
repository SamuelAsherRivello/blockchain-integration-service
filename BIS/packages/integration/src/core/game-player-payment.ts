import {eligibleUnreservedCoins,walletReservations} from './wallet-reservations.ts';
import type { AccountSecret } from '../arkade/account.ts';
import { quoteSend, submitSend, reconcileSend, type SendJournal } from '../arkade/sending.ts';
import { assertNoPendingBoarding, withWalletMutation } from './boarding-record.ts';
import { assertNoPendingBurn } from './burning.ts';
import { readAssetRecords } from './assets.ts';
import { assertNoPendingSend, readSendRecord, readSendRecords, writeSendRecord, completeSend, sendStatus } from './sending.ts';
import type { BisTransaction } from './activity.ts';

export type BisPlayerRecipient = Readonly<{profileId: string; address: string}>;
const prefix = 'bis-game-player-payment:';
export function paymentSender(row: BisTransaction, playerId: string): string | undefined {
  if (!globalThis.localStorage) return;
  for (const ref of row.identifier.split(' ')) {
    if (!ref.startsWith('ark:')) continue;
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + ref.slice(4)) ?? 'null');
      if (saved?.playerId === playerId && saved.amountSats === row.amountSats && typeof saved.senderId === 'string') return saved.senderId;
    } catch { /* Missing metadata never prevents a real receipt notification. */ }
  }
}
export function assertPlayerPaymentAvailable(profileId: string,network:'signet'|'mutinynet'='signet') {
  eligibleUnreservedCoins([],walletReservations(profileId,network));
}
const adapter = {quote: quoteSend, submit: submitSend, reconcile: reconcileSend};
export function createGamePlayerPayments(dependencies = adapter) {
  return {
    async pay(account: AccountSecret, recipient: BisPlayerRecipient, amountSats:number, signal: AbortSignal, current: () => boolean) {
      return withWalletMutation(async () => {
        const network=account.network ?? 'signet';
        assertPlayerPaymentAvailable(account.profileId,network);
        if(readSendRecords(account.profileId,network).some(record=>record.status==='pending' && paymentSender({identifier:`ark:${record.transactionId}`,amountSats:record.quote.amountSats} as BisTransaction,recipient.profileId)===account.profileId))throw Error('This player payment is still pending verification.');
        if (!recipient.profileId || recipient.profileId === account.profileId || !Number.isSafeInteger(amountSats) || amountSats<=0 || !current()) throw Error('An active separate player and exact whole-sats payment are required.');
        const quote = await dependencies.quote(account, recipient.address, amountSats, signal, true);
        if (!current() || signal.aborted) throw Error('The player or game wallet changed.');
        const journal: SendJournal = {
          read: (profileId) => readSendRecord(profileId,undefined,network),
          write(record) {
            const key = prefix + record.transactionId;
            const raw = JSON.stringify({senderId: account.profileId, playerId: recipient.profileId, amountSats});
            localStorage.setItem(key, raw);
            if (localStorage.getItem(key) !== raw) throw Error('Payment metadata could not be saved.');
            // Retain the game sender's recovery record across player logout.
            const owner = 'bis-game-wallet-send-owner:' + encodeURIComponent(account.profileId);
            localStorage.setItem(owner, '1');
            if (localStorage.getItem(owner) !== '1') throw Error('Payment recovery could not be saved.');
            writeSendRecord({...record,network});
          }, complete: (id,transactionId,profileId) => completeSend(id,transactionId,profileId,network),
        };
        return sendStatus(await dependencies.submit(account, quote, current, journal, true));
      }, account.profileId,account.network ?? 'signet');
    },
    async check(account: AccountSecret, signal: AbortSignal) {
      return withWalletMutation(async () => sendStatus(await dependencies.reconcile(account, signal)), account.profileId,account.network ?? 'signet');
    },
  };
}
export const gamePlayerPayments = createGamePlayerPayments();
