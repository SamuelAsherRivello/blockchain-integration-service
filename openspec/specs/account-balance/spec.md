# account-balance Specification

## Purpose

Provide reusable, freshly requested Signet balance information in the Account Details dialog without persisting wallet balances or presenting stale values after failure.

**Story status:** A.P.4 ✓ — complete, confirmed by the user on 2026-09-09.

## Requirements

### Requirement: Available and total balances
Account Details SHALL show Total balance first, then Bitcoin balance on the left and Arkade balance on the right, with separate read-only values and Copy controls. The player-facing label Available balance SHALL be removed. Bitcoin SHALL represent boarding totals; Arkade SHALL represent full Arkade-side totals, including temporarily unavailable funds. The two SHALL sum to Total. All amounts SHALL be validated nonnegative safe integer sats from a fresh read belonging to the active account. Failed, partial or inconsistent reads SHALL NOT appear as zero. Network: Signet SHALL remain visible.

#### Scenario: Successful nonzero read
- **WHEN** the SDK reports total 1500, boarding 500 and spendable 800 sats
- **THEN** the UI shows Total 1500, Bitcoin 500 and Arkade 1000 sats, each with its own copy action

#### Scenario: Genuine zero balance
- **WHEN** a complete read reports all zeros
- **THEN** each balance displays 0 sats
- **AND** a failed read displays unavailable rather than zero or previous balances

### Requirement: Explicit refresh and loading
The system SHALL request balances on entry to the Account Details dialog and through an explicitly labeled Refresh control. It SHALL clear existing amounts and immediately cover the rendered page with the Pending Operation Dialog while requesting and preparing data, without inline loading text. Failed reads SHALL retry once, with 30 seconds per attempt where no tighter existing deadline applies. Refresh SHALL be disabled while a request is pending. Foreground Balance presentation SHALL NOT start its own polling or continuous subscription, or duplicate work when the already-open dialog is requested again. The independent account-automatic-onboarding coordinator SHALL observe funding and settlement on activation; these checks SHALL NOT persist live balance snapshots or open a foreground loading overlay. Verified onboarding transitions SHALL refresh shared payment availability and request a fresh visible balance read without restarting onboarding. Each request SHALL terminate in success or an unavailable state within a bounded deadline.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens or the player selects enabled Refresh
- **THEN** a fresh bounded read starts, previous amounts are absent, and loading is visible
- **AND** Refresh remains disabled until the request finishes or the presentation is left

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** the foreground view starts no periodic balance refresh; independent onboarding observation remains active as required by account-automatic-onboarding

### Requirement: No persisted or stale fallback
Balance amounts SHALL NOT be persisted to browser storage or reused across dialog entries. A failed request, including a refresh after success in the same dialog, SHALL hide all amounts under the Pending Operation Dialog, retry once, and then show an error with only OK. OK SHALL close the failed page and return to Account. Previously saved identity SHALL remain usable independently of balance availability. No stale-value fallback or last-updated display SHALL be shown.

#### Scenario: Failure after success
- **WHEN** a successful read is followed by a refresh that fails because the browser is offline, a required service is unreachable, or the data is invalid
- **THEN** neither prior amount is visible and the operation error and OK remain above the inert page
- **AND** OK returns to the Account menu where Log Out is available

#### Scenario: Reopen or reload
- **WHEN** the player reopens Account Details or reloads the application after a successful balance read
- **THEN** no saved balance is presented and entry performs a new live read

### Requirement: Account and presentation isolation
Balance work SHALL NOT alter account activation. Pending work SHALL block covered runtime controls; after terminal failure, OK SHALL return to Account where the existing logout flow remains available. Leaving Account Details, account changes, logout/reset, or client disposal SHALL invalidate pending reads and clear balance state. Late results SHALL NOT notify disposed consumers or populate another account/presentation. An unreadable or missing identity SHALL follow existing account-access behavior rather than showing an apparently valid active account with unavailable balances. Host-facing state SHALL expose only provider-neutral balance values and status, never recovery material.

#### Scenario: Leave during a request
- **WHEN** the host leaves Account Details while a balance request is pending
- **THEN** navigation proceeds and the pending result cannot repopulate the previous balance view

#### Scenario: Account changes while requesting
- **WHEN** the account is replaced or cleared in this or another observing instance before a read completes
- **THEN** the old result is ignored and no balance is attributed to the replacement account

#### Scenario: Return from logout cancellation
- **WHEN** the player cancels logout and returns to the active Account dialog
- **THEN** the unchanged account menu appears without requesting balances; entering Account Details starts a fresh read

### Requirement: Transfer entry from Account Details
Accounts Details SHALL retain access to Account Transfer for the active account. Its Balance page SHALL place the onboarding status entry, rather than a manual transfer entry, immediately above Get Recovery Phrase. Existing refresh and account navigation SHALL remain available. Transfer entry and return SHALL read fresh balances and SHALL NOT move funds.

#### Scenario: Open and return
- **WHEN** the player opens Account Transfer and then selects Back
- **THEN** Account Details returns with a fresh read and no transfer submitted

### Requirement: Onboarding status entry
Balance SHALL show exactly Onboarding: Start?, Onboarding: Pending, or Onboarding: Complete immediately above Get Recovery Phrase. Start? SHALL mean verified funding is needed with no positive Arkade balance; Pending SHALL cover initial assessment, detected funding, execution, recovery and blocked verification when the active account has no positive Arkade balance; Complete SHALL follow account-automatic-onboarding completion, verified already-ready assessment, or a fresh positive Arkade balance for the active account. Selecting this entry or Admin B.P.8 SHALL open the active account's onboarding details using the same fresh active-account balance state currently displayed by Account Details, or start one bounded fresh read before presenting readiness. A successful balance from another account, an unavailable balance, and a prior-entry balance SHALL NOT be reused. Back SHALL return to Balance. Neither navigation action SHALL itself start, repeat or cancel a transfer. Automatic execution SHALL remain independent of navigation.

#### Scenario: Unfunded account
- **WHEN** a fresh assessment verifies that onboarding needs funding
- **THEN** Balance shows Onboarding: Start? and its details provide the boarding address and faucet action

#### Scenario: Initial check unavailable
- **WHEN** funding or readiness cannot yet be verified
- **THEN** Balance shows Onboarding: Pending and details explain checking or unavailable verification without asserting a zero balance

#### Scenario: Existing Arkade balance
- **WHEN** Account Details has a fresh positive Arkade balance and the player selects its Onboarding entry or Admin B.P.8
- **THEN** the entry shows Onboarding: Complete and Onboarding renders stage 5 with all five stages Complete
- **AND** the navigation does not issue a transfer or persist the balance

#### Scenario: Complete before Bitcoin confirmation
- **WHEN** account-automatic-onboarding verifies usable final target funds while Bitcoin confirmation is outstanding
- **THEN** the entry shows Onboarding: Complete and details preserve the individual Unconfirmed transaction status
