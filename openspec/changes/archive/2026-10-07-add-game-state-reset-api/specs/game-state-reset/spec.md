## Purpose

Provide a single forceful, provider-neutral reset contract that a consuming game can invoke from its own Clear All Settings action to remove BIS-owned local state without touching remote wallet funds.

## ADDED Requirements

### Requirement: Game-triggered reset clears all BIS-owned local state

The public game integration SHALL expose a reset operation that requires no confirmation or player-facing acknowledgement and SHALL clear the active player wallet session, selected game wallet session, BIS-owned local wallet/account material, BIS operation journals and recovery records, transient workflow state, subscriptions, mounted BIS UI state, and game-facing session state owned by BIS. If a scope is absent, the operation SHALL still complete successfully.

#### Scenario: Reset with both wallets and active gameplay state
- **WHEN** the game invokes the reset operation from Clear All Settings
- **THEN** the player wallet and game wallet are both logged out/deselected
- **AND** BIS-owned local records, pending presentation state, listeners, and session state are cleared
- **AND** the game can begin a fresh guest session without restoring the prior identities

#### Scenario: Reset with no saved wallet
- **WHEN** the game invokes the reset operation before either wallet exists
- **THEN** the operation completes without error
- **AND** no wallet or account is created as a side effect

### Requirement: Reset is forceful but truthful about network operations

The reset SHALL not request, infer, or claim cancellation of a submitted or broadcast network operation. It SHALL remove local recovery information and invalidate local callers even when a remote operation may later settle, and SHALL return or publish only a provider-neutral completion or failure result without recovery material or transaction secrets.

#### Scenario: Submitted operation is still unresolved
- **WHEN** reset runs while a previously submitted payment, transfer, send, mint, burn, continuation, or receipt remains unresolved
- **THEN** local BIS state is cleared without resubmitting or reversing that operation
- **AND** the result states completion only for local cleanup, not remote cancellation

### Requirement: Reset is idempotent and blocks stale resurrection

The reset SHALL serialize with other BIS-owned local mutations, tolerate repeated calls, invalidate in-flight work, and prevent late callbacks or old same-origin contexts from restoring cleared identities, journals, UI, or game session state.

#### Scenario: Repeated reset calls
- **WHEN** the game invokes reset more than once concurrently or after a successful reset
- **THEN** at most one cleanup sequence runs for the affected state
- **AND** every caller receives the same successful local-cleanup outcome or the same truthful failure

#### Scenario: Late callback after reset
- **WHEN** a pre-reset asynchronous read or operation completes after reset
- **THEN** its callback cannot repopulate cleared state, reopen BIS UI, emit a stale game event, or reactivate either wallet

### Requirement: Reset failures are observable without partial success claims

The reset SHALL report a cleanup failure if BIS cannot confirm the required local state was cleared. It SHALL not silently continue as if reset completed, and a subsequent call SHALL be able to retry after the failed work has been reconciled.

#### Scenario: Local cleanup cannot be confirmed
- **WHEN** storage clearing, wallet teardown, or session invalidation fails
- **THEN** the reset rejects or returns a provider-neutral failure with no secrets
- **AND** affected state is not presented as fully reset
- **AND** a later reset can retry without requiring the game to recreate the BIS service first

### Requirement: Game-owned settings remain the host's responsibility

The consuming game SHALL clear its own gameplay settings, checkpoints, preferences, and non-BIS session data in its Clear All Settings handler. BIS reset SHALL not reach into unrelated host storage or silently alter game-owned state.

#### Scenario: Clear All Settings coordinates both scopes
- **WHEN** the game executes Clear All Settings
- **THEN** game-owned settings are cleared by the game and BIS-owned state is cleared through the public reset operation
- **AND** unrelated browser-origin data remains unchanged
