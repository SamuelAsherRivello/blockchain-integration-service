# Proposal

## Why

The Marketplace can currently display and query the published Game Wallet even after the Player Wallet has been logged out. This makes a logged-out game session appear authenticated and can expose Game Wallet inventory outside the active player/game session. The logout boundary must be reflected in the Marketplace immediately.

## What Changes

- **BREAKING** Remove anonymous registered Game Wallet fallback from the game-facing Marketplace session.
- Prevent Marketplace Game Wallet inventory reads, address display, and game-wallet-dependent actions when no Player Wallet is active.
- Ensure player logout clears the game-facing active Game Wallet presentation and invalidates any in-flight or cached Marketplace Game Wallet result for that session.
- Keep separately retained Admin Game Wallet identities and encrypted storage intact; this change concerns the active game-facing session, not Admin wallet retention.
- Add regression coverage for a retained Game Wallet followed by Player logout and for a Marketplace opened without a Player Wallet.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `marketplace-catalog`: logged-out or anonymous Marketplace sessions no longer use the registered Game Wallet as an inventory source or present it as an active wallet; Game Wallet behavior is available only within an active Player Wallet session.

## Impact

The primary implementation surface is `BIS/packages/marketplace/src/client/marketplace-layer/App.tsx`, with focused Marketplace inventory and UI regression tests. The existing integration Game Wallet controller and Admin retention behavior remain separate boundaries. The published catalog format remains unchanged, but its public Game Wallet address is no longer treated as an active game-session wallet when the Player Wallet is absent.
