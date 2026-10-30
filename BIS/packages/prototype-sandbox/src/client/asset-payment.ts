export const ASSET_PAYMENT_SATS = Object.freeze([330, 1000]);

export function assetPaymentSats(value: unknown) {
  // Preserve valid choices and migrate the former subdust selections.
  const amount = value == null || value === '' || [0, 1, 100].includes(Number(value)) ? 330 : Number(value);
  if (!ASSET_PAYMENT_SATS.includes(amount)) throw new Error('Choose a payment of 330 or 1000 sats.');
  return amount;
}

export function demoValidateAssetTransferSats(value: unknown) {
  if (value != null && value !== '' && Number(value) < 330) throw new Error('The minimum asset payment is 330 sats. Nothing was sent.');
  return assetPaymentSats(value);
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
