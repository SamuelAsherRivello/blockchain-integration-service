# Proposal

## Why

Player logout currently clears the Player Wallet while leaving the separately persisted Game Wallet selected. After a refresh, a later Player-only login can therefore reactivate the old Game Wallet in BIS and make Marketplace report both wallets as logged in. Marketplace also has a catalog-address fallback that can display the published Game Wallet as if it were an authenticated session wallet.

## What Changes

- Couple Player logout with a complete Game Wallet logout: clear every retained Game Wallet identity and invalidate its session state when the Player Wallet is logged out.
- Make each wallet logout atomic at the local-session boundary: remove its identity, pending recovery data, cached data, subscriptions, and stale in-memory state before reporting success.
- Keep the Player Wallet untouched when only the Game Wallet logs out.
- Require an explicit active Game Wallet state before Marketplace displays a Game Wallet address, reads Game Wallet inventory, or enables Game Wallet actions.
- Keep the published catalog Game Wallet address available as public catalog metadata only; never present it as the logged-in Game Wallet.
- Add regression coverage for logout, refresh, Player-only login, stale inventory, game-only isolation, and the absence of retained Game Wallet identities.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `marketplace-catalog`: Game Wallet presentation and inventory require an explicitly active Game Wallet session associated with an active Player Wallet.
- `admin-game-wallet`: Player logout compounds into complete Game Wallet cleanup; explicit Game Wallet logout remains isolated from the Player Wallet.

## Impact

The implementation affects the BIS lifecycle bridge between `createBisContext` and `createBisGameWallet`, Game Wallet IndexedDB and browser cleanup, Marketplace wallet derivation, checkout/cache invalidation, and focused integration/Marketplace tests. The published catalog schema and public catalog browsing remain unchanged; retained Game Wallet identities are intentionally removed on logout and must be explicitly imported again.
