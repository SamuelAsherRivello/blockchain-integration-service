# Spec Delta

## MODIFIED Requirements

### Requirement: BIS provides a game-facing composition facade

The public BIS package SHALL export `BisService` implementing `IBis` as the lifecycle-owning game facade and SHALL route verified game continuation and reward results through its `IBisGame`. The facade SHALL expose a provider-neutral force-reset operation for an explicitly selected BIS-reset workflow. Clear Settings SHALL not imply, invoke, or report on that operation. The operation SHALL not require Arkade-specific types, wallet secrets, or BIS-internal imports.

#### Scenario: A host receipt is inapplicable
- **WHEN** the host returns `not-applicable` or `already-applied`
- **THEN** BIS SHALL treat the confirmed financial operation as unchanged
- **AND** it SHALL not retry, reverse, recharge, mint, or otherwise alter the financial result

#### Scenario: A game invokes the public reset
- **WHEN** a consuming game calls the facade's force-reset operation from its explicit BIS-reset workflow
- **THEN** the call SHALL reset BIS-owned player-wallet, game-wallet, workflow, journal, UI, and session state according to the game-state-reset contract
- **AND** the call surface SHALL remain provider-neutral and free of recovery material

#### Scenario: A game clears settings
- **WHEN** a consuming game executes Clear Settings
- **THEN** it SHALL not invoke the facade's force-reset operation
- **AND** BIS SHALL retain its local player-wallet, game-wallet, workflow, journal, UI, and session state

#### Scenario: The facade is disposed
- **WHEN** a game disposes its BIS facade
- **THEN** BIS SHALL detach its UI, workflow listeners and host delivery
- **AND** submitted financial operations SHALL remain truthful and recoverable under the existing disposal policy, without a remote cancellation claim
