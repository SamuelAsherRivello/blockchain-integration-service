# Spec Delta

## MODIFIED Requirements

### Requirement: Available and total balances
Account Details SHALL show Total balance first, then Bitcoin balance on the left and Arkade balance on the right, with separate read-only values and Copy controls. The player-facing label Available balance SHALL be removed. Bitcoin SHALL represent boarding totals; Arkade SHALL represent full Arkade-side totals, including temporarily unavailable funds. The two SHALL sum to Total. All amounts SHALL be validated nonnegative safe integer sats from a complete successful read belonging to the active account or its valid in-memory cache. Failed, partial or inconsistent reads SHALL NOT appear as zero. Network: Signet SHALL remain visible.

#### Scenario: Successful nonzero read
- **WHEN** the SDK reports total 1500, boarding 500 and spendable 800 sats
- **THEN** the UI shows Total 1500, Bitcoin 500 and Arkade 1000 sats, each with its own copy action

#### Scenario: Genuine zero balance
- **WHEN** a complete read reports all zeros
- **THEN** each balance displays 0 sats
- **AND** a failed read displays unavailable rather than zero or previous balances

### Requirement: Explicit refresh and loading
The system SHALL request balances on first entry to the Account Details dialog when no valid recent cache exists and through an explicitly labeled Refresh control. Account Details SHALL remain usable while its foreground balance read is pending, showing a single dash for each unavailable identity or balance value and no blocking Pending Operation Dialog. Failed reads SHALL retry once, with 30 seconds per attempt where no tighter existing deadline applies. Refresh SHALL be disabled while a request is pending and its icon SHALL be greyed out and spinning. Foreground Balance presentation SHALL NOT start its own polling or continuous subscription, or duplicate work when the already-open dialog is requested again. The independent account-automatic-onboarding coordinator SHALL observe funding and settlement on activation; these checks SHALL NOT persist live balance snapshots or open a foreground loading overlay. Verified onboarding transitions SHALL refresh shared payment availability and request a fresh visible balance read without restarting onboarding. Each request SHALL terminate in success or an unavailable state within a bounded deadline.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens without a valid recent balance or the player selects enabled Refresh
- **THEN** a bounded read starts, unavailable identity or balance fields show a single dash, the page remains usable, the cache is bypassed for explicit Refresh, and Refresh is disabled with a grey spinning icon until the request finishes or the presentation is left
- **AND WHEN** the dialog opens within the valid cache window for the same account and network
- **THEN** the cached balances appear without a new read or loading dialog

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** the foreground view starts no periodic balance refresh; independent onboarding observation remains active as required by account-automatic-onboarding

### Requirement: No persisted or stale fallback
Balance amounts SHALL NOT be persisted to browser storage or reused after the cache freshness window. A failed request, including a refresh after success in the same dialog, SHALL clear visible amounts to dashes, retry once, and then show an error with only OK. A valid, complete in-memory cache may be reused only for the same account and network within the shared freshness window. Previously saved identity SHALL remain usable independently of balance availability. No failed, partial, expired, or cross-account value SHALL be shown as current.

#### Scenario: Failure after success
- **WHEN** a successful read is followed by a refresh that fails because the browser is offline, a required service is unreachable, or the data is invalid
- **THEN** neither prior amount is visible, the fields show dashes, and the operation error and OK remain available without presenting stale balances as current
- **AND** OK returns to the Account menu where Log Out is available

#### Scenario: Reopen or reload
- **WHEN** the player reopens Account Details within 15 seconds after a successful read
- **THEN** the complete cached balance is shown without a new live read
- **AND WHEN** the player reopens it after 15 seconds or after reload
- **THEN** no persisted balance is presented and entry performs a new live read

### Requirement: Account and presentation isolation
Balance work SHALL NOT alter account activation. Pending work SHALL block only controls covered by the selected loading policy; Account Details balance reads SHALL leave its prepared controls usable. Leaving Account Details, account changes, logout/reset, network changes, cache invalidation, or client disposal SHALL invalidate pending reads and prevent incompatible cached balance state from being used. Late results SHALL NOT notify disposed consumers or populate another account/presentation. An unreadable or missing identity SHALL follow existing account-access behavior rather than showing an apparently valid active account with unavailable balances. Host-facing state SHALL expose only provider-neutral balance values and status, never recovery material.

#### Scenario: Leave during a request
- **WHEN** the host leaves Account Details while a balance request is pending
- **THEN** navigation proceeds and the pending result cannot repopulate the previous balance view or cache an obsolete account result

#### Scenario: Account changes while requesting
- **WHEN** the account or selected network changes before or after a balance read completes
- **THEN** the old result is ignored or invalidated and no old-account or old-network balance is attributed to the replacement

#### Scenario: Return from logout cancellation
- **WHEN** the player cancels logout and returns to the active Account dialog
- **THEN** the unchanged account menu appears without requesting balances; entering Account Details uses only a valid cache for that same account and network
