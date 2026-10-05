# Spec Delta

## ADDED Requirements

### Requirement: Transfers use shared wallet network policy
Account Transfer SHALL obtain network, operator and fee capability decisions from wallet-network-configuration before review and before submission. Transfer directions that are verified only for zero-fee terms SHALL accept normalized zero-equivalent fees and SHALL block only malformed, unverifiable, unsupported, or nonzero terms. Direction, inputs, outputs, assets, balances, and policy SHALL remain bound into the reviewed quote and revalidated before confirmation.

#### Scenario: Mutinynet decimal zero fees
- **WHEN** the active Mutinynet operator reports transfer intent fees as decimal zero values and the transfer route otherwise satisfies eligibility
- **THEN** Review Transfer can obtain a normal zero-fee review instead of showing an operator-fee-schedule error

#### Scenario: Transfer fee becomes unsupported after review
- **WHEN** the active operator policy changes from supported zero-equivalent fees to unsupported terms after review
- **THEN** Confirm Transfer rejects the stale quote, performs no submission, and requires a fresh review

#### Scenario: Policy unavailable for transfer
- **WHEN** the active operator policy cannot be read or verified for Account Transfer
- **THEN** Account Transfer reports policy verification unavailable without creating or clearing a transfer operation

