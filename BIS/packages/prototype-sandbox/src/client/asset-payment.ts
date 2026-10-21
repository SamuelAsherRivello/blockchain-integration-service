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
