import { assertQuoteUnchanged, type BoardingQuote } from './boarding-quote.ts';
import type { BisTransferStatus } from './context.ts';
import type { BisGameWalletOperationScope, BisGameWalletState } from './game-wallet.ts';

export const serverSignetBoardingAmountSats = 1_000;

export type ServerBoardingWallet = {
  getState(): BisGameWalletState;
  getOperationScope(): BisGameWalletOperationScope;
  isOperationScopeCurrent(scope: BisGameWalletOperationScope): boolean;
  quoteBoarding(amountSats: number): Promise<BoardingQuote>;
  board(quote: BoardingQuote): Promise<BisTransferStatus>;
  checkBoarding(): Promise<BisTransferStatus>;
};

export type ServerBoardingReview = Readonly<{
  id: string;
  quote: BoardingQuote;
  scope: BisGameWalletOperationScope;
}>;

const usedReviews = new WeakSet<object>();

export class ServerBoardingNotSubmittedError extends Error {
  constructor() {
    super('The reviewed Signet inputs changed or could not be revalidated. No transfer was submitted. Request a fresh quote.');
    this.name = 'ServerBoardingNotSubmittedError';
  }
}

function validInputOutpoints(inputs: ServerBoardingReview['quote']['inputOutpoints'], inputSats: number) {
  if (!Array.isArray(inputs) || inputs.length === 0) return false;
  if (!Object.isFrozen(inputs)) return false;
  let total = 0;
  const seen = new Set<string>();
  for (const input of inputs) {
    if (!input || !/^[a-f0-9]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 ||
        !Number.isSafeInteger(input.valueSats) || input.valueSats <= 0 || !Array.isArray(input.assets) ||
        !Object.isFrozen(input) || !Object.isFrozen(input.assets)) return false;
    const outpoint = `${input.txid}:${input.vout}`;
    if (seen.has(outpoint)) return false;
    seen.add(outpoint);
    for (const asset of input.assets) {
      if (!asset || !Object.isFrozen(asset) || !/^[a-f0-9]{68}$/.test(asset.assetId) || !/^[1-9][0-9]*$/.test(asset.amount)) return false;
    }
    total += input.valueSats;
    if (!Number.isSafeInteger(total)) return false;
  }
  return total === inputSats;
}

function serverSignetScope(state: BisGameWalletState, scope: BisGameWalletOperationScope) {
  return state.source === 'server' && state.status === 'ready' && state.network === 'signet' &&
    typeof state.profileId === 'string' && state.profileId === scope.gameProfileId && scope.network === 'signet';
}

export function currentServerSignetBoardingReview(wallet: ServerBoardingWallet, review: ServerBoardingReview, now = Date.now()) {
  const state = wallet.getState();
  if (!serverSignetScope(state, review.scope) || !wallet.isOperationScopeCurrent(review.scope) ||
      review.quote.profileId !== state.profileId || review.quote.direction !== 'to-arkade' ||
      review.quote.amountSats !== serverSignetBoardingAmountSats ||
      !Number.isSafeInteger(review.quote.feeSats) || review.quote.feeSats < 0 ||
      review.quote.feeSats > review.quote.amountSats || !Number.isSafeInteger(review.quote.netSats) ||
      review.quote.netSats < 0 || review.quote.netSats !== review.quote.amountSats - review.quote.feeSats ||
      !Number.isSafeInteger(review.quote.maxSats) || review.quote.maxSats < review.quote.amountSats ||
      !Number.isSafeInteger(review.quote.inputSats) || review.quote.inputSats! < review.quote.amountSats ||
      !validInputOutpoints(review.quote.inputOutpoints, review.quote.inputSats!) ||
      !Number.isSafeInteger(review.quote.bitcoinAfterSats) || review.quote.bitcoinAfterSats < 0 ||
      !Number.isSafeInteger(review.quote.arkadeAfterSats) || review.quote.arkadeAfterSats < 0 ||
      !Number.isSafeInteger(review.quote.totalAfterSats) || review.quote.totalAfterSats < 0 ||
      !Number.isSafeInteger(review.quote.expiresAt) || review.quote.expiresAt <= now + 5_000 ||
      !/^[a-f0-9]{64}$/.test(review.quote.fingerprint)) return false;
  return true;
}

export async function quoteServerSignetBoarding(wallet: ServerBoardingWallet): Promise<ServerBoardingReview> {
  const state = wallet.getState(), scope = wallet.getOperationScope();
  if (!serverSignetScope(state, scope) || !wallet.isOperationScopeCurrent(scope))
    throw Error('A ready Signet server Game Wallet is required.');
  const quote = await wallet.quoteBoarding(serverSignetBoardingAmountSats);
  const review = Object.freeze({ id: crypto.randomUUID(), quote, scope });
  if (!currentServerSignetBoardingReview(wallet, review))
    throw Error('The Signet onboarding quote changed. Request a fresh quote.');
  return review;
}

export async function submitServerSignetBoarding(wallet: ServerBoardingWallet, review: ServerBoardingReview, consented: boolean) {
  if (!consented) throw Error('Explicit Signet onboarding consent is required.');
  if (!currentServerSignetBoardingReview(wallet, review)) throw Error('The Signet onboarding quote expired or the wallet changed.');
  if (usedReviews.has(review)) throw Error('This Signet onboarding quote was already used. Request a fresh quote or check status.');
  usedReviews.add(review);
  let fresh: BoardingQuote;
  try { fresh = await wallet.quoteBoarding(serverSignetBoardingAmountSats); }
  catch { throw new ServerBoardingNotSubmittedError(); }
  try {
    assertQuoteUnchanged(review.quote, fresh);
    if (!currentServerSignetBoardingReview(wallet, Object.freeze({ ...review, quote: fresh }))) throw Error('The refreshed quote is not valid.');
  } catch { throw new ServerBoardingNotSubmittedError(); }
  return wallet.board(review.quote);
}
