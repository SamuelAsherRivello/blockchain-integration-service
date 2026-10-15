## ADDED Requirements

### Requirement: Superseded Game Wallet reads cannot publish
Game Wallet refresh results SHALL affect public selection, readiness, diagnostics, addresses, and balances only while their initiating refresh and wallet scope remain current. This SHALL apply equally to successful reads, empty selections, storage failures, role conflicts, and network mismatches. An obsolete result SHALL NOT disable or replace a newer valid selection.

#### Scenario: Old storage result reports a role conflict
- **WHEN** refresh A waits for storage, refresh B establishes a ready distinct Game Wallet, and A later returns the Player Wallet identity
- **THEN** B remains selected and ready
- **AND** A cannot publish a role conflict or change the selection version

#### Scenario: Old storage result reports a network mismatch
- **WHEN** an obsolete refresh returns a wallet on a different network after a current refresh has succeeded
- **THEN** the current wallet and its public state remain unchanged

#### Scenario: Current refresh reports a real conflict
- **WHEN** the current storage result matches the active Player Wallet or belongs to another network
- **THEN** the Game Wallet remains unavailable with the accurate conflict category
- **AND** no conflicting identity becomes active

#### Scenario: Logout or disposal precedes read completion
- **WHEN** storage, address, balance, or observation work completes after logout, disposal, or wallet-scope replacement
- **THEN** it cannot restore that wallet or publish obsolete data into the replacement session
