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

export type PublishedMarketplaceCatalog = {
  version: 1;
  gameId: 'stealth-and-steel';
  gameWalletAddress: string;
  items: MintedMarketplaceCatalogItem[];
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

/** Returns null unless every expected item has a successful, non-empty mint record. */
export function createVerifiedMarketplaceCatalog(
  gameWalletAddress: string,
  items: readonly MintedMarketplaceCatalogItem[],
): PublishedMarketplaceCatalog | null {
  if (!gameWalletAddress || items.length !== marketplaceCatalogItems.length) return null;
  const verified = items.every((item, index) => {
    const expected = marketplaceCatalogItems[index];
    return expected !== undefined
      && typeof item === 'object'
      && item !== null
      && item.id === expected.id
      && item.name === expected.name
      && item.ticker === expected.ticker
      && item.family === expected.family
      && item.tier === expected.tier
      && item.priceSats === expected.priceSats
      && item.effectPercent === expected.effectPercent
      && item.effect === expected.effect
      && item.artwork === expected.artwork
      && item.iconUrl === expected.iconUrl
      && typeof item.assetId === 'string'
      && item.assetId.length > 0
      && typeof item.quantity === 'string'
      && item.quantity.length > 0;
  });
  return verified ? { version: 1, gameId: 'stealth-and-steel', gameWalletAddress, items: [...items] } : null;
}

export function isVerifiedMarketplaceCatalog(value: unknown): value is PublishedMarketplaceCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as Partial<PublishedMarketplaceCatalog>;
  return catalog.version === 1
    && catalog.gameId === 'stealth-and-steel'
    && typeof catalog.gameWalletAddress === 'string'
    && Array.isArray(catalog.items)
    && createVerifiedMarketplaceCatalog(catalog.gameWalletAddress, catalog.items as MintedMarketplaceCatalogItem[]) !== null;
}
