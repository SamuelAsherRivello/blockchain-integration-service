# Spec Delta

## Purpose

Define how BIS qualifies independent hosted Game Wallet identities and signing behavior across supported test networks.

## ADDED Requirements

### Requirement: Network-scoped priority wallet pools
bis-server SHALL support three private mnemonic slots for each of Signet and Mutinynet. New selection SHALL use the first valid candidate in 01/02/03 order satisfying fresh, operation-appropriate balance requirements. Confirmed on-chain Bitcoin and Arkade-spendable sats SHALL remain distinct. Missing, malformed, duplicate, insufficient or unknown-balance candidates SHALL NOT qualify. Identity-only selection MAY use an unfunded wallet for receiving. Signing and recovery SHALL resolve the original selected profile without balance-driven replacement or cross-network fallback.

#### Scenario: Candidate lacks Arkade-spendable funds
- **WHEN** slot 01 has confirmed Bitcoin but insufficient available Arkade sats for the requested requirement and slot 02 satisfies it
- **THEN** new selection uses slot 02 within that same network
- **AND** existing slot-01 operations remain bound to slot 01

#### Scenario: Unreachable balance provider
- **WHEN** a candidate balance query fails or reaches its bounded timeout
- **THEN** it does not qualify and the next candidate may be evaluated within the overall deadline
- **AND** no cached balance or replacement signing identity is used as proof of eligibility

#### Scenario: Both network pools are independently configured
- **WHEN** Signet and Mutinynet hosted identities are configured
- **THEN** each network selects only from its own ordered private pool and state namespace
- **AND** a missing or invalid pool for one network does not select an identity from the other
