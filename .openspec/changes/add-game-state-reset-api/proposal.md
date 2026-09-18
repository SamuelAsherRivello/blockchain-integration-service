## Why

The game needs one deterministic “clear all settings” action that can clear its own gameplay preferences and also remove every BIS-owned local session tied to that game origin. Calling player-wallet logout and game-wallet logout separately leaves room for partial cleanup, stale subscriptions, or retained BIS journals, and the existing player-facing logout acknowledgement is not appropriate for a game-owned force-reset control.

## What Changes

- Add a protocol-neutral public reset method on the game-facing `BisGameServices` facade.
- Define the reset as a forceful, no-confirmation BIS cleanup for the active player wallet and selected game wallet.
- Clear BIS-owned account material, wallet selections, operation journals, transient workflow/session state, subscriptions, and UI presentation state that can otherwise survive a game reset.
- Invalidate in-flight local work and prevent late callbacks from repopulating the cleared state.
- Preserve remote wallet funds and network history; submitted or already-broadcast operations are not canceled or falsely reported as canceled.
- Keep the game-owned side of the reset separate: the game’s Clear All Settings handler remains responsible for gameplay preferences and should call BIS reset as part of the same action.
- Add tests and game/demo integration coverage for successful reset, partial/failed cleanup, stale callbacks, cross-context state, and repeat calls.

## Capabilities

### New Capabilities

- `game-state-reset`: Forceful, idempotent cleanup contract for a game-triggered reset of BIS-owned local state.

### Modified Capabilities

- `bis-host-game-contract`: Extend the public game facade with the reset operation and its provider-neutral result/error contract.
- `game-account-smoke-test`: Require the consuming game’s Clear All Settings flow to invoke BIS reset and verify that game and BIS state are both cleared without restoring gameplay state.

## Impact

- `BIS/packages/integration/src/core/bis-game-services.ts` and public type exports gain the game reset API.
- Core account/game-wallet storage and lifecycle coordination must support an explicit force-reset path distinct from interactive player logout.
- Core controllers, event subscriptions, UI, and game-preview session state need reset/disposal hooks.
- `BIS/packages/integration-demo` gains a representative Clear All Settings integration and reset verification.
- No new dependency or network endpoint is required; the reset is local and provider-neutral.
