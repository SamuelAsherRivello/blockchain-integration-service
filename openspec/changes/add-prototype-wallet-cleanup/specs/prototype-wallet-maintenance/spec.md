# Spec Delta

## Purpose

Give sandbox users a manual maintenance action that resolves supported pending wallet work and recovers eligible outputs while preserving their identities, assets and history.

## ADDED Requirements

### Requirement: Manual network-specific cleanup
Setup SHALL offer `Clean Wallet 2` in both network profiles. Each action SHALL capture that profile's submitted mnemonic and network. Cleanup SHALL run only on explicit activation and remain available after any result.

#### Scenario: Clean either profile
- **WHEN** the user activates either profile's button
- **THEN** only that profile's submitted Wallet 2 identity is maintained, independently of the page's selected demo network
- **AND** empty or invalid credentials produce a concise error without clearing saved values

### Requirement: Minimal truthful feedback
The action SHALL show progress followed by success, no-work success or a concise error. It SHALL NOT add a report screen or claim cleanup succeeded while known pending work remains unresolved.

#### Scenario: Uncertain result
- **WHEN** the network cannot establish an operation's outcome
- **THEN** the action reports incomplete cleanup, retains the operation and remains available for a later reconciliation attempt

### Requirement: Finish original pending work
Cleanup SHALL use supported exact-operation continuation for interrupted sends and authoritative receipts to reconcile tracked settlements. It SHALL NOT create replacement payments, cancel uncertain submissions or release their protected inputs based on age, missing acknowledgement or timeout alone.

#### Scenario: Interrupted send
- **WHEN** an original pending send can be finalized by the SDK
- **THEN** cleanup finishes that same transaction, verifies the resulting state, and preserves its history

#### Scenario: Settlement outcome unknown
- **WHEN** a recorded settlement cannot be matched to verified completion
- **THEN** its record remains pending and no competing recovery is submitted

### Requirement: Safe owned-output recovery
After resolving pending work, cleanup SHALL recover eligible owned outputs to the same wallet through real network operations. It SHALL preserve every asset ID and quantity and retain the expected sats after verified SDK fees. It SHALL leave contract-restricted outputs untouched.

#### Scenario: Recover assets with sats
- **WHEN** eligible outputs carry assets and have enough net value for SDK recovery
- **THEN** the action verifies the recovery's owned outputs, exact retained value and unchanged asset inventory before reporting success

#### Scenario: Nothing eligible
- **WHEN** there is no pending work or eligible recovery
- **THEN** the action reports that no cleanup is needed without issuing a transaction

### Requirement: Durable operation and identity preservation
Cleanup and settlement tracking SHALL retain public operation evidence across reloads, scope it to network and full wallet identity, and exclude secrets. Terminal records SHALL remain as history. Existing wallet databases, credentials and contract records SHALL NOT be reset or deleted.

#### Scenario: Reload after a lost response
- **WHEN** cleanup is clicked again after an interrupted settlement
- **THEN** it reconciles the original stored attempt rather than submitting another recovery

### Requirement: Serialized wallet mutations
Only one cleanup or sandbox wallet mutation SHALL operate on the same identity/network at a time across tabs. Independent wallets/networks SHALL remain usable.

#### Scenario: Double activation
- **WHEN** another cleanup or demo mutation already owns the same wallet scope
- **THEN** the second action does not submit a transaction and offers a concise busy result

### Requirement: Real acceptance evidence
Verification SHALL distinguish deterministic UI/policy tests from live network evidence. Live checks SHALL cover both networks, exact-operation pending-send continuation and preserved assets/value during recovery, without recording recovery phrases or signed recovery material.

#### Scenario: Financial acceptance
- **WHEN** maintenance is reported as live-verified
- **THEN** the evidence includes attributable network receipts and before/after asset and value checks
