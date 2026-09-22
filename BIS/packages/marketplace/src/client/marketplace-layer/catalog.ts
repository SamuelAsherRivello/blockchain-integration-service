/** Public trust anchor only. Equipment is derived from fresh chain metadata. */
export type MarketplaceCatalog = Readonly<{ version:2; gameId:string; gameWalletAddress?:string }>;
export const fallbackCatalog: MarketplaceCatalog = { version:2, gameId:'stealth-and-steel' };
