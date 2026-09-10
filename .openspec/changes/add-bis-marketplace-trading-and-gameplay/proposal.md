## Why

Once the public catalog and game-wallet inventory exist, the demonstration needs to show recognizable ownership moving into a player account, remaining selectable across local profiles, and affecting gameplay. This follow-on slice stays serverless: it enables a local two-wallet trade only if Arkade proves an atomic asset-for-sats exchange and otherwise still delivers the inventory, loadout, and gameplay path truthfully.

## What Changes

- Deliver milestone three: Marketplace-specific Player Wallet Login and Game Wallet Login buttons open the existing BIS account UI for the appropriate role. BIS, rather than a duplicate Marketplace form, owns recovery entry, import, active-session state, profile switching, and logout. Both roles are required only for a trade in the same browser; the game wallet buys catalog assets back and sells its own catalog assets at the approved family-and-tier prices. There is no player-to-player market.
- Gate enabled Buy and Sell actions on a demonstrated Arkade Signet atomic asset-for-sats exchange. If that primitive cannot meet the receipt and recovery contract, keep trading unavailable while continuing the independent equipment work; do not substitute sequential or simulated settlement.
- Use the static registered game-wallet address for public browsing, then use a successfully logged-in game wallet's different address as a clearly labelled, current-browser-session override for inventory and trade context.
- Extend H. Marketplace Admin tools: H1 mints the nine items with chain metadata for game, asset type, stable catalog identity, family, tier, price, and the C1-style versioned public `iconUrl`; H2 burns every currently owned asset classified on-chain as a Stealth & Steel item while preserving trophies and unrelated assets. H2 continues with other eligible items after an unknown result, and later runs reconcile and skip only the still-unresolved item instead of globally blocking user interaction.
- Deliver milestone four: BIS Account Assets recognizes catalog holdings and supports no item or one active item per Shoes, Dagger, and Shield family. BIS persists the selection in profile-scoped local storage, activates nothing by default, and revalidates current ownership.
- Deliver milestone five: the packaged BIS API exposes selected, still-owned equipment to Stealth & Steel. Settings gains an Items page showing the active player wallet's owned item grid, and the HUD shows `Items: [][][]` under Gold with selected Shoes, Dagger, and Shield icons. All BIS, Marketplace, and game icon rendering uses the on-chain asset URL at runtime. Effects are snapshotted on the next player spawn: Shoes add 10%/20%/30% movement speed, Daggers add 10%/20%/30% player damage, and Shields reduce damage received by 10%/20%/30%. Guest play remains fully available.
- Add story X for multiple BIS player profiles: retain multiple encrypted origin-local player wallets, show their shortened public IDs, indicate the active profile, let the user switch without restoring again, and offer Create or Restore to add another profile.

## Capabilities

### New Capabilities

- `marketplace-trading`: Serverless, same-browser two-wallet purchases and sell-backs with truthful outcome handling.
- `equipment-loadout`: Account-scoped selection of no item or one owned catalog item per equipment family.
- `stealth-game-equipment`: Game-facing equipment contract and Stealth & Steel application of active effects.

### Modified Capabilities

- `account-assets`: Let BIS Account Assets reach and manage marketplace equipment without hiding generic assets.
- `account-entry`: Add the origin-local saved-profile chooser and active-profile switching entry.
- `account-creation`: Add a newly created account to the saved profile collection instead of replacing other profiles.
- `account-restoration`: Add a restored account to the saved profile collection instead of replacing other profiles.
- `account-logout`: Remove only the selected profile while retaining other saved profiles and profile-scoped state.
- `admin-game-wallet`: Let H1 and H2 use only the active, separate Game Wallet signer and current ownership.
- `asset-api`: Carry verified game, type, catalog, tier, price, and icon metadata for marketplace items.
- `asset-burning`: Support truthful multi-item H2 burn progress and item-scoped unknown recovery.
- `marketplace-catalog`: Publish the approved item prices and chain metadata contract.
- `story-driven-demo`: Add H2 and the profile-selection story to the Admin demonstration.
- `game-account-smoke-test`: Extend packaged-game acceptance coverage to profile switching and active equipment while retaining guest play.

## Impact

- Depends on the completed `add-bis-marketplace` public catalog and issuance proposal.
- Affects the Marketplace package, public `@bis/integration` account API/UI, integration demo, account storage migration, and the explicitly authorized consumer update in `D:\Documents\Projects\VC\BabylonJS\babylon-lite-stealth-grid\STEALTH_STEEL`.
- Uses the C1 public-asset pattern for immutable mint metadata: versioned PNGs under the integration demo's public assets and absolute GitHub Pages URLs.
- Approved prices are Shoes 1,000/2,000/3,000 sats, Daggers 1,100/2,100/3,100 sats, and Shields 1,200/2,200/3,200 sats for tiers I/II/III; buy and sell-back use the same item price.
- Does not approve a custom or hosted server, player-to-player resale, custody, remote visitor self-service trading, fabricated trade outcomes, or fees.
