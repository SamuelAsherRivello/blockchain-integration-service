## Purpose

Ensure every BIS and Admin wallet operation keeps the selected test network as an immutable, verified security boundary.

## ADDED Requirements

### Requirement: Every wallet adapter uses its selected network
For an active account or Game Wallet, BIS SHALL derive operator, indexer, explorer, address-validation, and event-subscription routes from that wallet's selected test network. Before a route is treated as healthy, the operator SHALL report that same network. A missing, mismatched, or failed proof SHALL return a sanitized unavailable result and SHALL NOT fall back to Signet.

#### Scenario: Mutinynet operation
- **WHEN** a Mutinynet Player or Game Wallet performs any supported read, preparation, reconciliation, or mutation
- **THEN** every provider and indexer used by that operation targets Mutinynet
- **AND** no Signet result is presented as Mutinynet data

### Requirement: Network scopes durable and asynchronous coordination
BIS SHALL scope operation journals, reservations, recovery records, locks, contract state, event observers, and delayed completion checks by test network as well as identity. A result captured for a different network SHALL not publish, mutate local state, or authorize a new operation.

#### Scenario: Network-isolated retry
- **WHEN** matching profile IDs have incomplete operations on Signet and Mutinynet
- **THEN** a retry or recovery on either network reads and changes only that network's operation state

### Requirement: Audit coverage remains exhaustive
The production source SHALL have regression coverage for every Arkade adapter and Admin callback that accepts an account, wallet address, contract record, or operation record. The coverage SHALL exercise Signet and Mutinynet routing and identify intentional unsupported behavior truthfully.

#### Scenario: New adapter review
- **WHEN** a wallet-facing adapter is added or changed
- **THEN** its tests prove route selection and exact-network rejection before the adapter is accepted as network-neutral
