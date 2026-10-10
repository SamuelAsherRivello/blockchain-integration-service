# view-loading-policy Specification

## Purpose

Provide consistent construction-aware loading and safe short-lived reuse for data-backed BIS views without delaying network reads or persisting live wallet facts.

## Requirements

### Requirement: Entry reads start immediately
When a supported data-backed view is entered, BIS SHALL immediately resolve its required data through a fresh complete cache result, a compatible in-flight read, or a newly started foreground read, before waiting for the view-construction presentation gate. Joining a background read SHALL not restart provider work, reset its deadline, or duplicate its retries. Foreground entry SHALL not wait for unrelated speculative jobs.

#### Scenario: Send entry
- **WHEN** the user opens Send without a compatible result or active balance read
- **THEN** the Send balance read starts immediately even though its loading dialog presentation is gated

#### Scenario: Send joins a warm balance
- **WHEN** the user opens Send while its compatible balance dependency is already being read in the background
- **THEN** Send attaches to that dependency, shows its normal construction-gated loading UI while pending, and receives its result without another provider read

#### Scenario: Account Details joins warm preparation
- **WHEN** Account Details opens while its balance or address dependencies remain pending
- **THEN** it joins the compatible work, remains interactive with dash placeholders and its active refresh affordance, and does not open a Pending Operation Dialog

### Requirement: Entry loading waits for construction
When a modal-policy entry is being prepared, BIS SHALL show its loading dialog only after the destination view has mounted and completed its first browser frame, whether preparation is waiting on a provider read or a complete cached result. The cached result SHALL be revealed immediately after that gate. BIS SHALL NOT use a fixed time delay to approximate construction completion.

#### Scenario: Slow Receive entry
- **WHEN** Receive mounts and its address read remains pending
- **THEN** Receive paints first and the loading dialog appears after the first completed frame

#### Scenario: Fast or cached Contracts entry
- **WHEN** Contracts finishes its initial read before the construction gate opens, or a complete cached result is available on entry
- **THEN** Contracts shows its normal brief construction-gated loading presentation and then reveals the ready page without another provider read for the cache-hit case

### Requirement: Entry-gated view scope
The construction gate SHALL apply to initial foreground reads for Receive, Send, Swap, Assets, Contracts, Transactions, and Get Recovery Phrase. It SHALL NOT delay loading for explicit operations inside an already-visible view, background reconciliation, Account Details' non-modal balance placeholders, Onboarding's nonblocking observations, static views, or Marketplace bootstrap coverage.

#### Scenario: Immediate explicit refresh
- **WHEN** the user activates Refresh from an already-visible Receive, Assets, Contracts, or Transactions view
- **THEN** the fresh read and its existing loading presentation begin immediately without the entry gate

#### Scenario: Background update
- **WHEN** a background wallet observation refreshes an already-prepared page
- **THEN** the page remains usable and no entry loading dialog is opened

### Requirement: Successful results use an ephemeral cache
When enabled for a data-backed view, BIS SHALL retain only complete successful results in memory for five minutes by default, scoped by account identity, selected network, and data type. The cache SHALL support separate balance, receive-address, asset, contract, transaction, and operation-read data types. Failed, partial, unavailable, or obsolete results SHALL NOT enter the cache, and cached live wallet data SHALL NOT be persisted to browser storage.

#### Scenario: Return within freshness window
- **WHEN** the user leaves a successfully loaded view and returns within the freshness window for the same account, network, and data type
- **THEN** BIS reveals the complete cached result without starting another provider read; modal-policy views use their normal construction-gated loading presentation before revealing it, while non-modal views remain immediately usable

#### Scenario: Account isolation
- **WHEN** the active account or selected network changes
- **THEN** cached data from the previous identity or network cannot populate the replacement view

### Requirement: Explicit refresh bypasses cache
An explicit Refresh SHALL bypass the affected completed cached result and request live data, even when a recent successful result is available. It SHALL join an already-running compatible live request if that request remains valid for the required fields, account generation, network, and latest evidence. Otherwise it SHALL supersede obsolete work and start a new bounded read. Refresh loading SHALL begin immediately under the view's existing modal or non-modal policy.

#### Scenario: Refresh after cached success
- **WHEN** the user activates Refresh while a fresh cached result exists and no eligible live read is running
- **THEN** BIS starts a new bounded read and does not present the cached result as the result of that refresh

#### Scenario: Refresh adopts current live preparation
- **WHEN** the user activates Refresh while a compatible live background request remains valid and no relevant evidence has changed since it started
- **THEN** Refresh bypasses the completed value, joins that request with its remaining budget, and starts no duplicate provider call

#### Scenario: Refresh after an invalidation
- **WHEN** a pending request predates relevant wallet evidence or an account-generation change
- **THEN** Refresh uses replacement work and ignores the obsolete completion

### Requirement: Cache invalidation follows lifecycle and evidence changes
BIS SHALL invalidate affected cached results and pending requests on logout, reset, disposal, relevant wallet evidence changes, and account or network replacement. Explicit Refresh SHALL bypass completed values using its live-request eligibility rules. Send, receive, swap/transfer, asset mint/burn/delivery, contract mutation, incoming-wallet observation, and transaction-history observation SHALL invalidate the directly affected data type and its declared dependents. Identical healthy observation snapshots SHALL NOT repeatedly invalidate or restart current work solely because they were re-emitted.

Leaving a page SHALL invalidate its presentation subscription and prevent delayed visible updates, while valid context-owned shared work can continue and populate the cache. An actual request invalidation SHALL prevent its late result from revealing content or repopulating memory. Repeated unchanged observations SHALL NOT refresh a cached result's successful-read timestamp without fresh verification.

#### Scenario: Obsolete late result
- **WHEN** an account changes or relevant evidence invalidates a shared read before it completes
- **THEN** the late result cannot update the replacement view or create a reusable cache entry

#### Scenario: Detached page with valid shared work
- **WHEN** a view is closed while its shared read remains valid for the active account and network
- **THEN** completion may populate the ephemeral cache but cannot reopen or update the closed view

#### Scenario: Wallet operation invalidates dependent snapshots
- **WHEN** a send, receive, swap/transfer, asset operation, contract mutation, or incoming wallet event is initiated or observed
- **THEN** the affected cached snapshot and obsolete pending work are discarded and the next eligible consumer requests or joins current data

#### Scenario: Unrelated data remains reusable
- **WHEN** an asset event invalidates the asset snapshot
- **THEN** an unrelated fresh receive-address snapshot remains eligible for reuse

#### Scenario: Cached data does not authorize mutation
- **WHEN** a user begins a send, swap/transfer, or contract action while a cached snapshot is fresh
- **THEN** the review or submission boundary performs live validation instead of treating the cached snapshot as authorization

#### Scenario: Repeated healthy observation
- **WHEN** an observer publishes identical wallet evidence while compatible preparation is pending
- **THEN** the read continues with its existing deadline rather than repeatedly being invalidated and restarted

### Requirement: Every data-backed view declares an explicit policy
Every data-backed BIS view SHALL declare automatic loading, modal coverage, and cache reuse explicitly, including intentional exceptions for Account Details, Onboarding, Recovery Phrase, Marketplace bootstrap, and static views. A view without an override SHALL use automatic loading, non-modal coverage, and cached entry reuse.

#### Scenario: Policy audit
- **WHEN** a data-backed view is added or its entry lifecycle changes
- **THEN** its automatic, modal, and cache behavior is visible in the shared policy declarations and covered by a focused test

### Requirement: Account Details remains usable during balance loading
Account Details SHALL use non-modal loading placeholders for automatic and explicit balance reads. A complete balance-and-address snapshot SHALL be reusable on re-entry for five minutes when scoped to the same account and network; applying that snapshot SHALL not show the refresh spinner or start a provider read. Explicit Refresh SHALL invalidate that combined snapshot and perform a live read. Each unavailable identity or balance value SHALL render as a single dash; a failed, partial, expired, or cross-account result SHALL NOT appear as zero or as the previous amount. The page and its prepared controls SHALL remain usable while the bounded read is active.

#### Scenario: Pending Account Details read
- **WHEN** Account Details starts an automatic or explicit balance read
- **THEN** unavailable values show a dash, the page remains interactive, and no Pending Operation Dialog covers it

#### Scenario: Cached Account Details re-entry
- **WHEN** the player reopens Account Details within five minutes after a complete balance-and-address read for the same account and network
- **THEN** the cached fields appear without a provider read, without the refresh spinner, and without a Pending Operation Dialog

#### Scenario: Account Details explicit refresh
- **WHEN** the player activates Refresh after a complete Details snapshot is cached
- **THEN** the combined snapshot is bypassed, the refresh icon spins for the live read, and the fields remain usable with placeholders while that read is pending

### Requirement: Refresh affordances reflect active reads
When a view exposes Refresh, its control SHALL be disabled and visibly muted while the associated foreground read is active, and its refresh icon SHALL spin until success, failure, cancellation, or view exit. Reduced-motion preferences SHALL disable rotation while retaining the muted disabled state and accessible label.

#### Scenario: Read terminal state
- **WHEN** a foreground read reaches any terminal state
- **THEN** the refresh control becomes available according to the view's existing policy and its loading animation stops
