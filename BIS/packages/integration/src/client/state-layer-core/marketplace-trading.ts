export type BisMarketplaceTradingAvailability = Readonly<{
  status: 'unavailable';
  code: 'atomic-exchange-unsupported';
  message: string;
}>;

const unavailable = Object.freeze({
  status: 'unavailable',
  code: 'atomic-exchange-unsupported',
  message: 'Buy and Sell are unavailable because the installed Arkade SDK does not provide the required atomic asset-for-sats exchange.',
} satisfies BisMarketplaceTradingAvailability);

/**
 * Reports the proven marketplace settlement capability without opening a
 * wallet or exposing a sequential asset/sats submission path.
 */
export function getBisMarketplaceTradingAvailability(): BisMarketplaceTradingAvailability {
  return unavailable;
}
