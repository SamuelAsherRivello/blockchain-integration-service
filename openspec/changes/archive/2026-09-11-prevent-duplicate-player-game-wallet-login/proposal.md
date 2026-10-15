## Why

The player and game-wallet flows currently enforce separation only when a game wallet is selected. A player can still be activated with the same identity after the game wallet is configured, leaving one signer in both roles.

## What Changes

- Enforce a mutual-exclusion invariant: one public profile identity cannot be accepted as both the active Player Wallet and the selected Game Wallet for the same browser origin.
- Reject a conflicting Player Wallet create/continue, restore, or saved-profile activation before it becomes active or emits a connection event; retain the existing player and game-wallet selections unchanged and show a clear role-conflict error.
- Retain and extend Game Wallet conflict checks across create, restore/import, selection, storage refresh, and role changes so a configured Player Wallet is never accepted as the Game Wallet.
- Wire the two controllers together through profile-ID-only coordination, including race-safe revalidation at durable/activation boundaries. No recovery phrase or Arkade account object may cross the public API boundary.
- Add focused core and browser/UI regression coverage for Player-first and Game-Wallet-first conflicts, non-conflicting logins, selection changes, and stale asynchronous results.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `account-creation`: A player creation candidate cannot be committed or activated when its public profile ID is already the selected Game Wallet.
- `account-restoration`: A restored Player Wallet identity cannot be saved or activated when it is already the selected Game Wallet.
- `admin-game-wallet`: The separately retained Game Wallet must remain mutually exclusive with the Player Wallet throughout selection, refresh, and lifecycle changes.
- `game-wallet-restoration`: Restoring a Game Wallet must reject a phrase that resolves to the active Player Wallet while retaining both existing role selections.

## Impact

- Affected runtime: `BIS/packages/integration/src/core/context.ts`, `game-wallet.ts`, their composition in `bis-game-services.ts`, and the integration demo setup.
- Affected private UI feedback: Player restore/create and Game Wallet create/restore/selection feedback.
- Affected tests: integration core wallet/account tests and browser-host coverage. No new dependency, server, network, or recovery-material exposure is required.
