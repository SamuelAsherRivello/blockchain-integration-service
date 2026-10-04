## MODIFIED Requirements

### Requirement: BIS provides a game-facing composition facade

The public BIS package SHALL export `BisGameServices` as the lifecycle-owning game facade and SHALL route verified game continuation and reward results through its `BisHostGame`. The facade SHALL also expose a provider-neutral force-reset operation for a consuming game’s Clear All Settings flow; the operation SHALL not require Arkade-specific types, wallet secrets, or BIS-internal imports.

#### Scenario: A host receipt is inapplicable
- **WHEN** the host returns `not-applicable` or `already-applied`
- **THEN** BIS SHALL treat the confirmed financial operation as unchanged
- **AND** it SHALL not retry, reverse, recharge, mint, or otherwise alter the financial result

#### Scenario: A game invokes the public reset
- **WHEN** a consuming game calls the facade’s force-reset operation
- **THEN** the call SHALL reset BIS-owned player-wallet, game-wallet, workflow, journal, UI, and session state according to the game-state-reset contract
- **AND** the call surface SHALL remain provider-neutral and free of recovery material
