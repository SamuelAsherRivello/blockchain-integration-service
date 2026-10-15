# Proposal

## Why

After a player logs in to the Game Wallet page, the page only confirms that the wallet is configured and does not expose the public Arkade address needed for the game wallet's normal receive workflow. The page also leaves the underlying create, restore, or selection operation represented only by local button state, so the user can see an incomplete page while login work is still finishing. This follow-up makes the completed identity useful and makes the login transition unambiguous.

## What Changes

- Add a selected-wallet address section to the Game Wallet Login page with the header `Arkade address`, the full public Arkade address value, and the standard copy button/value-field behavior.
- Place the address section above `Log Out Game Wallet`; keep the existing Back action and logout behavior unchanged.
- Show the shared blocking loading prompt above the Game Wallet Login page while creating, restoring, or selecting a game wallet, and keep it visible until the operation and resulting wallet state are complete.
- Preserve the existing separation between player and game wallets: expose only the selected public Arkade address, never recovery material, balance, boarding controls, or private state.

## Capabilities

### New Capabilities

- `user-facing-game-wallet`: Define the selected Game Wallet Login presentation, including its public Arkade address/copy field and complete login loading state.

### Modified Capabilities

- `pending-operation-dialog`: Extend the shared pending presentation contract to cover Game Wallet Login create, restore, and selection work through final readiness.

## Impact

- `BIS/packages/integration/src/ui/GameWalletLogin.tsx` and shared UI field/clipboard composition.
- Pending-operation registration and focused Game Wallet UI tests/browser fixtures.
- No new dependency or public secret-bearing API is required; the existing game-wallet public `addresses.arkadeAddress` state is the source for the displayed value.
- The implementation must coexist with the active `add-user-facing-game-wallet` change and should be applied after its F2 page/controller work is available, without modifying that change's existing planning artifacts.
