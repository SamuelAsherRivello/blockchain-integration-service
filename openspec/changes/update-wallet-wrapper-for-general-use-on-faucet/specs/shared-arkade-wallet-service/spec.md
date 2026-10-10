# Spec Delta

## Purpose

Provide one consumer-neutral wallet boundary for Arkade reads, onboarding, settlement, and recovery so browser BIS wallets and the server-backed faucet observe the same verified financial state. The capability keeps consumer-specific storage, locking, and presentation outside the shared financial behavior.

## ADDED Requirements

### Requirement: Shared wallet consumers use one scoped financial boundary
The system SHALL provide the same wallet behavior to Player Wallet, Game Wallet, and Faucet consumers while binding every read and mutation to one account, network, operator, and wallet role.

#### Scenario: Faucet uses the shared boundary
- **WHEN** the faucet reads addresses, balance, history, or onboarding state
- **THEN** it uses the same scoped financial behavior as BIS wallets and does not construct a separate incompatible onboarding path

#### Scenario: Scope changes during an operation
- **WHEN** the account, network, operator, or wallet role changes before submission
- **THEN** the operation is rejected or cancelled before signing and cannot use the replacement scope

### Requirement: Shared onboarding preserves exact settlement semantics
The system SHALL select only eligible confirmed inputs, preserve the exact planned inputs and outputs through submission, validate current operator policy before mutation, and complete only after fresh evidence proves spendable Arkade funds.

#### Scenario: Confirmed boarding funds are available
- **WHEN** a scoped wallet has confirmed eligible boarding funds and supported operator policy
- **THEN** onboarding prepares and submits the exact settlement plan without silently changing its input set or amounts

#### Scenario: Quote succeeds but settlement fails
- **WHEN** a quote or preparation succeeds but the operator rejects commitment construction
- **THEN** onboarding remains incomplete, preserves the failure category, and does not report the funds as spendable

### Requirement: Shared consumers expose durable onboarding progress
The system SHALL expose attributable onboarding progress, known public transaction identifiers, and reconciliation state to each consumer without treating registration, a promise result, or an aggregate balance as completion evidence.

#### Scenario: Submission has no transaction identifier
- **WHEN** registration or signing begins but no commitment or Arkade transaction is known
- **THEN** the consumer reports the actual pending stage and does not create an invented transaction link or success state

#### Scenario: Completion evidence becomes available
- **WHEN** fresh wallet and transaction evidence proves the target Arkade output is spendable
- **THEN** all consumers can report completion and the resulting available balance consistently

### Requirement: Consumer-specific persistence and concurrency are injectable
The shared boundary SHALL accept consumer-provided persistence, exclusive-operation, cancellation, and lifecycle dependencies, and SHALL never require browser-only storage or locking from a server consumer.

#### Scenario: Browser wallet
- **WHEN** BIS uses the shared boundary
- **THEN** browser-scoped records, locks, cancellation, and UI state remain owned by the BIS adapter

#### Scenario: Faucet server
- **WHEN** the faucet uses the shared boundary
- **THEN** it supplies server-safe durable operation state and process-level exclusivity without exposing its recovery phrase in state, logs, or responses

### Requirement: Operator failures remain truthful and actionable
The shared boundary SHALL distinguish unavailable operator capability, unsupported policy, rejected settlement, ambiguous submission, and verified completion, and SHALL retain an unresolved operation when submission outcome is unknown.

#### Scenario: Fee estimation is unavailable
- **WHEN** the operator returns `fee-estimation-unavailable` while creating a commitment transaction
- **THEN** every consumer reports operator capability unavailability, keeps funds non-spendable, and offers safe retry or reconciliation rather than claiming success

#### Scenario: Operator becomes healthy
- **WHEN** a later capability check and settlement attempt succeed
- **THEN** the consumer refreshes transaction history and balance and reports spendable Arkade funds only after verification

### Requirement: Faucet readiness is browser-verifiable
The faucet SHALL expose enough public status and transaction evidence for an end-to-end browser test to verify the transition from Bitcoin boarding funds to available Arkade funds without simulated financial outcomes.

#### Scenario: Healthy faucet onboarding
- **WHEN** the configured operator accepts the faucet's exact settlement
- **THEN** Playwright can observe the onboarding action, resulting transaction evidence, and a positive available Arkade balance

#### Scenario: Operator remains unavailable
- **WHEN** the configured operator continues returning fee-estimation-unavailable
- **THEN** Playwright observes a truthful unavailable state and the faucet does not claim that onboarding or funding completed
