## Why

B1 already makes verified Signet continuation payments, but the game cannot use them to resume a defeated player. B2 connects that operation to the real loss screen while preserving the current run.

## What Changes

- BIS exposes a fixed 1000-sat continuation price for game-owned button text and submission. Keep the existing B1 request API compatible.
- The loss screen shows `Pay 1000 Sats To Continue` first and `Restart Game` below (the user's later shared C6 wording). Pay is always greyed out without a logged-in account. Clicking Pay disables both choices until confirmed success or failure; uncertainty remains pending.
- On confirmed payment, BIS shows `User paid 1000 sats to continue` through D7 and invokes a host callback once for that attempt. The game alone owns the consequence.
- The game rebuilds a full-health player through the same row/column spawn function used at level start, preserves its exact current position and loadout, instantly removes enemies in the player's cell and its eight neighbors, then resumes without resetting any other world state.
- Restart remains free. Closing or refreshing starts a new session; old results cannot revive or remove enemies in it. No saved-run restoration.
- Follow-up: Admin B1 reads `"Pay 1000 Sats To Coninue"`, including literal quotes and the requested spelling, and uses the production payment-to-toast flow in Runtime Preview. The game's Pay action has a lightning icon to the left; shared menu text shrinks to fit, accounting for any icon width.
- Final follow-up: confirmed-payment toasts show a lightning logo to the left of the unchanged payment message in both game and Admin preview.

## Capabilities

### New Capabilities
- `game-pay-to-continue`: Shared price and payment callback, loss-screen choices, same-session revival, and attributable completion.

### Modified Capabilities
None. B1 payment verification/idempotency remains the underlying contract. Game loss-flow and state specs are reconciled during integration.

## Impact

Planning is centralized in this BIS change and covers the explicitly selected `babylon-lite-stealth-grid` repository as well. BIS adds a public continuation controller over B1, a D7 toast consumer, tests, and documentation. The game updates its BIS host adapter, loss menu, combat revival/state transition, packaged BIS snapshot, and tests. D7 is an implementation dependency; its in-progress edits are preserved. No new third-party dependency, server, mainnet support, automatic funding/refund, checkpoint persistence, or trophy work. The user explicitly requested apply after the interview on 2026-09-07.
