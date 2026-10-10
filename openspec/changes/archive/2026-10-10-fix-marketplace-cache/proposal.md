# Proposal

## Why

Marketplace inventory currently treats the Game Wallet read as the primary loading operation and does not retain a reusable result for either wallet. This makes switching ownership tabs or refreshing the page unnecessarily repeat provider reads, leaves the user waiting on an unrelated wallet, and collapses provider failures into an unhelpful generic state. The Marketplace should continuously prepare both public inventories while only blocking the wallet the user is viewing.

## What Changes

- Add a Marketplace inventory coordinator that starts Player Wallet and Game Wallet reads independently on refresh and maintains separate results for each wallet.
- Add a 30-second, network- and wallet-scoped `localStorage` cache containing only public, classified item results and safe timestamps.
- Reuse fresh cached results after page refreshes and in new tabs without showing a loading prompt or repeating the provider read.
- Make the loading prompt tab-scoped: Player Wallet waits only for the Player Wallet result, and Game Wallet waits only for the Game Wallet result.
- Replace the loading prompt with an explicit error prompt when the selected wallet cannot be read; never convert an unavailable read into an empty inventory.
- Preserve the existing Game Wallet ownership, Player Wallet ownership, catalog classification, and checkout behavior.
- Add focused coordinator, cache, tab-switching, expiry, and failure tests.

## Capabilities

### New Capabilities

- `marketplace-inventory-cache`: Coordinates independent public inventory reads and a short-lived wallet/network-scoped cache for Marketplace tabs.

### Modified Capabilities

- `marketplace-catalog`: Change Marketplace inventory loading and failure behavior so the selected ownership tab controls visible loading/error state while both wallet sources may refresh in the background.

## Impact

- Affected code: `BIS/packages/marketplace/src/client/marketplace-layer/App.tsx`, Marketplace inventory-layer modules, cache/storage helpers, and Marketplace tests.
- Affected public behavior: Marketplace refresh, ownership-tab switching, page reloads, new-tab visits, and unavailable inventory feedback.
- No Arkade-specific types or wallet secrets enter the Marketplace cache; wallet reads continue through BIS public APIs.
- No minting, burning, checkout settlement, or gameplay metadata contract changes are included.
