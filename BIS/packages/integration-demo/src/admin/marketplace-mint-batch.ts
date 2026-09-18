import type { BisListAssetsResult, BisMintAssetRequest, BisMintAssetResult } from '@bis/integration';
import { marketplaceCatalogItems, marketplaceMintRequest, verifiedMarketplaceRecordsFromAssets, type MintedMarketplaceCatalogItem } from './marketplace-catalog.ts';

export type MarketplaceMintBatchWallet = Readonly<{
  mint(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
  listAssets(): Promise<BisListAssetsResult>;
}>;

export type MarketplaceMintBatchResult =
  | Readonly<{ status: 'verified'; records: readonly MintedMarketplaceCatalogItem[] }>
  | Readonly<{ status: 'error'; itemName?: string; code: string }>;

const transientRetryCount = 8;
const transientRetryDelayMs = 1000;
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export async function mintAndVerifyMarketplaceCatalog(wallet: MarketplaceMintBatchWallet, isCurrent: () => boolean): Promise<MarketplaceMintBatchResult> {
  for (const item of marketplaceCatalogItems) {
    let result: BisMintAssetResult;
    for (let attempt = 0; ; attempt++) {
      if (!isCurrent()) return { status: 'error', code: 'account-changed' };
      result = await wallet.mint(marketplaceMintRequest(item));
      // The asset API reports any post-submission uncertainty as outcome-unknown.
      // Only a pre-submission unavailable result is safe to retry while its
      // replacement VTXO becomes spendable after the preceding catalog mint.
      if (result.status !== 'error' || result.code !== 'unavailable' || attempt === transientRetryCount - 1) break;
      await pause(transientRetryDelayMs);
    }
    if (result.status === 'error') return { status: 'error', itemName: item.name, code: result.code };
  }
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  const fresh = await wallet.listAssets();
  if (fresh.status === 'error') return { status: 'error', code: fresh.code };
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  const records = verifiedMarketplaceRecordsFromAssets(fresh.assets);
  return records ? { status: 'verified', records } : { status: 'error', code: 'verification-failed' };
}
