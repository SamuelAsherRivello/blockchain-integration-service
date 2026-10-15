# Spec Delta

## Purpose

Provide a shared, truthful public projection of asset-readiness and asset-operation outcomes so users and hosts can distinguish retryable preflight failures from submitted work that requires recovery.

## ADDED Requirements

### Requirement: Asset readiness reports a specific safe reason
Asset mutation readiness SHALL report the active account, network, provider freshness, coordination, storage, reservation, and spendable-input condition using a JSON-safe reason code and user-safe message.

#### Scenario: Mint has balance but no eligible input
- **WHEN** total balance is positive but all spendable inputs are reserved or otherwise ineligible
- **THEN** readiness reports reserved or unavailable input state and SHALL NOT report the wallet as ready

#### Scenario: Provider cannot verify current state
- **WHEN** the selected provider or indexer cannot prove the active network or fresh ownership/input state
- **THEN** readiness reports provider-unavailable or network-mismatch and SHALL NOT submit a mutation

### Requirement: Asset outcomes preserve the submission boundary
Asset operations SHALL distinguish definitive pre-submission failure, confirmed success, and outcome-unknown work that may have crossed submission.

#### Scenario: Pre-submission failure
- **WHEN** mint preparation fails before network submission
- **THEN** the result contains a specific safe reason and no pending operation is presented as submitted

#### Scenario: Submission acknowledgement is lost
- **WHEN** a mutation may have been accepted but confirmation is unavailable
- **THEN** the original operation remains outcome-unknown or pending, retains recovery identity, and cannot be replaced by a new operation

### Requirement: Diagnostics never expose secrets
Diagnostic projections SHALL contain only allowlisted public identifiers, statuses, reason codes, amounts, networks, and recovery guidance; they SHALL omit phrases, keys, raw SDK exceptions, and private transaction payloads.

#### Scenario: Hostile provider error
- **WHEN** an adapter throws an error containing secret-like or vendor-private text
- **THEN** the public diagnostic contains only the mapped safe reason and no raw error text
