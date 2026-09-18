## Why

The earlier proposal incorrectly treated every BIS asset mint as Game Wallet-owned or Game Wallet-gated. The intended model separates admin-minted game items and one-at-a-time trophy rewards from Game Wallet-funded flows: the Player Wallet must be active for item support, while Game Wallet requirements remain limited to operations that actually use that wallet, such as LTO, payments, and contracts.

## What Changes

- Add a read-only `hasItemSupport()` game-facing capability check. It reports true when an active Player Wallet and BIS item-support path are available; it does not require a Game Wallet or Game Wallet currency.
- Keep game items admin-minted and consumed by the game. Do not turn generic item minting into a Player/Game Wallet prerequisite.
- Preserve the separate trophy reward flow: a game-issued trophy is minted one at a time and immediately transferred to the Player Wallet.
- Preserve existing Game Wallet requirements for LTO, Game Wallet payments, refunds, and other flows that sign or fund with the Game Wallet; this release does not change those flows.
- Update public types, documentation, focused tests, and the local BIS release handoff. Do not modify Stealth & Steel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `asset-api`: add Player Wallet-only item-support preflight and preserve generic/admin mint semantics without a Game Wallet gate.

## Impact

- `BIS/packages/integration` public game service and item/trophy support API.
- `BIS/packages/integration-demo` capability fixtures and documentation.
- No Stealth & Steel source changes, no global mint gate, no change to item ownership semantics, and no new custody or server layer.
