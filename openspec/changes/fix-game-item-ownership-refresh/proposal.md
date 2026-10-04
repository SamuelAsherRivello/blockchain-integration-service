## Why

An item bought through the local Marketplace is not appearing in Stealth & Steel's Items window after the player opens the game with the same wallet. This breaks the promised purchase-to-game path and leaves a completed ownership transfer indistinguishable from an unavailable item.

## What Changes

- Require the public equipment boundary to expose a freshly chain-verified, newly purchased Stealth & Steel item to an explicitly restored matching player profile in another browser origin.
- Require the game consumer's Items view to refresh that ownership after its Account session is ready, show the recognized item for selection, and retain safe baseline gameplay when ownership cannot be verified.
- Deliver and verify the updated public BIS package in the separately hosted game without copying browser storage, recovery material, or private wallet state between the Marketplace and game origins.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `equipment-loadout`: Make the fresh, chain-owned equipment view cover assets delivered by Marketplace checkout and consumed by a separately hosted game through the public API.
- `game-account-smoke-test`: Define the cross-origin same-profile purchase-to-Items acceptance flow and package-consumer verification.

## Impact

- Affects the public `@bis/integration` equipment API and its ownership-refresh tests.
- Affects the vendored BIS package and Items/account integration in the separate Stealth & Steel game repository, plus its focused and real-browser smoke coverage.
- Does not add a hosted service, cross-origin browser-storage sharing, automatic account import, recovery-data transfer, or new wallet operation.
