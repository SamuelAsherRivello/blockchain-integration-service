# marketplace-inventory-cache Specification

## Purpose

Keep the Marketplace responsive while it obtains public item inventories from the Player Wallet and Game Wallet independently.

## Requirements

### Requirement: Maintain independent wallet inventories

The Marketplace SHALL maintain separate public inventory results for the Player Wallet and Game Wallet. A refresh SHALL begin eligible reads for both wallets asynchronously without requiring the result of one wallet before starting the other. Each result SHALL retain its own loading, success, empty, unavailable, and timestamp state.

#### Scenario: Both wallets are available

- **WHEN** the Marketplace refreshes with both wallet sessions available
- **THEN** it starts both reads independently
- **AND** a completed Player Wallet read does not wait for or replace the Game Wallet result
- **AND** a completed Game Wallet read does not wait for or replace the Player Wallet result

#### Scenario: One wallet is unavailable

- **WHEN** one wallet read fails while the other succeeds
- **THEN** the successful wallet retains its result
- **AND** the failed wallet retains an unavailable state
- **AND** the Marketplace does not represent the failed wallet as an empty inventory

### Requirement: Use a wallet-scoped ephemeral cache

BIS SHALL retain only complete successful public inventory in memory for five minutes, scoped by role, profile identity, network, data type and exact public address when queried. Marketplace SHALL NOT persist inventory in browser storage. Explicit Refresh SHALL bypass completed data and join compatible live work; lifecycle or relevant evidence changes SHALL invalidate obsolete work. A newer Account Assets read SHALL supersede prior empty Player inventory.

#### Scenario: Refresh within the freshness window
- **WHEN** a wallet has a complete successful inventory less than five minutes old
- **THEN** BIS SHALL reuse it without another provider request unless explicitly refreshed or invalidated

#### Scenario: Page refresh and new tab
- **WHEN** Marketplace reloads or opens in another document
- **THEN** it SHALL perform or join fresh preparation in that document rather than restore persisted inventory

#### Scenario: Cache expires
- **WHEN** a successful entry is five minutes old or older
- **THEN** the next consumer SHALL obtain fresh inventory for that wallet without disturbing the other role

#### Scenario: Fresh BIS Assets read supersedes empty cache
- **WHEN** Account Assets completes with positive holdings for the same Player Wallet and network
- **THEN** Marketplace SHALL use that current shared ownership evidence rather than a prior empty result

### Requirement: Scope visible loading to the selected ownership tab

The Marketplace SHALL show its loading prompt only while the currently selected ownership tab lacks a usable fresh result and its corresponding wallet read is pending. A pending or unavailable read for the non-selected wallet SHALL NOT block the selected wallet's usable cached or fresh result.

#### Scenario: Player Wallet tab

- **WHEN** the Player Wallet tab is selected
- **THEN** the loading prompt waits only for the Player Wallet result
- **AND** a pending Game Wallet read does not keep the prompt visible after the Player Wallet result is ready

#### Scenario: Game Wallet tab

- **WHEN** the Game Wallet tab is selected
- **THEN** the loading prompt waits only for the Game Wallet result
- **AND** a pending Player Wallet read does not keep the prompt visible after the Game Wallet result is ready

#### Scenario: Rapid tab switching

- **WHEN** the user switches between Player Wallet and Game Wallet while both reads are pending or cached
- **THEN** each tab displays its own pending, cached, successful, or unavailable state
- **AND** switching tabs does not discard the other wallet's result or start a duplicate read within its fresh-cache window

### Requirement: Report selected-wallet failures explicitly

When the selected wallet cannot be read and has no usable fresh result, the Marketplace SHALL replace the loading prompt with an explicit error prompt. The error prompt SHALL identify that the selected wallet inventory is unavailable and SHALL offer a safe retry or refresh action. The Marketplace SHALL NOT silently show an empty state or claim that no items exist.

#### Scenario: Selected wallet read fails

- **WHEN** the selected wallet read returns unavailable or fails before producing a usable result
- **THEN** the loading prompt is removed
- **AND** an error prompt is shown for that wallet
- **AND** the other wallet's successful or pending state remains independent

#### Scenario: Retry after failure

- **WHEN** the user retries an unavailable selected-wallet read
- **THEN** only that wallet's expired or unavailable result is retried
- **AND** the other wallet's cached or active read is preserved

### Requirement: One bounded inventory attempt with explicit recovery
Marketplace inventory preparation SHALL perform one bounded read per wallet, sharing overlapping work without extending its deadline. Failure SHALL settle as unavailable and remain actionable until explicit Retry or a relevant ownership/session change. Retry SHALL start fresh work. Cancel SHALL dismiss the error without starting loading or clearing wallet data. Other errors SHALL retain allowCancel=false by default.

#### Scenario: Provider never settles
- **WHEN** a wallet inventory provider remains pending past the deadline
- **THEN** loading ends and a readable enabled Retry action and Cancel action appear
- **AND** the abandoned request cannot publish a late result

#### Scenario: Explicit retry succeeds
- **WHEN** Retry is clicked after failure and the next provider read succeeds
- **THEN** one fresh loading attempt replaces the error and reveals the returned items
- **AND** no other wallet read is restarted

#### Scenario: Cancel leaves browsing available
- **WHEN** Cancel is clicked on an inventory error
- **THEN** the modal closes and the Marketplace remains navigable without a new read

### Requirement: Marketplace consumes BIS inventory preparation

Marketplace SHALL request Player Wallet and Game Wallet inventory through public BIS preparation APIs. Marketplace SHALL NOT call an Arkade provider/indexer directly and SHALL NOT own a browser-storage inventory cache. BIS preparation SHALL expose the shared cache, in-flight joining, freshness, identity, network, role, and invalidation semantics to the page.

#### Scenario: Marketplace uses Account Assets preparation

- **WHEN** Account Assets has completed a compatible Player Wallet ownership preparation for the same account and network within the freshness window
- **THEN** Marketplace SHALL obtain that result through BIS without issuing an unrelated Player Wallet ownership request

#### Scenario: Game Wallet preparation uses BIS lifecycle

- **WHEN** Marketplace needs Game Wallet inventory
- **THEN** it SHALL ask a public BIS preparation API to read the selected public address, retaining guest catalog browsing without requiring a signer
- **AND** the Game Wallet preparation SHALL use BIS-owned cache and in-flight coordination rather than a Marketplace-local provider read

### Requirement: Marketplace loads wallet inventories independently

Marketplace SHALL maintain separate Player Wallet and Game Wallet inventory records, each scoped to its wallet profile, active network, and inventory data type. When both wallet sessions are eligible on entry, Marketplace SHALL begin both public inventory reads asynchronously without waiting for either result before starting the other. A completed result for one wallet SHALL NOT clear, replace, or delay the other wallet's record.

#### Scenario: Default Game Wallet arrives first

- **WHEN** Marketplace opens with both wallet sessions active and the Game Wallet read completes before the Player Wallet read
- **THEN** the default Game Wallet tab may render its complete items or empty result immediately
- **AND** the pending Player Wallet read continues independently

#### Scenario: Player Wallet arrives first

- **WHEN** the Player Wallet read completes before the Game Wallet read
- **THEN** its result remains available for the Player Wallet tab
- **AND** the pending Game Wallet read does not replace it with an empty state

### Requirement: Selected-owner loading is truthful

Marketplace SHALL determine loading, empty, and unavailable presentation from the selected Owner tab's record. A selected wallet with an idle or loading read SHALL show loading coverage. A selected wallet with a successful zero-item result SHALL show the empty message. A selected wallet with a failed read and no usable prior result SHALL show an explicit unavailable/retry state. A fixed elapsed-time gate SHALL NOT convert an unresolved read into an empty result.

#### Scenario: Switch to a pending wallet

- **WHEN** the user switches to Player Wallet or Game Wallet while that wallet's read is still pending
- **THEN** Marketplace SHALL show the loading presentation for the selected wallet
- **AND** it SHALL NOT show the empty-state message before the read reaches a terminal state

#### Scenario: Switch to a ready wallet

- **WHEN** the selected wallet already has a fresh complete result
- **THEN** Marketplace SHALL render that wallet's items immediately without starting another provider read

### Requirement: Shared wallet-scoped cache and in-flight work

Marketplace SHALL reuse the shared BIS asset preparation/cache lifecycle for Player Wallet and Game Wallet public inventory. Complete successful results SHALL be cached only in BIS memory for the configured freshness window and scoped by wallet profile, network, role, data type, and exact address for public-address queries. Pending compatible work SHALL be joined rather than duplicated. Failed, partial, obsolete, or cross-account results SHALL NOT be cached. Marketplace local storage SHALL NOT be a second source of truth.

#### Scenario: Cache reuse across Account Assets and Marketplace

- **WHEN** BIS Account Assets has completed a compatible Player Wallet ownership read and the user opens Marketplace on the same account and network within the freshness window
- **THEN** Marketplace SHALL reuse that result without an unrelated ownership request

#### Scenario: Cache expiry

- **WHEN** a wallet inventory cache entry expires
- **THEN** the next eligible Marketplace read SHALL request fresh public inventory for that wallet only
- **AND** the other wallet's fresh or pending record SHALL remain unaffected

### Requirement: Tab changes do not force duplicate reads

Selecting an Owner tab SHALL select that wallet's existing record. It SHALL NOT unconditionally retry or clear a ready result. Explicit retry SHALL bypass only the selected wallet's completed cache and preserve the other wallet's result.

#### Scenario: Rapid tab switching

- **WHEN** the user switches repeatedly between Game Wallet and Player Wallet while reads are pending or cached
- **THEN** each tab SHALL show its own loading, ready, empty, or unavailable state
- **AND** no duplicate provider read SHALL start within the active in-flight or freshness window
