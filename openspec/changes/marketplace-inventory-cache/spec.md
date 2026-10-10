# Spec Delta

## ADDED Requirements

### Requirement: BIS owns role-scoped inventory freshness
Player and Game Wallet inventory SHALL be prepared through one BIS-owned lifecycle keyed by role, profile, network, and data kind, with complete-success-only reuse.

#### Scenario: Account Assets and Marketplace share a read
- **WHEN** both surfaces request the same wallet inventory during its valid freshness window
- **THEN** they reuse one compatible result or in-flight read without duplicate provider work

#### Scenario: Wallet or network changes
- **WHEN** the account, role, network, logout, reset, mutation, or fresh chain evidence changes
- **THEN** the affected inventory entry is invalidated without clearing unrelated wallet inventory

### Requirement: Inventory states distinguish unavailable from empty
Marketplace SHALL preserve loading, ready, empty, and unavailable states independently for Player and Game Wallet inventory.

#### Scenario: Selected wallet read fails
- **WHEN** the selected wallet inventory read is unavailable
- **THEN** Marketplace shows an unavailable state and retry guidance rather than an empty catalog

#### Scenario: One wallet finishes first
- **WHEN** one wallet read completes while the other remains pending
- **THEN** the completed wallet can be viewed without suppressing or duplicating the other read
