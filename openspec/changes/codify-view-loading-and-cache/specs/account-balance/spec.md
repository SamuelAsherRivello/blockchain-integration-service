# Spec Delta

## MODIFIED Requirements

### Requirement: Available and total balances
Account Details SHALL show Total balance first, then Bitcoin balance on the left and Arkade balance on the right, with separate read-only values and Copy controls. The player-facing label Available balance SHALL be removed. Bitcoin SHALL represent boarding totals; Arkade SHALL represent full Arkade-side totals, including temporarily unavailable funds. The two SHALL sum to Total. All amounts SHALL be validated nonnegative safe integer sats from a fresh read belonging to the active account. Failed, partial or inconsistent reads SHALL NOT appear as zero. Network: Signet SHALL remain visible. A transient provider, indexer, network, or wallet-read failure SHALL receive the shared bounded retry policy before the read becomes unavailable.

#### Scenario: Successful nonzero read
- **WHEN** the SDK reports total 1500, boarding 500 and spendable 800 sats
- **THEN** the UI shows Total 1500, Bitcoin 500 and Arkade 1000 sats, each with its own copy action

#### Scenario: Genuine zero balance
- **WHEN** a complete read reports all zeros
- **THEN** each balance displays 0 sats
- **AND** a failed read displays unavailable rather than zero or previous balances

#### Scenario: Transient Player Wallet read failure
- **WHEN** the first fresh Player Wallet read fails because a provider or indexer request is transiently unavailable
- **THEN** BIS retries within the bounded read policy
- **AND** a later successful read displays only the replacement account's validated balances

### Requirement: Explicit refresh and loading
The system SHALL request balances on entry to the Account Details dialog and through an explicitly labeled Refresh control. It SHALL clear existing amounts and immediately cover the rendered page with the Pending Operation Dialog while requesting and preparing data, without inline loading text. Failed reads SHALL retry according to the shared bounded retry policy, with 30 seconds per attempt where no tighter existing deadline applies. Refresh SHALL be disabled while a request is pending. Foreground Balance presentation SHALL NOT start its own polling or continuous subscription, or duplicate work when the already-open dialog is requested again. The independent account-automatic-onboarding coordinator SHALL observe funding and settlement on activation; these checks SHALL NOT persist live balance snapshots or open a foreground loading overlay. Verified onboarding transitions SHALL refresh shared payment availability and request a fresh visible balance read without restarting onboarding. Each request SHALL terminate in success or an unavailable state within a bounded deadline, and cancellation SHALL stop retries and prevent late results from publishing.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens or the player selects enabled Refresh
- **THEN** a fresh bounded read starts, previous amounts are absent, and loading is visible
- **AND** Refresh remains disabled until the request finishes or the presentation is left

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** the foreground view starts no periodic balance refresh; independent onboarding observation remains active as required by account-automatic-onboarding

#### Scenario: Cancelled retry
- **WHEN** the player leaves Account Details or changes accounts while a retry is pending
- **THEN** the pending read and remaining retries are cancelled
- **AND** no late result changes the previous presentation or replacement account

### Requirement: No persisted or stale fallback
Balance amounts SHALL NOT be persisted to browser storage or reused across dialog entries. A failed request, including a refresh after success in the same dialog, SHALL hide all amounts under the Pending Operation Dialog, apply the bounded retry policy, and then show an error with only OK. Previously saved identity SHALL remain usable independently of balance availability. No stale-value fallback or last-updated display SHALL be shown.

#### Scenario: Failure after success
- **WHEN** a successful read is followed by a refresh that fails because the browser is offline, a required service is unreachable, or the data is invalid
- **THEN** neither prior amount is visible and the operation error and OK remain above the inert page
- **AND** OK returns to the Account menu where Log Out is available

#### Scenario: Reopen or reload
- **WHEN** the player reopens Account Details or reloads the application after a successful balance read
- **THEN** no saved balance is presented and entry performs a new live read

#### Scenario: Retry exhaustion
- **WHEN** every bounded retry attempt fails or returns invalid/inconsistent data
- **THEN** the balance state becomes unavailable
- **AND** the UI does not present zero or the last successful value

### Requirement: Account and presentation isolation
Balance work SHALL NOT alter account activation. Pending work SHALL block covered runtime controls; after terminal failure, OK SHALL return to Account where the existing logout flow remains available. Leaving Account Details, account changes, logout/reset, or client disposal SHALL invalidate pending reads and clear balance state. Late results SHALL NOT notify disposed consumers or populate another account/presentation. An unreadable or missing identity SHALL follow existing account-access behavior rather than showing an apparently valid active account with unavailable balances. Host-facing state SHALL expose only provider-neutral balance values and status, never recovery material.

#### Scenario: Leave during a request
- **WHEN** the host leaves Account Details while a balance request or retry is pending
- **THEN** navigation proceeds and the pending result cannot repopulate the previous balance view

#### Scenario: Account changes while requesting
- **WHEN** the account is replaced or cleared in this or another observing instance before a read completes
- **THEN** the old result is ignored and no balance is attributed to the replacement account

#### Scenario: Return from logout cancellation
- **WHEN** the player cancels logout and returns to the active Account dialog
- **THEN** the unchanged account menu appears without requesting balances; entering Account Details starts a fresh read
