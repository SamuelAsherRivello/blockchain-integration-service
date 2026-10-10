# Spec Delta

## MODIFIED Requirements

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

