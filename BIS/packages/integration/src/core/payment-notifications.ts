import type { BisTransaction } from './activity.ts';

/** Session-only observation: reconnects retain state; a new login starts silently. */
export function createPaymentNotifications(show: (message: string) => void, sender: (row: BisTransaction) => string | undefined = () => undefined) {
  let baseline = false;
  const seen = new Map<string, number>();
  return { observe(rows: readonly BisTransaction[]) {
    for (const row of rows) {
      if (row.satsUnknown || !Number.isSafeInteger(row.amountSats) || row.amountSats <= 0) continue;
      const transfer = row.transfer;
      if (!transfer && row.direction !== 'Incoming') continue;
      const stage = row.status === 'Transfer verified' || (row.status === 'Confirmed' && (!row.bitcoin || (row.bitcoin.confirmations ?? 0) >= 1)) || row.status === 'Settled offchain' ? 2
        : row.status.startsWith('Pending') && row.status !== 'Pending — preparing' ? 1 : 0;
      if (!stage) continue;
      const ark = row.identifier.split(' ').find(ref => ref.startsWith('ark:'));
      const key = transfer?.operationId ? `transfer:${transfer.operationId}` : row.bitcoin ? `bitcoin:${row.bitcoin.txid}:${row.amountSats}` : ark ? `${ark}:${row.amountSats}` : row.id;
      const previous = seen.get(key) ?? 0;
      if (stage <= previous) continue;
      seen.set(key, stage);
      if (!baseline) continue;
      const id = sender(row), short = id && id.length > 9 ? `${id.slice(0,4)}....${id.slice(-5)}` : id;
      const message = transfer
        ? `Transferred ${row.amountSats} Sats From ${transfer.direction === 'to-arkade' ? 'Bitcoin To Arkade' : 'Arkade To Bitcoin'}`
        : `${short ? `User ${short}` : 'Unknown User'} Sent You ${row.amountSats} Sats`;
      show(message + (stage === 1 ? ' (Pending)' : ''));
    }
    baseline = true;
  }};
}
