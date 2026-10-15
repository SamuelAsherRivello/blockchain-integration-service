# Design

## Context

The game keeps its preferences in one owned settings record. Its current Clear Settings handler resets that record, then calls the BIS facade reset method. See [proposal.md](proposal.md) for the reason to separate those actions.

## Goals / Non-Goals

**Goals:**

- Make the game settings store the sole authority for Clear Settings cleanup.
- Leave BIS state untouched without adding BIS key knowledge to the game.
- Prove isolation with tests that seed records outside the game settings store.

**Non-Goals:**

- Remove or change the BIS explicit reset API.
- Add a new BIS-reset control or change wallet, transaction, or network behavior.
- Enumerate, preserve, migrate, or otherwise manage BIS records from the game.

## Decisions

### Use the game settings-store reset boundary

The button will call the existing game settings-store reset operation and update its controls from the restored defaults. That boundary already removes the single game-owned settings record. The alternative is browser-wide storage enumeration with a game-key allowlist. It would make the UI responsible for storage ownership and risks removing future records outside the known list.

### Remove BIS reset coupling from the button handler

The handler will not obtain the BIS facade or call its reset method. It will show only a game-settings result. The alternative is to call BIS and ignore the result. That would still change BIS state and violates the required scope.

### Test ownership by observable isolation

Focused UI and settings-store tests will seed the game settings record plus BIS-like and unrelated records. After Clear Settings, tests will confirm that the game record is removed or reset and every non-game record remains. The tests will not encode a complete list of BIS keys because the game must remain independent of that key set.

## Risks / Trade-offs

- Existing users may expect Clear Settings to sign out BIS wallets. The button will now reset only game preferences, matching its label and scoped contract.
- A later explicit BIS-reset workflow needs its own label and confirmation policy. This change retains the public API but does not add that workflow.

## Migration Plan

Ship the handler and test changes together. There is no stored-data migration because the change stops deleting BIS state. Rolling back restores the former cross-component reset behavior, but should occur only if a separate approved requirement needs it.
