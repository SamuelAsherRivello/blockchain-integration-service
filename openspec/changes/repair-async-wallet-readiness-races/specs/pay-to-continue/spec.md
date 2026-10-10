## ADDED Requirements

### Requirement: Continuation readiness follows current eligibility
Continuation readiness SHALL represent the latest applicable eligibility check for the active player, network, and recipient. Completion of a superseded check SHALL NOT report readiness while its replacement is pending. A funded user's explicit payment gesture SHALL wait for current eligibility without requiring a second click solely because an earlier read completed first.

#### Scenario: Eligibility changes while readiness is awaited
- **WHEN** a second eligibility check supersedes the first and the first resolves before the second
- **THEN** the readiness wait remains pending until the second settles or the owning session is invalidated
- **AND** only the second result can authorize submission

#### Scenario: Current eligibility is negative or unavailable
- **WHEN** the applicable check reports insufficient funds or cannot verify spendability within the bounded read policy
- **THEN** no payment is submitted and the user receives an accurate unavailable reason
- **AND** a later explicit attempt can re-evaluate eligibility

### Requirement: Continuation gestures remain bound during preparation
A payment gesture SHALL retain its player, network, recipient, and host-session scope while readiness is pending. A scope change or disposal before submission SHALL abandon that preparation without creating a payment for the replacement scope. Repeated gestures during one preparation SHALL NOT create multiple payments.

#### Scenario: Wallet scope changes before readiness settles
- **WHEN** the player, network, recipient, or host session changes during a payment readiness wait
- **THEN** the old gesture cannot submit under either the previous or replacement scope
- **AND** a fresh gesture is required for the replacement scope

#### Scenario: Duplicate gesture during preparation
- **WHEN** the user repeats the payment gesture before the applicable eligibility read completes
- **THEN** at most one payment request is submitted for that preparation

#### Scenario: Submitted outcome arrives after replacement
- **WHEN** a payment submitted before replacement completes later
- **THEN** its journal remains bound to the original operation and recipient
- **AND** it cannot authorize gameplay or UI success for the replacement session
