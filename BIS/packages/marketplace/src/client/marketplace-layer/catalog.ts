/** Public trust anchor only. Equipment is derived from fresh chain metadata. */
export type MarketplaceGame = Readonly<{ gameId:string; displayName:string; gameWalletAddress?:string }>;
export type MarketplaceCatalog = Readonly<{ version:2; games:readonly MarketplaceGame[] }>;
export const fallbackCatalog: MarketplaceCatalog = { version:2, games:[
  {gameId:'stealth-and-steel',displayName:'Stealth & Steel'},
  {gameId:"Rogue's Dungeon",displayName:"Rogue's Dungeon"},
] };
