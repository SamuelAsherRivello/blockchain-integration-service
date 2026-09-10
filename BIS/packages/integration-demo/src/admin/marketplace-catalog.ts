export type MarketplaceCatalogItem = {
  id: string;
  name: string;
  ticker: string;
  family: 'Shoes' | 'Dagger' | 'Shield';
  tier: number;
  effect: string;
  artwork: string;
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

const families = [
  ['shoes', 'Shoes', 'increase movement speed'],
  ['dagger', 'Dagger', 'increase player damage'],
  ['shield', 'Shield', 'reduce damage taken'],
] as const;

export const marketplaceCatalogItems: MarketplaceCatalogItem[] = families.flatMap(([slug, family, effect]) => [1, 2, 3].map(tier => ({
  id: `stealth-steel-${slug}-${tier}`,
  name: `${family} ${['I', 'II', 'III'][tier - 1]}`,
  ticker: `${slug.slice(0, 3).toUpperCase()}${tier}`,
  family,
  tier,
  effect: `Tier ${tier}: ${effect}.`,
  artwork: `${slug}-${tier}`,
})));

export function marketplaceMintRequest(item: MarketplaceCatalogItem) {
  return {
    operationId: `marketplace-${item.id}-v1`,
    name: item.name,
    ticker: item.ticker,
    amount: '1',
    decimals: 0,
  } as const;
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
      && item.effect === expected.effect
      && item.artwork === expected.artwork
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
