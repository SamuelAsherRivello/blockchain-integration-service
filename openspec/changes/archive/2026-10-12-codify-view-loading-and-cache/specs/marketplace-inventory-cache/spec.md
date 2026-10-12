# Spec Delta

## ADDED Requirements

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

## RENAMED Requirements

- FROM: `### Requirement: Use a wallet-scoped thirty-second cache`
- TO: `### Requirement: Use a wallet-scoped ephemeral cache`

## MODIFIED Requirements

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
