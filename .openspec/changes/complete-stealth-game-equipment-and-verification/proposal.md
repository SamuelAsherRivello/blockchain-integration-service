## Why

The BIS Marketplace and equipment-selection foundation is complete, but the Stealth & Steel consumer has not yet exposed selections, applied their effects, or completed its cross-project acceptance. Separating this remaining work preserves a truthful archive for the completed BIS slice and gives game delivery and live verification their own implementation boundary.

## What Changes

- Replace the Stealth & Steel Settings Items action with an `⚡ Items` main-menu action directly below Start, enabled only for an active player profile, using only the packaged public BIS equipment API.
- Make the Items window show the exact instruction `Select 1 of each item type to activate it for gameplay`, present each owned item as a square reference-matched tile, reserve visible 3-by-3 capacity without scrollbars, and make selected tiles unmistakable without adding visible text.
- Snapshot freshly verified Shoes, Dagger, and Shield selections on player spawn and apply the approved tier effects without changing guest baseline play.
- Render the three ordered chain-URL item slots beneath Gold in the game HUD.
- Complete focused, package-consumer, browser, and Signet verification for the game and completed Marketplace/BIS experiences, leaving the active Game Wallet's H1 catalog inventory available for manual testing.

## Capabilities

### New Capabilities

- `stealth-game-equipment`: Game-facing equipment selection, spawn-snapshotted effects, and HUD presentation.

### Modified Capabilities

- `game-account-smoke-test`: Extend packaged-game acceptance to cover profile-scoped owned-item selection and effective equipment while retaining guest play.

## Impact

- Affects the authorized Stealth & Steel consumer at `D:\Documents\Projects\VC\BabylonJS\babylon-lite-stealth-grid\STEALTH_STEEL` and its vendored `@bis/integration` package workflow.
- Reuses the completed public BIS equipment API and chain-provided image URLs; it adds no Arkade dependency, wallet secrets, server, or marketplace transaction path to the game.
- Requires coordinated verification of the BIS package, Marketplace, game builds, and safe non-secret Signet/browser evidence.
