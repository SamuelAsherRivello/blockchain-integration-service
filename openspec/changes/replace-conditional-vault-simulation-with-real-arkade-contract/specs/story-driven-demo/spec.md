# Spec Delta

## ADDED Requirements

### Requirement: Conditional Vault demonstration is truthful
The Prototype Sandbox SHALL present Conditional Vault as a simple four-call demonstration backed by real Arkade contract operations. Its console output SHALL show the demo name first, operation results next, and the final success value last, including truthful network and contract evidence.

#### Scenario: Complete demo sequence
- **WHEN** the user runs Create, Increment, Check, and Claim in order
- **THEN** each result reflects the actual network-backed contract state and the final claim returns the creator's eligible value

#### Scenario: Live operation failure
- **WHEN** an operator, wallet, fee, funding, or contract operation fails
- **THEN** the demo reports failure and the sanitized reason without showing a simulated success

### Requirement: Existing test-wallet acceptance
Conditional Vault acceptance SHALL use the repository's existing funded test-wallet flow and SHALL distinguish isolated deterministic tests from live network verification. Recovery phrases and private keys SHALL never be logged or stored in artifacts.

#### Scenario: Funded network acceptance
- **WHEN** acceptance runs against a supported network
- **THEN** it uses the configured test wallet for that network and verifies real Create, Increment, Check, and Claim outcomes

#### Scenario: Missing or insufficient funding
- **WHEN** the configured test wallet cannot fund the contract or pay required fees
- **THEN** acceptance reports an environmental blocker and does not convert it into a passing mock result

