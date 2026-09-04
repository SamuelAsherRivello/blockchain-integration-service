## Purpose

Allow players to explicitly request cancellation of an unresolved same-account transfer without hiding uncertainty, cancelling unrelated work or enabling duplicate transfers.

## ADDED Requirements

### Requirement: Feasibility-first delivery
Safe exact-operation cancellation and authoritative terminal-outcome semantics SHALL be established before cancellation code or UI is built. If these cannot be established for the supported operator, implementation SHALL stop and report the blocker. Disabled cancellation UI SHALL NOT count as delivery. D5b. Cancel Pending Transfer SHALL be documented as a separate story with its own status, flow and acceptance criteria, linked from D4 under the D5 umbrella. Independently deliverable D5a read-only recovery reporting SHALL NOT be blocked by cancellation feasibility and SHALL NOT be represented as cancellation.

#### Scenario: Operator guarantees unproven
- **WHEN** exact cancellation targeting or terminal-outcome guarantees cannot be verified
- **THEN** the change remains blocked before cancellation implementation, and D5 documentation states the blocker without claiming delivered cancellation

### Requirement: Explicit cancellation review
Account Transfer SHALL offer Cancel Pending Transfer for an eligible unresolved operation belonging to the active account. Opening it SHALL show a separate confirmation with direction, sats amount, transfer ID and operator intent ID, explain that cancellation cannot undo a completed transfer and may remain unverified, and provide Confirm Cancellation and Back. Opening, leaving, refreshing or checking status SHALL NOT sign or request cancellation. Confirmation SHALL be bound to the reviewed operation and account.

#### Scenario: Review and return
- **WHEN** the player opens Cancel Pending Transfer and selects Back
- **THEN** no cancellation is submitted and the original transfer remains unchanged

#### Scenario: Explicit confirmation
- **WHEN** the player confirms an eligible cancellation for the still-current reviewed operation
- **THEN** only that cancellation is requested, without resubmitting or resuming the transfer

### Requirement: Verified cancellation eligibility
Cancellation SHALL be enabled only when supported operator behavior can target the recorded operation through its exact owned inputs and distinguish terminal cancellation from concurrent settlement. An active transfer attempt, unknown registration without a safely attributable intent, missing ownership evidence, unsupported direction, corrupt record or unavailable capability SHALL prevent submission and show a reason. Neither all-wallet cancellation nor a force-clear substitute SHALL be offered.

#### Scenario: Unknown registration
- **WHEN** the record has no attributable operator intent or its cancellation scope cannot be verified
- **THEN** cancellation remains unavailable while Check Status and the operator-investigation identifiers remain available

#### Scenario: Completion precedes cancellation
- **WHEN** pre-cancellation reconciliation verifies transfer completion
- **THEN** completion is shown and no cancellation request is sent

### Requirement: Durable cancellation uncertainty
The system SHALL preserve the original transfer identity, amount, direction, inputs and known identifiers while recording cancellation progress before a cancellation request can reach the operator. Interrupted or unconfirmed cancellation SHALL survive restart as unresolved. Repeated clicks, concurrent contexts, navigation and automatic recovery SHALL NOT produce duplicate mutation requests. Requests not yet sent SHALL be rejected after their account, operation or authorization becomes obsolete.

#### Scenario: Lost response and reload
- **WHEN** cancellation may have reached the operator but its response is lost and the page reloads
- **THEN** cancellation remains unverified, status checks remain read-only, and no automatic retry occurs

#### Scenario: Concurrent cancellation
- **WHEN** two contexts confirm the same pending cancellation concurrently
- **THEN** at most one cancellation request is sent and the other observes pending work or a contention error

#### Scenario: Obsolete confirmation
- **WHEN** the reviewed account or operation changes before submission
- **THEN** the old confirmation cannot mutate the new account or operation

### Requirement: Evidence-based terminal outcomes
The system SHALL report verified cancellation only from authoritative evidence tied to the recorded attempt that excludes later settlement of that intent. An acknowledgement without established finality semantics, timeout, missing history, unspent inputs, local cancellation label or not-found response alone SHALL NOT establish cancellation. A transfer that settles instead SHALL follow existing completion verification, not be labelled cancelled. Conflicting or insufficient evidence SHALL retain an unresolved outcome and investigation guidance.

#### Scenario: Authoritatively cancelled
- **WHEN** authoritative cancellation evidence proves the recorded intent cannot subsequently settle
- **THEN** verified cancellation is durably recorded without erasing the original transfer

#### Scenario: Cancellation loses the race
- **WHEN** the recorded transfer has verified settlement evidence instead of terminal cancellation
- **THEN** its outcome is verified transfer completion, with no cancellation-success or refund claim

#### Scenario: Ambiguous operator response
- **WHEN** cancellation returns a timeout, not-found response or acknowledgement without a verified finality guarantee
- **THEN** the system reports cancellation unverified and retains all unresolved-transfer guards

### Requirement: Guard release and subsequent actions
While cancellation is in progress or unverified, new wallet mutations, Log Out and Reset SHALL remain blocked by the unresolved-transfer protection. Only durably verified cancellation or existing verified transfer completion SHALL release that protection. Release SHALL NOT itself log out, reset, mint, send or retry a transfer; existing confirmations and a fresh transfer review SHALL still be required.

#### Scenario: Verified cancellation unlocks review
- **WHEN** cancellation is verified and durably recorded
- **THEN** the player can start a fresh transfer review or the normal logout/reset flow without any automatic action

#### Scenario: Persistence failure
- **WHEN** saving terminal cancellation evidence fails
- **THEN** the system does not advertise a safely resolved cancellation or release its guards

### Requirement: Truthful production presentation
Account Transfer and Account Activity SHALL distinguish cancellation requested, cancellation unverified, verified cancellation and verified transfer completion, preserving public identifiers and accurate direction/amount. Copy Transactions SHALL include the visible cancellation state without inventing a transaction ID, blockchain timestamp or refund. Verified resolution SHALL refresh balances and Activity without turning a refresh failure into zero balances or reversing a durable outcome. The existing D4 demonstration SHALL use the same production API and UI without simulated live outcomes.

#### Scenario: Unverified cancellation in Activity
- **WHEN** a same-account cancellation is unresolved and no matching transaction exists
- **THEN** Activity shows the local cancellation status and public identifiers without claiming a blockchain transaction

#### Scenario: Balance service unavailable after resolution
- **WHEN** cancellation is durably verified but fresh balance retrieval fails
- **THEN** cancellation remains verified and the balance is unavailable rather than fabricated

### Requirement: Signing and privacy boundary
Cancellation SHALL be Signet-only and limited to an explicitly confirmed ownership proof for the eligible recorded operation. Inspection SHALL remain read-only. Cancellation SHALL NOT enable automatic settlement, submit replacement payments or persist, log, copy or display private keys, recovery phrases or signed proofs. Public host-facing cancellation data SHALL contain no vendor-specific signing types or secrets.

#### Scenario: Read-only recovery
- **WHEN** the account is restored or Check Status runs for a pending cancellation
- **THEN** no signing or mutation occurs and only sanitized public status is exposed
