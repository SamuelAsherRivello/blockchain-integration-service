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

### Requirement: D3a production Send demonstration
Admin SHALL offer Send using the production public Account Send flow with the actual saved profile. Logged-out selection SHALL show the existing chooser without automatically creating an account. The preview and independent host SHALL share UI, state, fee review, lifecycle protection and payment behavior. Fixtures SHALL remain isolated test evidence, never live demonstration transactions.

#### Scenario: Open Send
- **WHEN** Send is selected with an active account
- **THEN** the production address-send form opens without preparing or submitting a payment automatically

#### Scenario: No profile
- **WHEN** Send is selected while logged out
- **THEN** the normal chooser appears without fabricated balances or automatic account creation

### Requirement: Separate non-Lightning and invoice sending stories
Documentation SHALL retain D3 as the sending parent and distinguish D3a address sending from D3b paying a Lightning invoice. D5 pending-transfer recovery SHALL remain a separate proposal/story and SHALL NOT block D3a implementation or isolated testing. D3b SHALL remain deferred and unstarted, without enabled runtime controls or implementation tasks in D3a. D3a completion SHALL require synchronized diagrams and live verification for Arkade-to-Arkade, plus isolated error, navigation, accessibility, duplicate-send, restart and lifecycle-guard tests. Missing live evidence SHALL remain pending.

#### Scenario: Report delivery status
- **WHEN** Send delivery is documented
- **THEN** D3a evidence identifies each verified route and missing checks explicitly
- **AND** D3b is not reported implemented or made a prerequisite for D3a
