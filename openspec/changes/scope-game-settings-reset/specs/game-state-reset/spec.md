# Spec Delta

## MODIFIED Requirements

### Requirement: Game-triggered reset clears all BIS-owned local state

The public game integration SHALL expose an explicit reset operation that requires no confirmation or player-facing acknowledgement and SHALL clear the active player wallet session, selected game wallet session, BIS-owned local wallet/account material, BIS operation journals and recovery records, transient workflow state, subscriptions, mounted BIS UI state, and game-facing session state owned by BIS. The game SHALL invoke this operation only for a separately named BIS-reset workflow, not from Clear Settings. If a scope is absent, the operation SHALL still complete successfully.

#### Scenario: Reset with both wallets and active gameplay state
- **WHEN** the game invokes the explicit BIS reset operation
- **THEN** the player wallet and game wallet are both logged out/deselected
- **AND** BIS-owned local records, pending presentation state, listeners, and session state are cleared
- **AND** the game can begin a fresh guest session without restoring the prior identities

#### Scenario: Reset with no saved wallet
- **WHEN** the game invokes the explicit BIS reset operation before either wallet exists
- **THEN** the operation completes without error
- **AND** no wallet or account is created as a side effect

### Requirement: Game-owned settings remain the host's responsibility

The consuming game SHALL clear its own gameplay settings, checkpoints, preferences, and non-BIS session data in its Clear Settings handler. Clear Settings SHALL not invoke the BIS reset operation, inspect BIS key names, enumerate browser storage, or remove data outside the game settings store. BIS reset SHALL not reach into unrelated host storage or silently alter game-owned state.

#### Scenario: Clear All Settings coordinates both scopes
- **WHEN** the user executes Clear Settings while BIS local state and unrelated same-origin records exist
- **THEN** the game clears its own settings, checkpoints, preferences, and non-BIS session data through its settings-store boundary
- **AND** BIS wallets, journals, UI/session state, and browser records remain unchanged
- **AND** unrelated same-origin records remain unchanged

#### Scenario: Explicit BIS reset remains separate
- **WHEN** the game invokes the public BIS reset operation outside Clear Settings
- **THEN** BIS-owned state is cleared according to this specification
- **AND** game-owned settings remain unchanged unless the game separately resets them
