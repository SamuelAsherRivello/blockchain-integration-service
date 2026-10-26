# Spec Delta

## Purpose

Execute complete game-wallet mint and delivery operations through bis-server with durable progress, authorization and evidence-based recovery across client and server interruptions.

## ADDED Requirements

### Requirement: Complete server-owned mint and delivery
For advertised operation capabilities, bis-server SHALL own preparation, input selection, signing, submission and reconciliation. Clients SHALL receive safe progress and verified receipts without the game mnemonic. The same operation contract SHALL work locally and through the existing Vercel deployment.

#### Scenario: Server operation requested
- **WHEN** an authorized client requests a supported mint or delivery operation
- **THEN** bis-server performs the full wallet workflow and reports its evidence-backed outcome
- **AND** the browser handles presentation and gameplay effects rather than preparing the server transaction

### Requirement: Exact request idempotency
bis-server SHALL persist normalized operation intent before signing and bind its ID to actor, game, wallet, network, recipient and payload. Exact retries SHALL join or return the original operation. Changed payloads under the same ID SHALL fail without a new submission.

#### Scenario: Duplicate request across instances
- **WHEN** multiple instances receive the same authorized intent
- **THEN** one logical operation owns the inputs and duplicates receive its status or result
- **AND** duplicate minting or delivery does not occur

### Requirement: Durable recovery of uncertain outcomes
Operation stages, input reservations and transaction evidence SHALL survive server restart and browser closure. Unknown outcomes SHALL be reconciled through authoritative network evidence before conflicting reuse. Later authorized requests SHALL resume recovery; no uninterrupted background execution is promised.

#### Scenario: Lost mint acknowledgment
- **WHEN** mint submission may have succeeded but its response was lost
- **THEN** recovery checks that original mint and preserves its input reservations
- **AND** it does not issue another asset merely to retry delivery

#### Scenario: Browser returns after restart
- **WHEN** a client resumes an operation after closing and the server has restarted
- **THEN** it receives the durable original status and evidence-based recovery result
- **AND** lease expiry or timeout alone does not prove transaction failure

### Requirement: Bounded operation authorization
Writes SHALL require verifiable grants bound to game, network, actor, recipient, permitted item/operation and quota. Intent creation and quota consumption SHALL be atomic. Owner credentials SHALL remain private. Client gameplay claims SHALL NOT establish verified reward eligibility.

#### Scenario: Grant misuse
- **WHEN** a client changes the recipient/item, exceeds quota or presents an expired grant
- **THEN** the service rejects the request before signing
- **AND** exact retries do not consume another quota allocation

### Requirement: Compatible source and protocol recovery
Clients SHALL select full server operations only when advertised and preserve the original protocol/source for pending work. Unsupported server operations SHALL report unavailable without replay through a browser wallet. Milestone 1 manual fallback SHALL remain available for independent new work when no server is findable.

#### Scenario: Capability changes during recovery
- **WHEN** a client refreshes after a deployment that changes capabilities
- **THEN** original pending operations retain their source, identity, network and recovery protocol
- **AND** no capability change silently changes the operation's signer or fee payer
