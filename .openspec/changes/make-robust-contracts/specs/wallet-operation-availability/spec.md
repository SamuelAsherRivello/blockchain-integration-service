# Spec Delta

## MODIFIED Requirements

### Requirement: Durable input reservations
The system SHALL maintain multiple account, network, and operator-scoped operations, reserving every input of unresolved operations before network submission. It SHALL preserve legacy records during migration and prevent conflicting submissions across cooperating same-origin contexts. Incomplete or corrupt unresolved input records SHALL block spending with an explicit reason. Completion SHALL release only the corresponding operation's reservations, and a record from another network SHALL never make inputs appear spendable or block an unrelated active network without an explicit migration rule. Durable contract reservations SHALL include or be addressable by their network scope and SHALL use a network-specific storage boundary.

#### Scenario: Disjoint operations
- **WHEN** one same-network transfer is pending and verified eligible inputs exist outside all same-network reservations
- **THEN** a new explicitly confirmed operation can use only those inputs without replacing the old record

#### Scenario: Cross-network records remain isolated
- **WHEN** an unresolved Signet record exists and the active account has switched to Mutinynet
- **THEN** the Signet record remains recoverable in its original scope while Mutinynet reads and reservations use only Mutinynet inputs
- **AND** the reservation store cannot cause the Signet record to block or release Mutinynet inputs

#### Scenario: Competing confirmations
- **WHEN** two contexts confirm operations in the same account and network scope and select the same input
- **THEN** only one reserves and submits it; the other requires fresh review

#### Scenario: Migration cannot establish inputs
- **WHEN** a legacy unresolved operation has unknown inputs or migration cannot persist
- **THEN** no new spending occurs and the original recovery record remains intact

#### Scenario: Reconstruct legacy reservations
- **WHEN** a pending operation lacks a complete input set
- **THEN** the system attempts read-only reconstruction from supported evidence and persists verified reservations before enabling independent spending
- **AND** while uncertainty remains it explains the specific spending hold and keeps receiving, inspection and recovery available without signing or resubmitting

### Requirement: Account-wide network and wallet isolation
Every Player Wallet read, quote, mutation, recovery check, and transaction submission SHALL use the active Player Account's selected network and its corresponding operator. If a provider reports another network, the operation SHALL fail before signing or submission with a safe actionable reason. A configured Game Wallet SHALL have the same network as the active Player Account; a missing, stale, or mismatched Game Wallet SHALL remain unavailable and SHALL NOT be read, funded, observed, or used for payments or asset mutations. No account's inputs, journals, reservations, balances, transaction results, contract recovery documents, or contract-related coordination locks SHALL be reused across networks.

#### Scenario: Player operations follow the selected network
- **WHEN** the Player Account is selected on Signet or Mutinynet
- **THEN** balances, addresses, funding, sends, transfers, contracts, assets, and recovery/reconciliation all use that account's corresponding operator and reject a reported network mismatch before submission

#### Scenario: Game Wallet must match the Player Account
- **WHEN** a saved Game Wallet belongs to a different network than the active Player Account
- **THEN** the Game Wallet is not loaded or used, and no payment, transfer, balance read, address read, or asset mutation crosses the network boundary

#### Scenario: Network selection changes
- **WHEN** the Player Account network changes while a Game Wallet or wallet operation from the prior network exists
- **THEN** the prior network's state remains isolated and recoverable while the newly selected network starts fresh reads and cannot reuse prior-network inputs, contract recovery, reservations, or coordination locks
