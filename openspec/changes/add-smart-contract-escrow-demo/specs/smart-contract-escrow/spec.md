# Spec Delta

## Purpose

Provide a small, truthful escrow example that teaches how programmable conditions hold and release funds between two wallets without exposing private contract material.

## ADDED Requirements

### Requirement: Escrow lifecycle
The system SHALL support a two-minute escrow lifecycle with a caller-supplied unique identifier, sender, recipient, amount, approval state, expiration deadline, and terminal status.

#### Scenario: Send escrow
- **WHEN** an eligible sender submits Send Escrow with an unused identifier, recipient, amount, and `approveUponCreation` boolean
- **THEN** the system creates or funds one escrow with a two-minute claim window and reports the actual pending or confirmed outcome
- **AND** the escrow is approved at creation only when `approveUponCreation` is true and that approval is verified
- **AND** the escrow status is `Funded` only after funding evidence is confirmed

#### Scenario: Taken escrow identifier
- **WHEN** Send Escrow is called with an identifier already owned by an existing escrow
- **THEN** creation fails with an explicit already-taken result
- **AND** the existing escrow is not changed, overwritten, or paid

#### Scenario: Approval before receipt
- **WHEN** the sender invokes Approve Escrow before expiration on an unapproved escrow
- **THEN** the escrow records sender approval and exposes Receive Escrow only when the approval is valid and current

#### Scenario: Approval already exists
- **WHEN** the sender invokes Approve Escrow on an escrow that is already approved
- **THEN** the call returns the existing approved state without creating a duplicate operation or changing the escrow terms

#### Scenario: Receive approved escrow
- **WHEN** the intended recipient invokes Receive Escrow before expiration on an approved escrow
- **THEN** the system submits the payment through the production contract workflow
- **AND** the escrow becomes `Claimed` only after payment confirmation

#### Scenario: Receive already completed escrow
- **WHEN** Receive Escrow is called after the escrow is already claimed or refunded
- **THEN** the call returns the existing terminal result without submitting another payment

#### Scenario: Expired escrow
- **WHEN** the two-minute deadline passes before receipt
- **THEN** Check Escrow reports `Expired`
- **AND** Receive Escrow cannot submit a payment against that escrow

#### Scenario: Refund expired escrow
- **WHEN** an expired escrow is eligible for sender recovery
- **THEN** the sender can recover the locked funds through the supported refund/recovery path
- **AND** the escrow reports `Refunded` only after recovery confirmation

### Requirement: Repeatable escrow status check
Check Escrow SHALL be read-only with respect to funds, callable repeatedly by either side, and SHALL report status, approval, deadline, seconds remaining, sender, recipient, amount, and evidence freshness.

#### Scenario: Repeated check while active
- **WHEN** either wallet calls Check Escrow multiple times during the claim window
- **THEN** each call returns the latest available status and recalculated time remaining
- **AND** no funds move and no wallet mutation is submitted

#### Scenario: Status evidence unavailable
- **WHEN** current contract evidence cannot be read
- **THEN** Check Escrow reports unavailable or stale evidence rather than returning an empty or fabricated status

#### Scenario: Missing escrow
- **WHEN** Check Escrow is called for an identifier that has never been created
- **THEN** the call returns a `NotFound` result without submitting a wallet operation

### Requirement: Fee transparency
The system SHALL distinguish read-only checks from wallet mutations and SHALL expose the actual fee quote or confirmed fee for every mutating escrow operation.

#### Scenario: Check has no wallet fee
- **WHEN** a user invokes Check Escrow
- **THEN** the UI reports a zero wallet transaction fee and does not request funds

#### Scenario: Mutation fee is dynamic
- **WHEN** a user prepares Send Escrow, Approve Escrow, Receive Escrow, or expired-fund recovery
- **THEN** the UI shows the provider/network fee returned by the current Arkade workflow, including zero when the supported approval path is signature-only
- **AND** it does not claim a fixed fee before the workflow supplies a quote

### Requirement: Identity and deadline guards
Escrow actions SHALL enforce sender/recipient identity, active network, expiration, current approval state, duplicate-operation protection, and truthful pending/confirmed/failed outcomes. Every action SHALL be safely repeatable, while creation SHALL reject a taken identifier.

#### Scenario: Wrong wallet attempts receipt
- **WHEN** a wallet other than the designated recipient invokes Receive Escrow
- **THEN** the operation is rejected without moving funds or exposing private contract material

#### Scenario: Duplicate mutation
- **WHEN** a mutating escrow call is already pending
- **THEN** another equivalent call is blocked or reconciled against the existing operation rather than submitted twice

#### Scenario: Repeat completed action
- **WHEN** Check Escrow, Approve Escrow, Receive Escrow, or refund/recovery is called again after its result is known
- **THEN** the call returns the current truthful state or terminal result without duplicating a payment, approval, or refund
