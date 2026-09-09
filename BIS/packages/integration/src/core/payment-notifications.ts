import type { MessageType } from './toasts.ts';
import type { BisTransaction } from './activity.ts';

/** Session-only observation: reconnects retain state; a new login starts silently. */
export function createPaymentNotifications(show: (message: string, messageType: MessageType) => void, sender: (row: BisTransaction) => string | undefined = () => undefined) {
  let baseline = false;
  const seen = new Map<string, number>();
  return { observe(rows: readonly BisTransaction[]) {
    let newArkadeReceipt = false;
    for (const row of rows) {
      if (row.satsUnknown || !Number.isSafeInteger(row.amountSats) || row.amountSats <= 0) continue;
      const transfer = row.transfer;
      if (!transfer && row.direction !== 'Incoming') continue;
      const verifiedArkade = !transfer && !row.bitcoin && row.direction === 'Incoming' && row.receiptVerified === true;
      const stage = verifiedArkade || row.status === 'Transfer verified' || (row.status === 'Confirmed' && (!row.bitcoin || (row.bitcoin.confirmations ?? 0) >= 1)) || row.status === 'Settled offchain' ? 2
        : row.status.startsWith('Pending') && row.status !== 'Pending — preparing' ? 1 : 0;
      if (!stage) continue;
      const ark = row.identifier.split(' ').find(ref => ref.startsWith('ark:'));
      const key = transfer?.operationId ? `transfer:${transfer.operationId}` : row.bitcoin ? `bitcoin:${row.bitcoin.txid}:${row.amountSats}` : ark ? `${ark}:${row.amountSats}` : row.id;
      const previous = seen.get(key) ?? 0;
      if (stage <= previous) continue;
      seen.set(key, stage);
      if (!baseline) continue;
      if (!previous && ark && !row.bitcoin && !transfer) newArkadeReceipt = true;
      const id = sender(row), short = id && id.length > 9 ? `${id.slice(0,4)}....${id.slice(-5)}` : id;
      const message = transfer
        ? `Transferred ${row.amountSats} sats from ${transfer.direction === 'to-arkade' ? 'Bitcoin to Arkade' : 'Arkade to Bitcoin'}`
        : `${short ? `User ${short}` : 'Unknown user'} sent you ${row.amountSats} sats`;
      if (!previous && verifiedArkade && row.status === 'Pending offchain') show(message + ' (Pending)', 'info');
      show(message + (stage === 1 ? ' (Pending)' : !transfer && (verifiedArkade || row.status === 'Settled offchain') ? ' (Confirmed)' : ''), stage === 1 ? 'info' : 'success');
    }
    baseline = true;
    return {newArkadeReceipt};
  }};
}
