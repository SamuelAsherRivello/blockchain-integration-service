# Spec Delta

## Purpose

Demonstrate how a game can replace an immutable Arkade item asset with a new item version using real wallet operations, recoverable progress, and no smart contract.

## ADDED Requirements

### Requirement: Upgrade demo navigation and framing
The Prototype Sandbox SHALL expose an `Upgrade Asset` demo after the asset-history demos. The page SHALL explain that the operation replaces an existing asset rather than changing its metadata in place, and SHALL distinguish this flow from native asset reissuance.

#### Scenario: Upgrade page is reachable
- **WHEN** the user opens the Prototype Sandbox Assets section
- **THEN** `Upgrade Asset` appears after the private and public asset-history entries
- **AND** its direct route renders the upgrade page with the shared sandbox layout

#### Scenario: Upgrade is distinguished from reissue
- **WHEN** the upgrade page is rendered
- **THEN** its overview states that a replacement asset is issued and the old holding is retired
- **AND** it does not describe the operation as changing an existing asset ID or as Arkade reissuance

### Requirement: Upgrade the asset created by Mint Asset
The demo SHALL use the asset ID recorded by the existing Mint Asset demo as its default source. It SHALL operate through the same mnemonic-backed demo wallet, SHALL issue the replacement to that wallet, and SHALL not require the existing Mint Asset demo to send the source asset to another wallet.

#### Scenario: Minted source is available
- **WHEN** the user previously completes Mint Asset for the selected network and label
- **THEN** Upgrade Asset identifies that asset as the level-one source and enables its action when fresh ownership and funding checks pass

#### Scenario: Minted source is unavailable
- **WHEN** no matching Mint Asset result is recorded or the wallet no longer owns the source quantity
- **THEN** Upgrade Asset remains executable only as a truthful failed attempt and reports that the user must mint or restore the source holding
- **AND** no replacement issuance or burn is submitted

#### Scenario: Same-wallet replacement
- **WHEN** the user executes a valid upgrade
- **THEN** the mnemonic-backed wallet issues one level-two replacement with replacement metadata, verifies that replacement, and burns exactly one unit of the recorded source asset
- **AND** no intermediate `wallet.send()` to a second demo wallet is required

### Requirement: Recoverable upgrade phases
The demo SHALL persist a network- and source-scoped upgrade record before mutation and SHALL bind retries to the same operation identity and source request. A retry SHALL resume or reconcile the recorded phase and SHALL NOT duplicate an issued replacement or burn.

#### Scenario: Interruption after replacement issuance
- **WHEN** the browser or provider disconnects after replacement issuance but before the burn is confirmed
- **THEN** the next execution reuses the recorded replacement and checks its evidence before attempting retirement
- **AND** it does not issue a second replacement for the same operation

#### Scenario: Interruption after source retirement
- **WHEN** the source burn may have crossed submission without a confirmed response
- **THEN** the operation is shown as unresolved or recoverable
- **AND** the demo does not submit another burn or claim completed success from absence alone

#### Scenario: Completed retry
- **WHEN** the same completed upgrade is executed again
- **THEN** the demo returns the recorded result and transaction evidence without another issuance or burn

### Requirement: Truthful upgrade evidence and source
The demo SHALL report source and replacement asset IDs, operation phase, transaction evidence when available, and a final success value based on verified results. The displayed executable source SHALL use exactly the Arrange, Act, and Assert sections and SHALL contain no recovery phrase or fabricated transaction outcome.

#### Scenario: Verified completion output
- **WHEN** replacement issuance and source retirement are both verified
- **THEN** output identifies the old and new assets, the completed migration phases, and `Success: true`

#### Scenario: Failed or unresolved output
- **WHEN** a provider, funding, ownership, or submission result is unavailable or unknown
- **THEN** output contains a safe error or recovery state and `Success: false`
- **AND** it does not display a made-up transaction ID or claim that the item was upgraded
