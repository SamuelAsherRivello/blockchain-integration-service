# background-caching Specification

## Purpose
Prepare likely account destinations in the background and reuse work already in progress when the user navigates, while preserving truthful loading, account isolation, and live financial validation.

## Requirements

### Requirement: Warm-up begins after account activation
BIS SHALL begin eligible background preparation only after the account is active with a verified profile, account generation, and selected network. Warm-up SHALL run independently of opening Account and SHALL NOT delay account readiness, mounting, or gameplay.

#### Scenario: Remembered account becomes active
- **WHEN** a remembered account finishes hydration on its selected network
- **THEN** its eligible warm-up starts without waiting for Account to open or extending the readiness promise

#### Scenario: Guest or incomplete account
- **WHEN** there is no active account, no selected network, or creation/restoration is incomplete
- **THEN** speculative account-data reads do not begin

### Requirement: Warm likely destinations in a bounded order
BIS SHALL prioritize complete balance and receiving addresses, then missing Transactions data, then missing passive Contracts data, then eligible Assets data. Existing compatible observer results or active reads SHALL satisfy queued work. At most one speculative preparation job SHALL run at a time; independent required observers and foreground work SHALL retain their own lifecycles.

#### Scenario: Cold active account
- **WHEN** an active account has no reusable view data
- **THEN** balance and addresses are prepared first, later jobs are considered in the declared order, and eligible work continues after an earlier job fails

#### Scenario: History already supplied by observation
- **WHEN** the existing account observer has a complete current history snapshot or a history read already in progress
- **THEN** Transactions preparation adopts that snapshot or read without creating another history source

### Requirement: Assets warming requires relevant demand
BIS SHALL warm Assets only when an existing item or inventory consumer requests ownership data or the user has expressed Assets interest during the current account session. Generic browser capability alone SHALL NOT create inventory demand. This eligibility SHALL NOT require persisted navigation history or usage telemetry.

#### Scenario: Account used only for payments
- **WHEN** an account has no item/inventory consumer and Assets has not been visited in its current session
- **THEN** startup warming does not request ownership data

#### Scenario: Existing inventory consumer
- **WHEN** equipment or another eligible consumer requests the active account's ownership data
- **THEN** its compatible read also prepares Assets without a duplicate ownership request

### Requirement: Navigation joins compatible in-flight work
On entering a data-backed page, BIS SHALL immediately join compatible pending work for the required account, network, account generation, query, and evidence version. Joining SHALL promote that work to foreground priority without restarting its provider call, resetting its deadline, or creating another retry sequence. If no compatible work or fresh complete result exists, foreground preparation SHALL start immediately.

#### Scenario: Receive opens during address warming
- **WHEN** the user opens Receive while its compatible background address read is pending
- **THEN** Receive joins that read, presents its normal entry loading UI, and receives its result without a second address request

#### Scenario: Background work is queued
- **WHEN** the user opens a page whose preparation is queued behind other speculative work
- **THEN** its foreground preparation starts immediately rather than waiting for the speculative queue

### Requirement: Related views reuse complete dependencies
Details, Receive, Send, and Swap entry preparation SHALL share compatible balance and address dependencies. Each consumer SHALL await only its required fields. Details SHALL become complete only when all its balance and address fields are valid for the same account lifecycle and current dependency versions.

#### Scenario: Balance finishes before addresses
- **WHEN** balance preparation succeeds while the address read remains pending
- **THEN** Send can consume that complete balance without waiting for addresses, and Details remains incomplete until its addresses are ready

#### Scenario: Details opens during a balance-only read
- **WHEN** Details opens while a compatible balance read is pending and addresses are missing
- **THEN** it joins the balance read, starts only the missing address dependency, and reveals a complete Details result only after both succeed

### Requirement: Shared request lifetime survives page detachment
Leaving a page SHALL detach its presentation consumer and clear its visible state and selection. A still-valid context-owned read SHALL continue within its original bounded lifetime and SHALL be allowed to populate the ephemeral cache. Only consumers still attached to the matching presentation session SHALL receive visible updates.

#### Scenario: Leave and return while warming
- **WHEN** a user opens Assets during warming, leaves before completion, and returns before the same valid read completes
- **THEN** the returning page joins that read, the closed page receives no updates, and provider work is not restarted

#### Scenario: Read finishes without an open page
- **WHEN** a valid shared read finishes after its page consumer detaches
- **THEN** its complete result can be cached without opening a page, dialog, or notification

### Requirement: Invalidation rejects obsolete work
Account or network replacement, logout, reset, disposal, and relevant new wallet evidence SHALL invalidate affected completed and pending data. Results started before an applicable invalidation SHALL NOT populate memory or visible state. Unaffected dependencies SHALL remain reusable.

#### Scenario: Evidence changes during preparation
- **WHEN** new wallet evidence invalidates a pending balance while its provider call is running
- **THEN** a consumer requests or joins replacement work and the old completion cannot overwrite that work or repopulate the balance or Details cache

#### Scenario: Account changes and a provider ignores cancellation
- **WHEN** an old provider request resolves after account replacement despite an abort signal
- **THEN** neither the new account's cache nor its page receives the old result

### Requirement: Background failures are silent and foreground failures are bounded
Background-only failures SHALL leave no reusable success and SHALL NOT display a dialog, toast, or account error. A foreground consumer attached before failure SHALL receive the existing page-specific error and bounded retry behavior. Promotion SHALL retain elapsed time and consumed attempts; it SHALL NOT grant a fresh retry budget.

#### Scenario: Foreground joins during the retry
- **WHEN** a user opens Transactions during the second attempt of its background preparation
- **THEN** the page adopts the remaining attempt and its original 75-second attempt deadline, with no third automatic attempt caused by navigation

#### Scenario: Warm-up already failed before navigation
- **WHEN** background preparation has terminated unsuccessfully before the page is opened
- **THEN** navigation starts a normal foreground read because no usable result or active request exists

### Requirement: Speculative work yields to user work
Foreground navigation SHALL take priority over queued speculative work. While an explicit wallet mutation is active, BIS SHALL pause starting additional speculative provider jobs. Existing compatible requests SHALL remain adoptable; promotion or unrelated navigation alone SHALL NOT cancel them.

#### Scenario: User begins Send review
- **WHEN** Send review or another explicit wallet operation starts while additional warm-up jobs are queued
- **THEN** that operation starts normally and queued speculative provider jobs wait until the foreground operation ends

### Requirement: Warming uses passive data reads
Speculative preparation SHALL be read-only and SHALL NOT reveal recovery phrases, create invoices, prepare quotes, submit wallet operations, or trigger contract reconciliation. Cached values SHALL serve presentation only; review, spending, equipment changes, and contract actions SHALL retain their required live checks.

#### Scenario: Pending contract restored at startup
- **WHEN** passive Contracts preparation encounters an unresolved saved agreement
- **THEN** it reports its known state and evidence freshness without submitting, refunding, reconciling, or replaying operation feedback

#### Scenario: Cached balance precedes Send confirmation
- **WHEN** Send was prepared using a warm balance
- **THEN** its review and confirmation still perform the live validation required by the sending workflow

### Requirement: Warm-up is finite and memory-only
Only complete successful presentation results SHALL be cached, for five minutes by default. Successful empty collections SHALL count as complete; partial, failed, unavailable, or obsolete results SHALL not. Warming SHALL NOT add background polling, automatic TTL refill, cross-tab request sharing, or persistence of wallet snapshots.

#### Scenario: Cache expires while idle
- **WHEN** a warm entry expires and there is no consumer requesting it
- **THEN** no provider read starts solely because the TTL elapsed

#### Scenario: Empty collection succeeds
- **WHEN** a complete ownership or history read returns no records
- **THEN** its empty result can be reused and remains distinguishable from an unavailable read

### Requirement: Existing consumer boundaries retain ownership
Marketplace SHALL retain ownership of its catalog and role-specific inventory caches. Onboarding and Game Wallet SHALL retain their existing observation and operation lifecycles. Shared data reuse SHALL NOT create extra observers, extend warming into other accounts, or make these owners wait for the speculative queue.

#### Scenario: Marketplace mounts with Player and Game Wallets
- **WHEN** Marketplace starts its existing inventory preparation
- **THEN** its selected-wallet loading and cache policies remain intact, and BIS warming does not add a second Marketplace inventory warmer
