// Explicit confirmation is available; every submission still revalidates its quote and durable operation gate.
export const boardingSubmissionEnabled = true;
export type BitcoinFundingDestination = Readonly<{purpose:'bitcoin-funding'; bitcoinAddress:string; network:'signet'|'mutinynet'}>;
export function validateBitcoinFundingDestination(value:BitcoinFundingDestination|undefined,direction:BoardingQuote['direction'],network:string) {
  if(value===undefined)return;
  if(!value||Object.keys(value).some(key=>!['purpose','bitcoinAddress','network'].includes(key))||
    value.purpose!=='bitcoin-funding'||direction!=='to-bitcoin'||value.network!==network||
    !['signet','mutinynet'].includes(value.network)||!/^tb1p[a-z0-9]{20,100}$/.test(value.bitcoinAddress))throw Error('Bitcoin funding destination changed. Review again.');
}
export type BoardingQuote = Readonly<{
  profileId: string; direction: 'to-arkade' | 'to-bitcoin'; amountSats: number; feeSats: number; netSats: number;
  maxSats: number; inputSats?: number; bitcoinAfterSats: number; arkadeAfterSats: number; totalAfterSats: number;
  expiresAt: number; fingerprint: string;
  destination?:BitcoinFundingDestination;
}>;

export function assertQuoteUnchanged(reviewed: BoardingQuote, fresh: BoardingQuote, now = Date.now()) {
  if (reviewed.expiresAt <= now || reviewed.profileId !== fresh.profileId || reviewed.direction !== fresh.direction ||
      reviewed.fingerprint !== fresh.fingerprint || reviewed.amountSats !== fresh.amountSats ||
      JSON.stringify(reviewed.destination)!==JSON.stringify(fresh.destination) ||
      reviewed.maxSats !== fresh.maxSats || reviewed.inputSats !== fresh.inputSats ||
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


