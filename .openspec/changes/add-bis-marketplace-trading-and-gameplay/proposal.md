## Why

Once the public catalog and game-wallet inventory exist, the demonstration needs to show ownership moving into a player account and affecting gameplay. This follow-on slice deliberately stays serverless: it proves a local two-wallet trade rather than claiming a remote exchange.

## What Changes

- Deliver milestone three: Marketplace-specific Player Wallet Login and Game Wallet Login buttons open the existing BIS account UI for the appropriate role. BIS, rather than a duplicate Marketplace form, owns recovery entry, import, active-session state, and logout. Both roles are required only for a trade in the same browser; the game wallet buys catalog assets back and sells its own catalog assets at listed prices. There is no player-to-player market.
- Use the static registered game-wallet address for public browsing, then use a successfully logged-in game wallet's different address as a clearly labelled, current-browser-session override for inventory and trade context.
- Deliver milestone four: BIS Account Assets recognizes catalog holdings and supports no item or one active item per Shoes, Dagger, and Shield family.
- Deliver milestone five: the packaged BIS API exposes the selected still-owned equipment to Stealth & Steel; selected Shoes affect movement speed, Daggers player damage, and Shields damage received. Guest play remains fully available.

## Capabilities

### New Capabilities

- `marketplace-trading`: Serverless, same-browser two-wallet purchases and sell-backs with truthful outcome handling.
- `equipment-loadout`: Account-scoped selection of no item or one owned catalog item per equipment family.
- `stealth-game-equipment`: Game-facing equipment contract and Stealth & Steel application of active effects.

### Modified Capabilities

- `account-assets`: Let BIS Account Assets reach and manage marketplace equipment without hiding generic assets.
- `game-account-smoke-test`: Extend packaged-game acceptance coverage to active equipment while retaining guest play.

## Impact

- Depends on the completed `add-bis-marketplace` public catalog and issuance proposal.
- Affects the Marketplace package, public `@bis/integration` account API/UI, integration demo, and a later consumer update in Stealth & Steel.
- Does not approve a custom or hosted server, player-to-player resale, custody, remote visitor self-service trading, fabricated trade outcomes, fees, or a numeric balancing table for the tiers.
