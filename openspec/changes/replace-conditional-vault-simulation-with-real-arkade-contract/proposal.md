# Proposal

## Why

The Prototype Sandbox currently presents Conditional Vault as a smart-contract demo, but its progress state is browser-local and its contract tab is pseudocode. That creates a misleading gap between the simple teaching flow and the real Arkade behavior the demo claims to show. This change replaces the simulation with a compact, network-backed Arkade contract that remains understandable while being honest and verifiable.

## What Changes

- Replace the local Conditional Vault state machine with a real compiled, stateful Arkade covenant.
- Preserve the four-call teaching flow: Create, Increment, Check, and Claim.
- Make Create fund a real contract-derived Arkade output with the fixed demo amount and initial progress state.
- Make Increment consume the current contract state and produce the next state, with progress enforced by the covenant.
- Make Check read the current contract state without requiring a mnemonic or moving funds.
- Make Claim spend only the completed contract state back to the creator.
- Derive all network-specific contract addresses, identifiers, operator calls, and wallet behavior from the title-bar network selector.
- Support both Signet and MutinyNet using the same contract definition and network-appropriate Arkade configuration.
- Replace the pseudocode contract tab with the actual contract source and compiled-artifact relationship, while keeping the JavaScript/TypeScript integration example separate.
- Give Create Conditional Vault two source tabs: Demo and Smart Contract, with the compiled covenant artifact viewable from the Smart Contract tab; keep Increment, Check, and Claim focused on their Demo source only.
- Make repeated calls and failures truthful: duplicate creation, missing state, invalid transitions, already-claimed contracts, insufficient funds, unavailable operator evidence, and network fees must not be represented as successful local state changes.
- Add deterministic covenant tests and funded acceptance tests for both configured networks, clearly distinguishing UI tests from live contract verification.

## Capabilities

### New Capabilities

- `conditional-vault-contract`: A compiled Arkade covenant with real funding, state transitions, public status reads, and creator claim behavior.

### Modified Capabilities

- `story-driven-demo`: Replace the simulated Conditional Vault behavior with a network-backed four-call contract demo whose behavior follows the selected network.
- `wallet-network-configuration`: Require Conditional Vault to use the active title-bar network consistently for addresses, contract state, operator calls, and acceptance verification.

## Impact

- Affected Prototype Sandbox Conditional Vault UI, contract source/artifact presentation, Arkade integration helpers, network-specific setup, persistence of non-authoritative demo metadata, and verification tooling.
- Requires selecting and integrating a supported Arkade covenant compiler/artifact workflow, likely including a checked-in compiled contract artifact and its reproducible source.
- Requires funded Signet and MutinyNet test-wallet acceptance, operator/network error handling, and documentation that distinguishes Arkade virtual contract execution from later Bitcoin settlement.
- Existing Payments, Assets, Wallets, External Wallet, Boarding, and Limited-Time Offer demos remain unchanged except for shared network-selection utilities.
- No fabricated transaction IDs, browser-local contract truth, or pseudocode presented as executable contract behavior is permitted.
