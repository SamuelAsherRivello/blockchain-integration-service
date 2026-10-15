# Spec Delta

## MODIFIED Requirements

### Requirement: Deadline-aware claim and refund
BIS SHALL revalidate claim eligibility against the immutable elapsed-time deadline at request and before submission. Reject/session end SHALL request supported cancellation returning sats to the game; while an explicitly started operation remains active, expiry SHALL trigger eligible refund cleanup independently of the visible host UI. Application initialization and passive contract reads SHALL NOT trigger provider-backed expiry cleanup. Once an operation might be submitted, BIS SHALL reconcile its actual outcome before competing spending, using an explicit lifecycle trigger or an active operation monitor.

#### Scenario: Claim after deadline
- **WHEN** the deadline has passed before claim submission eligibility is accepted
- **THEN** no new claim is submitted and the host receives a too-late outcome

#### Scenario: Slow accepted claim
- **WHEN** a claim may have been submitted before deadline but its result arrives later
- **THEN** BIS reports its verified success or failure, keeps uncertainty pending, and does not automatically initiate a conflicting refund

#### Scenario: Session ends during funding
- **WHEN** the host ends an attempt while funding is still pending
- **THEN** BIS persists the end request and reconciles the original funding, refunding if it succeeds without offering the reward again

#### Scenario: Application initializes with an expired unresolved offer
- **WHEN** the application loads while a durable offer is expired but unresolved
- **THEN** BIS restores the record silently without provider-backed cleanup or a pending toast
- **AND** a later explicit Contracts check, game lifecycle trigger, or operation action may perform targeted cleanup

### Requirement: Durable recovery and wallet policy participation
BIS SHALL persist sanitized contract records and encrypted recovery material before submission, reserve inputs/outpoints, preserve existing asset holdings, and correlate terminal evidence to the specific contract and recipient. Reload, timer suspension and wallet changes SHALL NOT imply completion or trigger duplicate operations. Application reload SHALL restore durable records and local operation state silently; provider-backed reconciliation SHALL begin only from an explicit contract inspection/action, an explicit new game/Admin operation, or an already-active operation monitor. Contract records SHALL participate in existing logout pending-loss acknowledgement and Admin Reset policies; player cleanup SHALL NOT erase separate game-owned refund recovery.

#### Scenario: Browser closed at expiry
- **WHEN** the browser is closed when an unresolved offer's deadline passes
- **THEN** reopening the application reads the original operation's durable state without creating a replacement or showing a pending toast
- **AND** the next explicit contract inspection or game lifecycle trigger resumes exact recovery without claiming cleanup occurred while the application was closed

#### Scenario: Player logout
- **WHEN** the player confirms logout under existing acknowledgement rules
- **THEN** player-side cleanup does not assert cancellation and the game-owned unresolved contract remains reserved and recoverable

#### Scenario: Wrong receipt evidence
- **WHEN** an unrelated balance increase or transaction is observed
- **THEN** it does not mark the offer claimed or refunded

#### Scenario: Explicit operation resumes after reload
- **WHEN** the user opens Contract Details and explicitly checks an unresolved operation
- **THEN** BIS resumes exact receipt reconciliation for that contract only
- **AND** the result remains durable for later inspection

### Requirement: Unobtrusive operation feedback
BIS SHALL provide operation-specific feedback for funding, claim and refund without opening a Pending Operation Dialog or pausing gameplay. Pending or verified toasts SHALL be emitted only for an explicit user action or an active operation presentation session, SHALL be deduplicated by operation and phase within that presentation session, and SHALL not be emitted for unchanged records observed during application initialization or passive reads. Errors and unknown outcomes SHALL be truthful; success SHALL distinguish verified Arkade execution from Bitcoin L1 finality.

#### Scenario: Funding completes after session end
- **WHEN** late funding succeeds for an ended or expired offer
- **THEN** active operation feedback describes return/recovery rather than advertising an available prize

#### Scenario: Repeated completion observation
- **WHEN** subscriptions and reconciliation observe the same terminal operation during one active presentation session
- **THEN** only one completion toast is emitted

#### Scenario: Reload observes unchanged pending funding
- **WHEN** a fresh Admin or game process reads an unchanged pending funding record during initialization
- **THEN** no `Offer funding pending` toast is emitted
- **AND** the record remains visible through explicit contract inspection or the relevant game UI

#### Scenario: Explicit funding start
- **WHEN** Admin or a game explicitly starts a new offer and funding is accepted for processing
- **THEN** the operation may be shown as pending in the initiating surface and Console
- **AND** no generic startup-style toast is required for the funding phase

#### Scenario: Preparation rejected
- **WHEN** an operation fails before submission
- **THEN** feedback identifies a supported sanitized failure reason without exposing raw provider messages or secret recovery material
