import { bisMarketplaceItems, classifyBisEquipmentAsset, marketplaceItemMetadata, type BisAsset } from '@bis/integration';

export type MarketplaceCatalogItem = {
  id: string;
  name: string;
  ticker: string;
  family: 'Shoes' | 'Dagger' | 'Shield';
  tier: number;
  priceSats: number;
  effectPercent: number;
  effect: string;
  artwork: string;
  iconUrl: string;
};

export type MintedMarketplaceCatalogItem = MarketplaceCatalogItem & {
  assetId: string;
  quantity: string;
};

export const marketplaceCatalogItems: MarketplaceCatalogItem[] = bisMarketplaceItems.map(item => ({
  id: item.catalogId,
  name: item.name,
  ticker: item.ticker,
  family: item.family,
  tier: item.tier,
  priceSats: item.priceSats,
  effectPercent: item.effectPercent,
  effect: item.effect,
  artwork: `${item.family.toLowerCase()}-${item.tier}`,
  iconUrl: item.iconUrl,
}));

export function marketplaceMintRequest(item: MarketplaceCatalogItem) {
  return {
    operationId: `marketplace-${item.id}-v2`,
    name: item.name,
    ticker: item.ticker,
    amount: '1',
    decimals: 0,
    iconUrl: item.iconUrl,
    metadata: marketplaceItemMetadata(bisMarketplaceItems.find(definition => definition.catalogId === item.id)!),
  } as const;
}

/** Builds publication records only from a complete, unambiguous fresh chain read. */
export function verifiedMarketplaceRecordsFromAssets(assets: readonly BisAsset[]): MintedMarketplaceCatalogItem[] | null {
  const classified = assets.map(classifyBisEquipmentAsset).filter(item => item !== null);
  const records: MintedMarketplaceCatalogItem[] = [];
  for (const expected of marketplaceCatalogItems) {
    const matches = classified.filter(item => item.catalogId === expected.id);
    if (matches.length !== 1) return null;
    records.push({ ...expected, assetId: matches[0].assetId, quantity: matches[0].quantity });
  }
  return records;
}
