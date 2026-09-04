## Purpose

Let a player inspect and manually copy a privacy-limited recovery handoff for an unresolved transfer without signing, clearing state or contacting a third party.

## ADDED Requirements

### Requirement: Pending transfer recovery report
Pending Account Transfer SHALL offer expandable Recovery details with a read-only, selectable report showing Signet, direction, sats amount, transfer ID, operator intent ID, known commitment ID, recorded phase and verification availability. Missing or invalid values SHALL be identified as unknown or unavailable, never invented. The report SHALL explain that it is a status snapshot, not proof of cancellation or failure, and ask the operator for the intent's batch/commitment outcome or authoritative terminal-failure evidence excluding later settlement.

#### Scenario: Registered transfer
- **WHEN** a registered pending operation is displayed
- **THEN** Recovery details shows its known public identifiers and a ready-to-copy investigation handoff without submitting another request

#### Scenario: Verification unavailable
- **WHEN** status verification is unavailable or a subsequent check throws
- **THEN** the report clearly identifies unavailable verification and preserves only known status information without presenting the prior check as current live verification

### Requirement: Explicit copy and safe fallback
The player SHALL explicitly choose Copy recovery details to copy exactly the displayed report. Success SHALL be shown only after clipboard completion. Failure SHALL retain selectable text with manual-copy guidance. A changed report or unmounted view SHALL NOT display stale copy-success feedback.

#### Scenario: Clipboard denied
- **WHEN** the clipboard request fails
- **THEN** the report remains selectable and manual-copy guidance appears without claiming success

### Requirement: Privacy and mutation boundary
The report SHALL contain only allowlisted public transfer-status fields and fixed guidance, excluding private account material, raw provider errors, addresses, balances and arbitrary extra fields. Displaying/copying SHALL NOT read account secrets, write the transfer journal, sign, cancel, resubmit, clear guards or send data to an operator. It SHALL warn that the IDs reveal transaction-related information and should only be shared with trusted support. Resolved or absent operations SHALL not show the pending recovery report.

#### Scenario: Explicit manual handoff
- **WHEN** the user inspects or copies the report
- **THEN** no operator outreach or wallet mutation occurs and the unresolved-transfer guards remain in place

#### Scenario: Transfer resolves
- **WHEN** subsequent status verification reports completion or not-submitted
- **THEN** the pending recovery report disappears and existing terminal-state behavior applies
