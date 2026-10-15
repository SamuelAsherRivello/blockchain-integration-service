# Spec Delta

## MODIFIED Requirements

### Requirement: Public state and freshness
The public integration API SHALL expose normalized incoming and outgoing transaction history and loading, ready, and unavailable states without SDK-specific types or secrets. Opening Activity SHALL immediately use a complete fresh account-scoped snapshot, join compatible pending history preparation, or start a foreground read, and enable automatic updates while open without duplicating the account history source. A successful empty result SHALL retain the Transactions heading, disabled copy icon, list space and scrollbar without an empty-state message; it SHALL remain distinguishable from an unavailable read. Subscription failure alone SHALL permit polling fallback.

Initial loading SHALL use the construction-gated Pending Operation Dialog; explicit Refresh SHALL begin its loading presentation immediately. No inline loading text SHALL be added. Only prepared content SHALL be revealed; final loading errors and OK SHALL close the source page. Transactions SHALL provide an explicitly labeled Refresh control, disabled while loading, matching Balance. Unavailable foreground loads SHALL use the Pending Operation Dialog failure contract and SHALL NOT present prior data as current.

#### Scenario: Arrival while open
- **WHEN** a new incoming or outgoing transaction is reported while Activity is open
- **THEN** public state and the production list update without clicking Refresh Balance, including arrivals during initial loading

#### Scenario: Failure after success
- **WHEN** an activity read or detected monitoring failure occurs after a successful display
- **THEN** Activity reports unavailable rather than an empty successful list or apparently current prior result

#### Scenario: Open while background history is pending
- **WHEN** Transactions opens while its compatible account history source is still preparing the first snapshot
- **THEN** the page shows its normal entry loading presentation and joins that source without restarting it or resetting its bounded attempt budget

### Requirement: Account-scoped activity lifecycle
Activity presentation SHALL be transient and scoped to the active account, network, and open view. List Back SHALL return to the Accounts Details submenu; its Back SHALL return to Account. Leaving Activity SHALL detach its foreground observation, clear its visible state and selection, and leave any valid account-owned observer or bounded shared preparation running. Logout, account/network replacement, reset, and disposal SHALL invalidate affected cached and pending history and stop obsolete account observation. Late results SHALL NOT repopulate a closed view or another account's state.

#### Scenario: Account changes during a request
- **WHEN** the account changes before an activity request or callback finishes
- **THEN** the prior result is ignored and no prior account entry appears for the new account

#### Scenario: Reopen Activity
- **WHEN** a player returns to Activity after leaving it
- **THEN** a complete fresh snapshot is reused or compatible pending work is joined, otherwise a fresh SDK read runs, and exactly one shared source serves compatible account and page consumers

#### Scenario: Leave during initial history preparation
- **WHEN** Transactions is closed before its shared history preparation completes
- **THEN** the closed page and its selection remain cleared while valid account-owned work may finish and cache a complete result

