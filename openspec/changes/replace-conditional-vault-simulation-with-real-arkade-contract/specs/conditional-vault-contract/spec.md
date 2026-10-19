# Spec Delta

## Purpose

Provide a small but genuine Arkade contract demonstration whose funding, state transitions, inspection, and claim are enforced by a real network-backed contract rather than browser-local state.

## ADDED Requirements

### Requirement: Real conditional vault contract
The system SHALL expose a Conditional Vault contract with a creator, a fixed 100-sat value, and a progress state that can reach three only through valid contract transitions. The contract SHALL be represented by an actual Arkade contract artifact and SHALL NOT use browser-local state as the source of truth.

#### Scenario: Create and fund vault
- **WHEN** the creator submits Create for an unused vault ID with sufficient funds
- **THEN** the wallet funds a real contract-derived Arkade output and the result includes verifiable contract identity and funding evidence

#### Scenario: Duplicate vault ID
- **WHEN** Create is submitted for an already-used vault ID
- **THEN** the operation fails without creating or funding another contract and reports the vault ID clearly

### Requirement: Contract-enforced progress
The system SHALL allow Increment only through a valid Arkade contract spend that advances the current vault state by one and SHALL reject increments after the terminal state or from an invalid prior state.

#### Scenario: Advance progress
- **WHEN** a valid funded vault below progress three is incremented
- **THEN** the contract produces the next valid state and the returned evidence identifies the new progress

#### Scenario: Invalid or terminal increment
- **WHEN** Increment targets a missing, expired, already claimed, or terminal vault
- **THEN** no funds are claimed or fabricated state is persisted and the result explains the ineligible state

### Requirement: Public contract status
The system SHALL allow Check to inspect a vault without a mnemonic or fund movement and SHALL report contract identity, funding state, progress, claim eligibility, expiry or terminal state, and network.

#### Scenario: Public status check
- **WHEN** any user invokes Check for a known vault
- **THEN** the system returns network-backed status without requiring a private wallet

#### Scenario: Unknown vault check
- **WHEN** Check targets a vault with no verifiable contract output
- **THEN** it reports an explicit unknown or unavailable status rather than a zeroed local record

### Requirement: Creator claim
The system SHALL allow Claim only when the contract state has reached progress three and SHALL return the contract value to the creator through a real Arkade spend.

#### Scenario: Successful claim
- **WHEN** the creator claims a funded vault at progress three
- **THEN** the contract spend succeeds, returns the eligible value minus applicable network fees, and marks the vault terminal

#### Scenario: Ineligible or repeated claim
- **WHEN** Claim targets a vault below progress three, expired, unknown, or already claimed
- **THEN** no duplicate payout occurs and the result reports the actual contract state

### Requirement: Network-selected contract execution
Every Conditional Vault operation SHALL use the network selected in the title bar, including operator, wallet profile, contract encoding, explorer metadata, and acceptance checks. The same flow SHALL support Signet and MutinyNet.

#### Scenario: Signet execution
- **WHEN** the title-bar network is Signet
- **THEN** all four operations use the existing Signet test-wallet flow and Signet Arkade operator

#### Scenario: MutinyNet execution
- **WHEN** the title-bar network is MutinyNet
- **THEN** all four operations use the existing MutinyNet test-wallet flow and MutinyNet Arkade operator

### Requirement: Contract source and artifact presentation
The Create demo SHALL show readable contract-builder source, generated script or disassembly, and the compiled Arkade artifact. Increment, Check, and Claim SHALL show only their integration demo source. Displayed source SHALL be labeled according to whether it is executable source, generated script, or compiled output.

#### Scenario: Inspect Create contract
- **WHEN** the user selects the Smart Contract tab on Create
- **THEN** the page shows the readable contract definition, generated script representation, and compiled artifact with their relationship explained

#### Scenario: Inspect transition demos
- **WHEN** the user opens Increment, Check, or Claim
- **THEN** the page shows the demo integration source without presenting pseudocode as an executable contract artifact

