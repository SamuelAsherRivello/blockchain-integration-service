# Proposal

## Why

The game's Clear Settings button currently clears its settings and invokes the BIS reset facade. A game-preference action must leave BIS account, wallet, and workflow state intact, and the game must not identify or manage BIS storage keys.

## What Changes

- Make Clear Settings a game-only action that resets only state owned by the game's settings store.
- Remove the Clear Settings flow's call to the BIS reset facade and its BIS-specific completion or failure reporting.
- Preserve BIS state, including its browser storage, UI session, wallets, journals, and outstanding workflow state.
- Add focused tests that prove the action removes the game settings record while leaving unrelated same-origin records untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-state-reset`: Separate the optional BIS reset command from the game's Clear Settings action.
- `bis-game-contract`: Stop defining Clear Settings as a caller of the BIS force-reset facade.

## Impact

The game settings UI, its settings-store tests, and its integration tests will change. The BIS public reset API remains available for an explicit BIS-reset workflow, but Clear Settings will no longer call it. No storage-key list, migration, package dependency, or network behavior changes.
