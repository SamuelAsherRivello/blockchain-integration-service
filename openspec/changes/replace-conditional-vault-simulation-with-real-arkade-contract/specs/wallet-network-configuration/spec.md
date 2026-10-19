# Spec Delta

## ADDED Requirements

### Requirement: Network selector governs sandbox operations
The title-bar network selector SHALL be the single source of truth for all Prototype Sandbox operations, including wallet selection, Arkade operator connection, contract construction, address derivation, explorer links, and error reporting.

#### Scenario: Network changes before execution
- **WHEN** the user changes the selected network before running a demo
- **THEN** the next operation uses only that network's configured wallet and operator and does not reuse incompatible persisted HD state

#### Scenario: Network mismatch
- **WHEN** a wallet, operator, contract artifact, or provider response belongs to a different network than the selector
- **THEN** the operation fails safely before reporting success and explains the network mismatch

