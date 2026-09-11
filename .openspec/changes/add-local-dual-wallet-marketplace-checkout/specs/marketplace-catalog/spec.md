## MODIFIED Requirements

### Requirement: Public standalone marketplace entry
The BIS Marketplace SHALL be independently serveable as a browser application and SHALL present a usable public landing page before any BIS account, wallet, balance, or ownership query is requested. Its published publisher configuration SHALL contain only the registered Game Wallet public address and game ID required to identify the official inventory source; it SHALL NOT contain signing material, recovery material, private transaction data, or a per-item static inventory snapshot. A visitor SHALL be able to browse the runtime-derived catalog and open an item detail view without logging in. The published GitHub Pages entry SHALL be available at `/blockchain-integration-service/marketplace/`, and its publisher configuration and application resources SHALL resolve beneath that public path. Existing immutable artwork URLs under `/blockchain-integration-service/assets/` SHALL remain available so previously issued asset metadata continues to resolve.

#### Scenario: Guest opens the marketplace
- **WHEN** a visitor opens the Marketplace with no saved BIS account
- **THEN** the application presents its public page and runtime-derived catalog without opening an Account dialog
- **AND** no wallet, mint, transfer, or simulated trading operation is started

#### Scenario: Guest opens the published marketplace
- **WHEN** a visitor opens `https://samuelasherrivello.github.io/blockchain-integration-service/marketplace/` after deployment
- **THEN** the public landing page, publisher configuration, runtime-derived catalog, and item artwork load successfully from that route
- **AND** Marketplace-owned configuration and application-resource requests resolve beneath the Marketplace route

#### Scenario: Existing asset metadata is revisited
- **WHEN** a visitor requests an already-issued Marketplace artwork URL beneath `https://samuelasherrivello.github.io/blockchain-integration-service/assets/`
- **THEN** the corresponding immutable artwork remains available
- **AND** moving the Marketplace application does not change the existing asset URL

### Requirement: Nine durable game-equipment assets
The Marketplace SHALL derive available Stealth & Steel equipment from the current public inventory of the registered Game Wallet and each asset's verified runtime chain metadata, not from a per-item static catalog snapshot. It SHALL recognize only these nine named equipment definitions for the Stealth & Steel game ID: Shoes I, Shoes II, Shoes III; Dagger I, Dagger II, Dagger III; and Shield I, Shield II, Shield III. Each displayed entry SHALL identify its game ID, Signet asset ID, tier, equipment family, chain-provided artwork, and player-facing effect description: Shoes increase movement speed, Daggers increase player damage, and Shields reduce damage taken. Each higher tier SHALL describe a stronger effect than the preceding tier in the same family.

#### Scenario: Runtime inventory changes after publishing
- **WHEN** an Admin mints a recognized item into the registered Game Wallet after the publisher configuration has already been deployed
- **THEN** a later Marketplace inventory refresh can display that item from its current public chain inventory without a per-item configuration update or redeployment
- **AND** an item no longer owned by that Game Wallet is not shown as available for purchase

#### Scenario: Browse the complete grid
- **WHEN** a visitor views the marketplace after the registered Game Wallet currently holds all issued catalog assets
- **THEN** all nine entries appear in a stable 3 by 3 grid with distinct names, tiers, family labels, artwork, effect descriptions, and asset identities
- **AND** no item is represented as minted, owned, listed, or sold without the corresponding verified evidence

### Requirement: Game-wallet catalog batch issuance
BIS Admin SHALL provide an H. Marketplace section that is available only when the existing F. Game Wallet has an active selected wallet. H SHALL offer one explicit action to mint the complete nine-item Stealth & Steel catalog to that game wallet through the existing BIS asset-mint boundary. Each issuance SHALL use a stable item identity and operation identity so a repeated or interrupted batch reconciles the original item issuance rather than minting a duplicate. H SHALL verify and report only the successful on-chain item records; it SHALL not publish per-item catalog state, wallet recovery material, signing material, or private transaction payloads. The deployed publisher configuration remains an explicit release-time trust anchor for the registered Game Wallet address.

#### Scenario: Game wallet mints the catalog batch
- **WHEN** an Admin has selected a funded F. Game Wallet and explicitly starts the Marketplace catalog batch
- **THEN** H creates or reconciles exactly one intended issuance for each of the nine named catalog items on that wallet
- **AND** a Marketplace using that registered public address can discover verified available items through its fresh public inventory lookup

#### Scenario: Game wallet is unavailable
- **WHEN** no F. Game Wallet is selected or the selected wallet cannot mint an item
- **THEN** H gives truthful unavailable or recovery feedback and does not fabricate an issuance result
- **AND** the public Marketplace remains browseable without representing the missing item as available
