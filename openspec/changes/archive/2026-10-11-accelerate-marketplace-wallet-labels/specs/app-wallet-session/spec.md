## ADDED Requirements

### Requirement: Address projection before ownership initialization
BIS SHALL prepare role-scoped addresses from the same validated identity, network, and operator configuration used by the retained role wallet, without waiting for ownership initialization or creating another SDK wallet. Projected addresses SHALL equal that wallet's addresses. Cancellation and generation replacement SHALL prevent obsolete publication. Projection SHALL NOT substitute for live balance, ownership, or transaction checks.

#### Scenario: Slow wallet initialization
- **WHEN** operator configuration is valid but wallet ownership initialization is delayed
- **THEN** address preparation may complete first using the SDK's address primitives
- **AND** compatible consumers still share one role wallet initialization

#### Scenario: Invalid configuration or obsolete session
- **WHEN** operator configuration is unavailable or mismatched, or the role is retired, replaced, cancelled, or disposed
- **THEN** address preparation fails or suppresses obsolete completion
- **AND** no address from another generation or network is presented

#### Scenario: Normal wallet equivalence
- **WHEN** the same identity and validated operator configuration complete normal wallet initialization
- **THEN** its Arkade and boarding addresses exactly match the projected addresses
