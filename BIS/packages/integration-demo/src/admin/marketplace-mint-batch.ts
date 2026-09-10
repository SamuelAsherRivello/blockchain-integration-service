import type { BisListAssetsResult, BisMintAssetRequest, BisMintAssetResult } from '@bis/integration';
import { marketplaceCatalogItems, marketplaceMintRequest, verifiedMarketplaceRecordsFromAssets, type MintedMarketplaceCatalogItem } from './marketplace-catalog.ts';

export type MarketplaceMintBatchWallet = Readonly<{
  mint(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
  listAssets(): Promise<BisListAssetsResult>;
}>;

export type MarketplaceMintBatchResult =
  | Readonly<{ status: 'verified'; records: readonly MintedMarketplaceCatalogItem[] }>
  | Readonly<{ status: 'error'; itemName?: string; code: string }>;

export async function mintAndVerifyMarketplaceCatalog(wallet: MarketplaceMintBatchWallet, isCurrent: () => boolean): Promise<MarketplaceMintBatchResult> {
  for (const item of marketplaceCatalogItems) {
    if (!isCurrent()) return { status: 'error', code: 'account-changed' };
    const result = await wallet.mint(marketplaceMintRequest(item));
    if (result.status === 'error') return { status: 'error', itemName: item.name, code: result.code };
  }
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  const fresh = await wallet.listAssets();
  if (fresh.status === 'error') return { status: 'error', code: fresh.code };
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  const records = verifiedMarketplaceRecordsFromAssets(fresh.assets);
  return records ? { status: 'verified', records } : { status: 'error', code: 'verification-failed' };
}
