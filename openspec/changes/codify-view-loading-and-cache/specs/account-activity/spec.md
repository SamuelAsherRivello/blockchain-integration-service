# Spec Delta

## MODIFIED Requirements

### Requirement: Public state and freshness
The public integration API SHALL expose normalized incoming and outgoing transaction history and loading, ready, and unavailable states without SDK-specific types or secrets. Opening Activity SHALL load existing history when automatic loading is enabled and no valid recent cache exists, and enable automatic updates while open. A successful empty result SHALL retain the Transactions heading, disabled copy icon, list space and scrollbar without an empty-state message; it SHALL remain distinguishable from an unavailable read. Subscription failure alone SHALL permit polling fallback. Initial load and manual refresh SHALL be covered immediately by the Pending Operation Dialog when the view's modal loading policy is enabled, with no inline loading text. A valid same-account, same-network cached result may be revealed without the dialog. Only prepared content SHALL be revealed; final loading errors and OK SHALL close the source page. Transactions SHALL provide an explicitly labeled Refresh control, disabled while loading, matching Balance. Unavailable foreground loads SHALL use the Pending Operation Dialog failure contract and SHALL NOT present prior data as current.

#### Scenario: Arrival while open
- **WHEN** a new incoming or outgoing transaction is reported while Activity is open
- **THEN** public state and the production list update without clicking Refresh Balance, including arrivals during initial loading

#### Scenario: Return within freshness window
- **WHEN** the player reopens Transactions within 15 seconds of a successful read for the same account and network
- **THEN** the cached history is revealed without another foreground read or loading dialog, while live updates may resume for the open view

#### Scenario: Failure after success
- **WHEN** an activity read or detected monitoring failure occurs after a successful display
- **THEN** Activity reports unavailable rather than an empty successful list or apparently current prior result

### Requirement: Account-scoped activity lifecycle
Activity SHALL be transient in presentation but may retain a complete successful result in the shared in-memory cache for the configured freshness window, scoped to the active account, network, and data type. List Back SHALL return to the Accounts Details submenu; its Back SHALL return to Account. Leaving Activity, logout, account replacement, reset, network change, cache invalidation, and disposal SHALL stop its monitoring and prevent incompatible state from being used. Late results SHALL NOT repopulate a closed view or another account's state.

#### Scenario: Account changes during a request
- **WHEN** the account changes before an activity request or callback finishes
- **THEN** the prior result is ignored, removed from cache eligibility, and no prior account entry appears for the new account

#### Scenario: Reopen Activity
- **WHEN** a player returns to Activity after leaving it
- **THEN** a recent complete same-account result is reused, or otherwise a fresh SDK read runs, and exactly one active monitoring lifecycle serves that view
