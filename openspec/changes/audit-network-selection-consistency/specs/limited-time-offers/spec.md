## ADDED Requirements

### Requirement: LTO contracts are network-scoped end to end
LTO creation, claim, refund, recovery, filtering, locking, and cleanup SHALL use the Player/Game Wallets' shared selected test network and its verified operator. Contract records and attempt markers from another network SHALL not be listed, resumed, funded, claimed, refunded, or treated as outstanding.

#### Scenario: Mutinynet LTO recovery
- **WHEN** a Mutinynet LTO operation is resumed after reload
- **THEN** only its Mutinynet contract record, lock, and operator route are used
- **AND** a Signet LTO record cannot block or complete that operation
