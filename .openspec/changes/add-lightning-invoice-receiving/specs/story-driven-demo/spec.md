## MODIFIED Requirements

### Requirement: Reset clears selection and transient state
Reset Client SHALL clear transient state and integration-owned persisted account material, release old clients/UI/subscriptions, clear selection, and leave runtime content empty with a fresh logged-out client. It SHALL preserve unrelated origin/host data and SHALL NOT erase remote wallet assets or fabricate outcomes. Reset SHALL remain available when there is selected content, pending account work, or saved account state, even without a selected story, except while a send or transfer remains submitting, pending or uncertain, a Lightning invoice remains payable, or receipt processing or reconciliation is unresolved. In that case Reset SHALL be blocked in both UI and public command execution until reconciliation proves safe completion or failure; it SHALL retain recovery state across instances and restart. A failed reset SHALL report failure rather than claim a fresh start. Stale work in the current or another open instance SHALL NOT repopulate cleared account state.

#### Scenario: Clear selected story
- **WHEN** Reset Client succeeds while the Account dialogue is shown and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** the fresh client has no saved account, selected story, or Account button
- **AND** old subscriptions are released and the next account entry is logged out

#### Scenario: No selected story
- **WHEN** the demo has no selected story but a saved account exists and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** Reset Client is enabled and can clear it

#### Scenario: Already fresh
- **WHEN** there is no selection, pending operation, or persisted account state after hydration
- **THEN** Reset Client is disabled

#### Scenario: Unresolved send survives reset attempt
- **WHEN** Reset Client is invoked while a send outcome is unresolved
- **THEN** the reset is refused without clearing account or recovery state

#### Scenario: Unfinished receiving operation
- **WHEN** any invoice is payable or a receipt needs processing or reconciliation
- **THEN** Reset Client is blocked, including without a selected story
- **AND** it preserves the account and recovery state and explains the block

## ADDED Requirements

### Requirement: Invoice receiving demonstration and story synchronization
The demo SHALL expose the implemented receiving presentation through the production account flow, without automatically creating an account, an invoice, or a payment. Runtime Preview SHALL use the same public integration API and UI as an independent host. Its documentation SHALL describe D2 as receiving, retain D3 as the separate all-send-types feature, preserve existing story and step IDs, and distinguish the unavailable presentation from verified live invoice receiving. This extends the catalog only with actually implemented demonstrations and SHALL NOT remove unrelated existing demonstrations.

#### Scenario: Unavailable receiving demonstration
- **WHEN** the demo demonstrates Receive without a verified Signet invoice-receiving route
- **THEN** it shows the real address fields and the production Currently unavailable invoice section
- **AND** documentation does not mark live invoice generation or receipt as complete

#### Scenario: No active account
- **WHEN** the receiving demonstration is selected without an active account
- **THEN** the ordinary account chooser is shown without an automatically created profile or fabricated invoice

#### Scenario: Delivery evidence
- **WHEN** live invoice receiving is reported complete
- **THEN** evidence covers fee review, actual Signet generation and receipt, expiry/Renew, toggling, navigation reset, restart recovery, Activity reconciliation, failure handling, and production-host/demo parity
- **AND** isolated fixtures are not substituted for live payment evidence and unrelated A5 verification remains separately tracked
