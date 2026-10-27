export const OPTIONAL_ASSET_PAYMENTS = Object.freeze([0, 100, 1000]);

export function optionalAssetPayment(value: unknown) {
  const amount = value === null || value === '' ? 0 : Number(value);
  if (!OPTIONAL_ASSET_PAYMENTS.includes(amount)) throw new Error('Choose an optional payment of 0, 100, or 1000 sats.');
  return amount;
}

export function assetTransferSats(carrier: bigint | number, optional: unknown) {
  const required = Number(carrier);
  const total = required + optionalAssetPayment(optional);
  if (!Number.isSafeInteger(required) || required < 1 || !Number.isSafeInteger(total)) throw new Error('Invalid SDK carrier amount.');
  return total;
}

/** Explain the SDK's wrapped fetch error without exposing request URLs or scripts. */
export function assetSendIndexerError(error: unknown, sendStarted: boolean): Error | undefined {
  if (!(error instanceof Error) || error.message !== 'indexer request failed') return undefined;
  let cause: unknown = error;
  let timeout = false;
  for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
    if (cause.name === 'TimeoutError' || cause.name === 'AbortError') timeout = true;
    cause = cause.cause;
  }
  const reason = timeout ? 'The indexer request timed out.' : 'The browser could not complete an indexer network request.';
  const outcome = sendStarted
    ? 'The send outcome is unknown. Check wallet transaction history before retrying.'
    : 'Wallet preparation failed before the send was submitted. Retry when the indexer connection is available.';
  return new Error(`${reason} ${outcome}`);
}
