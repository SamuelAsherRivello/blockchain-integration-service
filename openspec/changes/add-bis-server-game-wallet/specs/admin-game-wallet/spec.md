# Spec Delta

## ADDED Requirements

### Requirement: Server source replaces local signer controls
In server mode Admin SHALL use the same configured identity/source as Runtime and Marketplace. Existing local import, storage and logout rules SHALL apply in manual mode. Server mode SHALL show public details without browser import/logout controls and leave stored browser wallets untouched and inactive.

#### Scenario: Server selected across consumers
- **WHEN** compatible consumers share backend/game/network configuration
- **THEN** they identify the same server wallet without importing its mnemonic
- **AND** player logout does not deselect or delete the server identity

#### Scenario: Existing Admin actions
- **WHEN** Admin invokes a current Game Wallet action through a server signer
- **THEN** the existing browser workflow and evidence rules remain effective with remote signatures

### Requirement: Manual Admin access when server is not findable
When no running server can be reached, Admin SHALL offer the current Game Wallet Login and manual tools for explicitly selected local identities. Such fallback SHALL NOT transfer unresolved server operations to a local identity.

#### Scenario: Server stopped after configuration
- **WHEN** the configured signer endpoint is unreachable after the bounded connection attempt
- **THEN** Admin offers manual Game Wallet Login and existing manual operation behavior
- **AND** unresolved server operations keep their original identity and recovery source
