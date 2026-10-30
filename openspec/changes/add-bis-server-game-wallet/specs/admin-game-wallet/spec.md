# Spec Delta

## ADDED Requirements

### Requirement: Network-selected Local and Server Admin controls
On Signet Server, Admin SHALL use the same configured identity/source as Runtime and Marketplace and show public details without browser Game Wallet import/logout controls. Stored browser wallets SHALL remain untouched and inactive. Mutinynet Local SHALL preserve existing browser Game Wallet create/restore/login, storage, address/copy/loading and logout behavior without a BIS service or probe. This release SHALL expose no mode toggle.

#### Scenario: Server selected across consumers
- **WHEN** compatible consumers share backend/game/network configuration
- **THEN** they identify the same server wallet without importing its mnemonic
- **AND** player logout does not deselect or delete the server identity

#### Scenario: Existing Admin actions
- **WHEN** Admin invokes a current Game Wallet action through a server signer
- **THEN** the existing browser workflow and evidence rules remain effective with remote signatures

### Requirement: Signet outage retains Server and original authority
When the Signet signer cannot be reached, Admin SHALL retain Server, report the actual connection health and offer Retry. It SHALL NOT expose Local Game Wallet login or switch an unresolved operation to another wallet. Mutinynet Local actions SHALL remain independent of BIS server availability.

#### Scenario: Server stopped after configuration
- **WHEN** the configured signer endpoint is unreachable after the bounded connection attempt
- **THEN** Admin retains Server, displays unavailable connection health and Retry, and does not offer Local Game Wallet login
- **AND** unresolved server operations keep their original identity and recovery source

#### Scenario: Mutinynet without any BIS service
- **WHEN** Admin selects Mutinynet while the BIS service is stopped or unreachable
- **THEN** Local Game Wallet create/restore/login and all enabled applicable local actions remain available
- **AND** no BIS probe or source switch occurs
