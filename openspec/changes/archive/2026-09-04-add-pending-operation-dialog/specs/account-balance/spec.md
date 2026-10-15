## MODIFIED Requirements

### Requirement: Explicit refresh and loading
The system SHALL request balances on entry to the Account Details dialog and through an explicitly labeled Refresh control. It SHALL clear existing amounts and immediately cover the rendered page with the Pending Operation Dialog while requesting and preparing data, without inline loading text. Failed reads SHALL retry once, with 30 seconds per attempt where no tighter existing deadline applies. Refresh SHALL be disabled while a request is pending. It SHALL NOT poll, subscribe for continuous balance updates, or duplicate work when the already-open dialog is requested again. Each request SHALL terminate in success or an unavailable state within a bounded deadline.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens or the player selects enabled Refresh
- **THEN** a fresh bounded read starts, previous amounts are absent, and loading is visible
- **AND** Refresh remains disabled until the request finishes or the presentation is left

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** no periodic or background balance refresh is started

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
