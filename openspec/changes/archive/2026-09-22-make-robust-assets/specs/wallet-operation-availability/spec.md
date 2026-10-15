# Spec Delta

## ADDED Requirements

### Requirement: Transient controller state cannot override durable spendability
Wallet operation availability SHALL be computed from the current active account, active network/operator, durable operation records, durable reservations, and fresh wallet evidence. Completed in-memory promises, busy flags, skipped-session results, or unavailable reads SHALL NOT continue disabling unrelated future operations after they settle. Stale transient state SHALL be invalidated on account, network, wallet, generation, or operation-identity change.

#### Scenario: Stale unavailable result is not reused
- **WHEN** an operation reports unavailable because a transient prerequisite was missing and that attempt has settled
- **THEN** a later operation with a new identity computes availability from fresh durable and wallet state
- **AND** it does not return the old unavailable result from memory alone

#### Scenario: Durable reservation still wins
- **WHEN** a previous operation may have submitted and remains unresolved
- **THEN** its durable reservations continue to block conflicting spendability even if transient busy state has cleared

#### Scenario: Network-scoped legacy account comparison
- **WHEN** a network-scoped store loads an older account record without an explicit network value
- **THEN** availability checks MAY treat that account as belonging to the selected store's active network for comparison
- **AND** an explicit different network on any record still prevents cross-network reads, reservations, or submissions
