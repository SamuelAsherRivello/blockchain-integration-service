// Explicit confirmation is available; every submission still revalidates its quote and durable operation gate.
export const boardingSubmissionEnabled = true;
export type BoardingQuote = Readonly<{
  profileId: string; direction: 'to-arkade' | 'to-bitcoin'; amountSats: number; feeSats: number; netSats: number;
  maxSats: number; bitcoinAfterSats: number; arkadeAfterSats: number; totalAfterSats: number;
  expiresAt: number; fingerprint: string;
}>;

export function assertQuoteUnchanged(reviewed: BoardingQuote, fresh: BoardingQuote, now = Date.now()) {
  if (reviewed.expiresAt <= now || reviewed.profileId !== fresh.profileId || reviewed.direction !== fresh.direction ||
      reviewed.fingerprint !== fresh.fingerprint || reviewed.amountSats !== fresh.amountSats ||
      reviewed.feeSats !== fresh.feeSats || reviewed.netSats !== fresh.netSats ||
      reviewed.totalAfterSats !== fresh.totalAfterSats || reviewed.bitcoinAfterSats !== fresh.bitcoinAfterSats ||
      reviewed.arkadeAfterSats !== fresh.arkadeAfterSats) throw Error('Transfer details changed. Review again.');
}

export function boardingAmounts(totalInput: number, requested: number | undefined, minimum: number, changeMinimum: number) {
  if (![totalInput,minimum,changeMinimum].every(n=>Number.isSafeInteger(n)&&n>=0)) throw Error('Invalid boarding amounts.');
  const amount = requested ?? totalInput;
  if (!Number.isSafeInteger(amount) || amount < Math.max(1,minimum) || amount > totalInput) throw Error('Choose an eligible whole number of sats.');
  const change = totalInput - amount;
  if (change > 0 && change < changeMinimum) throw Error(`Leave at least ${changeMinimum} sats as change, or choose Max.`);
  return { amountSats:amount,changeSats:change,maxSats:totalInput };
}


