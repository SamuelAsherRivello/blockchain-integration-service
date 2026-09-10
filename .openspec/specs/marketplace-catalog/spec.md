# marketplace-catalog Specification

## Purpose

Provide a public, standalone catalog for the durable Signet equipment used by the Stealth & Steel demonstration, without requiring a player account merely to explore it.

## Requirements

### Requirement: Marketplace foundation

The BIS Marketplace SHALL be a standalone React/Vite browser application in the BIS workspace. Before catalog issuance is configured, it SHALL serve a minimal public page that identifies the Marketplace and does not require an account, wallet operation, mint, transfer, or simulated market data.

#### Scenario: Visitor opens the first milestone

- **WHEN** a visitor opens the Marketplace development URL before catalog configuration
- **THEN** the visitor sees the minimal public Marketplace page
- **AND** no account dialog, wallet query, mint, transfer, or simulated market operation begins

### Requirement: Public standalone marketplace entry

The BIS Marketplace SHALL be independently serveable as a browser application and SHALL present a usable public landing page before any BIS account, wallet, balance, or ownership query is requested. Its published catalog SHALL contain the registered game-wallet public address, game ID, and item metadata, but SHALL NOT contain signing material, recovery material, or private transaction data. A visitor SHALL be able to browse the catalog and open an item detail view without logging in. The published GitHub Pages entry SHALL be available at `/blockchain-integration-service/marketplace/`, and its catalog and application resources SHALL resolve beneath that public path. Existing immutable artwork URLs under `/blockchain-integration-service/assets/` SHALL remain available so previously issued asset metadata continues to resolve.

#### Scenario: Guest opens the marketplace

- **WHEN** a visitor opens the Marketplace with no saved BIS account
- **THEN** the application presents its public page and catalog without opening an Account dialog
- **AND** no wallet, mint, transfer, or simulated trading operation is started

#### Scenario: Guest opens the published marketplace

- **WHEN** a visitor opens `https://samuelasherrivello.github.io/blockchain-integration-service/marketplace/` after deployment
- **THEN** the public landing page, catalog, and item artwork load successfully from that route
- **AND** Marketplace-owned catalog and application-resource requests resolve beneath the Marketplace route

#### Scenario: Existing asset metadata is revisited

- **WHEN** a visitor requests an already-issued Marketplace artwork URL beneath `https://samuelasherrivello.github.io/blockchain-integration-service/assets/`
- **THEN** the corresponding immutable artwork remains available
- **AND** moving the Marketplace application does not change the existing asset URL

### Requirement: Public game-wallet inventory lookup

The Marketplace SHALL use the registered game-wallet public address for anonymous, read-only lookup of the catalog assets it currently holds. A Marketplace Game Wallet Login SHALL NOT be required for that lookup. When a successful Game Wallet Login exposes a public address different from the registered address, the Marketplace SHALL use that logged-in address as the active inventory source for the current browser session, refresh availability from it, and clearly distinguish it from the registered default. It SHALL NOT alter the deployed static catalog or claim that the override changes the official published game wallet.

#### Scenario: Guest views the registered game wallet inventory

- **WHEN** a guest opens the Marketplace before any wallet login
- **THEN** the Marketplace uses the published game-wallet public address for its read-only catalog inventory lookup
- **AND** the guest can see truthful available, unavailable, or unreadable availability without providing a wallet credential

#### Scenario: Game-wallet login uses a different address

- **WHEN** the user completes Game Wallet Login and its public address differs from the registered public address
- **THEN** the Marketplace refreshes inventory and trade context from the logged-in address for that browser session
- **AND** it retains the registered address as public catalog configuration and labels the session override accurately

### Requirement: Nine durable game-equipment assets

The public catalog SHALL contain exactly these nine named equipment entries for the Stealth & Steel game ID: Shoes I, Shoes II, Shoes III; Dagger I, Dagger II, Dagger III; and Shield I, Shield II, Shield III. Each entry SHALL identify its game ID, Signet asset ID after issuance, tier, equipment family, artwork, and a player-facing effect description: Shoes increase movement speed, Daggers increase player damage, and Shields reduce player damage taken. Each higher tier SHALL describe a stronger effect than the preceding tier in the same family.

#### Scenario: Browse the complete grid

- **WHEN** a visitor views the marketplace catalog after the catalog assets have been issued
- **THEN** all nine entries appear in a stable 3 by 3 grid with distinct names, tiers, family labels, artwork, effect descriptions, and asset identities
- **AND** no item is represented as minted, owned, listed, or sold without the corresponding verified evidence

### Requirement: Game-wallet catalog batch issuance

BIS Admin SHALL provide an H. Marketplace section that is available only when the existing F. Game Wallet has an active selected wallet. H SHALL offer one explicit action to mint the complete nine-item Stealth & Steel catalog to that game wallet through the existing BIS asset-mint boundary. Each catalog record SHALL use a stable item identity and operation identity so a repeated or interrupted batch reconciles the original item issuance rather than minting a duplicate. H SHALL publish only verified public game ID, catalog item identity, asset ID, display metadata, and quantity records for Marketplace rendering; it SHALL not publish wallet recovery material, signing material, or private transaction payloads.

#### Scenario: Game wallet mints the catalog batch

- **WHEN** an Admin has selected a funded F. Game Wallet and explicitly starts the Marketplace catalog batch
- **THEN** H creates or reconciles exactly one intended issuance for each of the nine named catalog items on that wallet
- **AND** the standalone Marketplace receives public records only for items whose original issuance has a verified result

#### Scenario: Game wallet is unavailable

- **WHEN** no F. Game Wallet is selected or the selected wallet cannot mint an item
- **THEN** H prevents that item from being represented as minted in the public catalog and gives truthful unavailable or recovery feedback
- **AND** the public Marketplace remains browseable without the missing item being fabricated

### Requirement: Truthful pre-trading detail

Selecting a catalog card SHALL open its detail view with the asset identity, game effect, tier, and ownership/trading state available to the current visitor. Before the trading capability is available, Buy and Sell controls SHALL be visibly disabled; they SHALL NOT request login, create a transaction, or imply a price, sale, or listing.

#### Scenario: Guest selects an item before trading exists

- **WHEN** a logged-out visitor opens Dagger II before authenticated trading is delivered
- **THEN** the detail view describes Dagger II and displays disabled Buy and Sell controls
- **AND** the visitor can return to the public catalog without any account or wallet side effect

### Requirement: Approved catalog prices are published
The nine-item catalog SHALL publish the same integer sat price used for purchase and sell-back: Shoes I/II/III at 1,000/2,000/3,000; Dagger I/II/III at 1,100/2,100/3,100; and Shield I/II/III at 1,200/2,200/3,200. The catalog SHALL NOT add a fee or buy/sell spread.

#### Scenario: Browse the priced catalog
- **WHEN** a visitor views all nine entries
- **THEN** every entry displays its approved integer sat price
- **AND** the displayed price matches the item's verified chain metadata

### Requirement: Catalog artwork comes from chain asset URLs
Every equipment image rendered by the Marketplace SHALL request at runtime the absolute HTTPS icon URL carried by the corresponding chain asset. H1 SHALL use immutable C1-style versioned public PNG URLs so already minted metadata remains usable after later artwork revisions. A static bundled catalog-to-image mapping SHALL NOT determine the rendered item icon.

#### Scenario: Render an issued catalog item
- **WHEN** Marketplace renders an issued item with verified chain metadata
- **THEN** its image request uses that asset's chain-provided icon URL

#### Scenario: Artwork is revised later
- **WHEN** revised marketplace artwork is released
- **THEN** existing versioned URLs and their files remain available unchanged
- **AND** newly revised files use a new versioned path
