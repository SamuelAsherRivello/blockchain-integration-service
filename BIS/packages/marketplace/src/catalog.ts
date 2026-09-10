export type EquipmentFamily = 'Shoes' | 'Dagger' | 'Shield';
export type CatalogItem = Readonly<{ id:string; name:string; family:EquipmentFamily; tier:1|2|3; effect:string; artwork:string; assetId?:string; quantity?:string }>;
export type MarketplaceCatalog = Readonly<{ version:1; gameId:string; gameWalletAddress?:string; items:readonly CatalogItem[] }>;
export const templateItems: readonly CatalogItem[] = [
  ['shoes', 'Shoes', 'increase movement speed'], ['dagger', 'Dagger', 'increase player damage'], ['shield', 'Shield', 'reduce damage taken'],
].flatMap(([prefix, family, effect]) => [1,2,3].map(tier => ({ id:`stealth-steel-${prefix}-${tier}`, name:`${family} ${['I','II','III'][tier-1]}`, family:family as EquipmentFamily, tier:tier as 1|2|3, effect:`Tier ${tier}: ${effect}.`, artwork:`${prefix}-${tier}` })));
export const fallbackCatalog: MarketplaceCatalog = { version:1, gameId:'stealth-and-steel', items:templateItems };
