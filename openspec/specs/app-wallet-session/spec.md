# app-wallet-session Specification

## Purpose

Give each BIS app session bounded Player and optional Game wallet lifetimes that eliminate repeated wallet initialization without weakening live-read truthfulness, account isolation, or transaction safety.

## Requirements

### Requirement: Bounded role wallet ownership
BIS SHALL retain at most one active SDK wallet per Player role and one per optional Game role within an app session. Compatible consumers SHALL share initialization and the retained wallet. Player-only activity SHALL NOT initialize the Game wallet. Public-address browsing SHALL NOT require a local signing wallet.

#### Scenario: Concurrent Player consumers
- **WHEN** balance, assets, and observation need the same Player identity concurrently
- **THEN** they share one initialization and retained wallet rather than constructing separate wallets

#### Scenario: Optional Game wallet
- **WHEN** a player uses balance and assets without an eligible configured Game wallet
- **THEN** those reads proceed independently and no Game SDK wallet is created

#### Scenario: Both roles and public inventory
- **WHEN** both roles are active and Marketplace also browses another public inventory address
- **THEN** at most two role wallets exist and the public read uses no additional SDK wallet

### Requirement: Reuse across ordinary reads and navigation
For an unchanged role session, navigation, explicit Refresh, observer reconciliation, and operation preflight SHALL reuse the retained wallet. They SHALL NOT repeat wallet construction or initial ownership-registration work. Relevant live ownership synchronization SHALL remain permitted and required where freshness demands it.

#### Scenario: Warm forced refresh
- **WHEN** a ready Player session completes repeated live balance and asset refreshes
- **THEN** no additional wallet is constructed or disposed and each refresh still obtains eligible current evidence

#### Scenario: Unchanged context notification
- **WHEN** a view or status update changes no Game identity, network, or relevant wallet evidence
- **THEN** it neither rebuilds the Game wallet nor starts another Game refresh

### Requirement: Role lifecycle and generation isolation
BIS SHALL invalidate old role work on identity replacement, logout, reset, network/operator replacement, or app disposal. Late initialization, reads, notifications, and operation callbacks SHALL NOT publish into a replacement generation, including a later login using the same identity. Replacement SHALL NOT overlap active SDK wallets for the same role.

#### Scenario: Account A to B to A
- **WHEN** a delayed result from the first A session arrives after switching to B and back to A
- **THEN** it is rejected despite the matching identity and cannot populate views or caches

#### Scenario: Late initialization after logout
- **WHEN** SDK creation resolves after its role session has been invalidated
- **THEN** the created resource is retired and cannot become the active wallet

#### Scenario: Network replacement
- **WHEN** the selected network or operator changes during an asset read
- **THEN** old results and metadata hydration cannot populate the replacement role's data

### Requirement: Bounded acquisition and recovery
Wallet acquisition, live reads, and teardown SHALL have bounded outcomes. Concurrent acquisition failures SHALL NOT leave duplicate wallets or a permanently rejected acquisition slot. Caller cancellation SHALL detach that caller without disposing a valid wallet still used by other consumers. Unconfirmed cleanup SHALL prevent an overlapping replacement signer.

#### Scenario: One consumer cancels
- **WHEN** one of two consumers cancels during shared initialization or reading
- **THEN** the other retains its valid work and no consumer receives obsolete results

#### Scenario: Failed initialization can recover
- **WHEN** an acquisition fails and a later bounded retry is eligible
- **THEN** the retry can acquire one wallet without retaining the failed instance or rejected promise

### Requirement: Live freshness independent of wallet lifetime
Explicit Refresh and authoritative balance, ownership, and transaction checks SHALL bypass completed display values and require successful live evidence for the required fields and active generation. SDK-local fallback after a required provider failure SHALL NOT count as fresh success. Compatible live work can be shared only within the existing eligibility, deadline, and retry rules.

#### Scenario: Offline refresh after success
- **WHEN** the retained wallet contains a previous successful snapshot but a required live request fails
- **THEN** bounded retry and unavailable behavior apply rather than returning prior amounts, prior holdings, or a fabricated zero

#### Scenario: Failure does not poison the session
- **WHEN** a failed read is followed by a successful live read on the same retained wallet
- **THEN** the new attempt can succeed using its own freshness evidence

#### Scenario: Concurrent independent attempts
- **WHEN** history fails while an otherwise independent balance attempt has complete live evidence
- **THEN** history remains unavailable without falsely invalidating balance or hiding a balance-specific failure

#### Scenario: Incremental discovery misses an older spend
- **WHEN** an authoritative ownership refresh follows a missed event concerning an output outside the retained incremental window
- **THEN** complete live verification excludes the spent output rather than treating the retained cursor or stored holding as proof of ownership

### Requirement: Complete asset reads with scoped metadata reuse
Authoritative asset reads SHALL derive quantities from current complete ownership evidence. Validated immutable metadata can be reused only within its asset, network, and operator scope. Missing optional metadata SHALL remain truthful missing metadata; failure of a required uncached metadata lookup SHALL NOT produce a partial successful inventory.

#### Scenario: Same asset metadata with changed holdings
- **WHEN** a new live read changes an asset quantity and validated immutable metadata is already available
- **THEN** the current quantity is returned with that metadata without treating cached ownership as current

#### Scenario: Uncached metadata unavailable
- **WHEN** a required asset-details request fails after current holdings are obtained
- **THEN** the listing follows its bounded failure contract rather than omitting the affected holding

### Requirement: Shared observation without duplicated wallet ownership
Role observations SHALL borrow the retained role wallet and share the required underlying observation lifetime. View navigation SHALL NOT add another network observer. Detaching a consumer SHALL stop its callbacks without disposing the common wallet. Missed-event reconciliation and existing event-driven refresh behavior SHALL remain intact.

#### Scenario: Views close and reopen
- **WHEN** Assets and Transactions are opened, closed, and reopened within the same Player session
- **THEN** their consumers attach and detach without extra wallet creation, duplicate network observation, or replayed receipt notifications

### Requirement: Transaction safety on retained wallets
Wallet reuse SHALL preserve existing consent, live spendability checks, operation serialization, reservations, cross-instance coordination, and transaction checkpoints. Reads and wallet acquisition SHALL NOT submit transactions. Automatic SDK settlement SHALL remain disabled; transaction-specific hooks SHALL NOT affect unrelated or later work.

#### Scenario: Cached balance cannot authorize payment
- **WHEN** a user submits a payment while a recent display balance exists
- **THEN** existing live validation and locking apply before submission on the retained role wallet

#### Scenario: Concurrent asset and payment work
- **WHEN** asset mutation, payment, and read requests overlap
- **THEN** required exclusive phases are serialized, reserved inputs cannot be double-selected, and operation hooks cannot leak across requests

### Requirement: Submitted operations survive presentation cancellation safely
Ordinary session retirement or view cancellation SHALL NOT misreport a submitted transaction as cancelled, discard recovery records, or trigger duplicate submission. Retiring wallets SHALL reject new leases and prevent overlapping active signers. Explicit user-requested local logout cleanup SHALL follow its existing contract rather than ordinary retirement's record-retention rule.

#### Scenario: Logout after submission
- **WHEN** logout occurs after submission but before confirmation or SDK cleanup
- **THEN** old callbacks cannot update the logged-out UI or recreate deliberately deleted records, no overlapping active signer is created, and logout is not reported as network cancellation or confirmation

### Requirement: Deliberate logout without settlement waits
Explicit logout SHALL remain available despite pending or uncertain transactions. Existing risk checkboxes SHALL record acknowledgement without adding a settlement or reconciliation prerequisite. The selected profile's local cleanup SHALL follow the existing logout contract; submitted transactions SHALL NOT be described as cancelled or completed by logout. Admin Reset's separate guards SHALL remain unchanged.

#### Scenario: User accepts pending-loss risks
- **WHEN** a user checks the applicable risk acknowledgements and selects Log Out while a transaction remains unresolved
- **THEN** local logout proceeds without waiting for network confirmation and removes the selected profile's local material according to the existing cleanup contract

#### Scenario: Checkbox state is informational
- **WHEN** an applicable warning checkbox is unchecked or warning discovery is unavailable
- **THEN** this refactor does not add a new logout gate and does not require an operator response to complete local cleanup

#### Scenario: Retired signer has not safely stopped
- **WHEN** local logout completes but SDK signer termination cannot yet be confirmed
- **THEN** old publication and further submission are blocked and replacement signing remains unavailable until safe, without undoing logout or waiting for network settlement

### Requirement: Creation and restoration use role slots
App-session account creation and restoration SHALL use the target role slot rather than a third verification wallet. Validation failure SHALL NOT commit a replacement identity or erase the prior saved identity. Successful activation SHALL hand off the validated wallet for subsequent reads without reconstructing it.

#### Scenario: Successful restore
- **WHEN** a restored account passes validation and becomes active
- **THEN** its validated role wallet serves subsequent balance and asset reads without another wallet construction

#### Scenario: Invalid replacement
- **WHEN** replacement validation fails
- **THEN** prior saved account data remains intact and no extra verification wallet remains active

### Requirement: Private session resources and existing UI policies
SDK wallets, signing material, and repositories SHALL remain private to integration. Retained resources SHALL NOT persist live wallet snapshots or secrets in diagnostic output. Existing view loading, ephemeral cache eligibility, role access, and guest-play behavior SHALL remain unchanged.

#### Scenario: Guest and disconnected app
- **WHEN** no player account is active or the provider is unavailable
- **THEN** guest play remains possible and no Game wallet or signing operation is required to render it

### Requirement: Standalone test-tool compatibility
Existing standalone account creation, live observations, and exact receipt verification SHALL remain supported through bounded adapter lifetimes without accessing a browser app's private wallets. The app-session wallet budget SHALL apply independently to each browser composition. Refactoring SHALL NOT weaken registered-test guards, joined-session restrictions, or durable operation accounting.

#### Scenario: CLI observation alongside a browser
- **WHEN** the registered test runner performs a read-only live observation while a two-role browser app is active
- **THEN** each owns its independent bounded resources, no browser wallet or phrase is exported, and the runner preserves current unavailable/pending evidence rather than assuming readiness

### Requirement: Verifiable warm-read overhead
Verification SHALL distinguish cold acquisition, warm forced-live balance, warm forced-live assets, metadata hydration, cache hits, and provider waits. Warm refresh verification SHALL demonstrate zero additional wallet constructions and no unrelated Game/history dependency. Latency reports SHALL identify provider conditions and SHALL NOT label cached or post-initialization timings as cold live timings.

#### Scenario: Prototype comparison
- **WHEN** BIS and the prototype are compared using matched provider, network, identity, and inventory conditions
- **THEN** results separately report initialization and read phases, wallet/request counts, and warm latency distributions, with any remaining delay attributed to observed phases rather than an assumed cause
