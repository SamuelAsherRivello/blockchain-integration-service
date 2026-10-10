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

The BIS Marketplace SHALL be independently serveable as a browser application and SHALL present a usable public landing page before any BIS account, wallet, balance, or ownership query is requested. Its published catalog SHALL contain the registered game-wallet public address, game ID, and item metadata, but SHALL NOT contain signing material, recovery material, or private transaction data. A visitor SHALL be able to browse the catalog and open an item detail view without logging in. The published GitHub Pages entry SHALL be available at `/blockchain-integration-service/marketplace/`, and its catalog and application resources SHALL resolve beneath that public path. Existing immutable artwork URLs under `/blockchain-integration-service/assets/` SHALL remain available so previously issued asset metadata continues to resolve. On a desktop viewport, Marketplace SHALL use stable, untransformed page and overlay dimensions; its Account launcher SHALL be visibly inset from the lower-left of the Marketplace viewport, and an open Account flow SHALL cover and center within the complete Marketplace viewport.

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

#### Scenario: Account launcher opens at desktop scale
- **WHEN** a visitor views Marketplace at a desktop viewport and activates Account
- **THEN** the closed Account control is fully visible in the lower-left Marketplace area
- **AND** the opened Account backdrop covers the whole Marketplace viewport without an unshaded side region
- **AND** the Account dialog is centered in that viewport

### Requirement: Public game-wallet inventory lookup

The Marketplace SHALL use a logged-in Game Wallet public address only while an active Player Wallet session and an explicitly selected Game Wallet session both exist. A guest, logged-out, or Player-only Marketplace SHALL NOT use the registered game-wallet public address as an inventory source, display it as an active session wallet, or start a Game Wallet inventory lookup. When a successful Game Wallet Login exposes a public address different from the registered address, the Marketplace SHALL use that logged-in address as the active inventory source for the current browser session, refresh availability from it, and clearly distinguish it from the registered default. It SHALL NOT alter the deployed static catalog or claim that the override changes the official published game wallet. When the Marketplace has a Player Wallet session, it SHALL maintain a separate Player Wallet inventory result for the Player Wallet ownership tab. Game Wallet and Player Wallet reads SHALL be coordinated independently, and a failure or pending state for one SHALL NOT prevent the other wallet's usable result from rendering. A fresh positive BIS Account Assets read for the active Player Wallet SHALL invalidate or supersede any older empty Marketplace Player Wallet result before the Player Wallet tab is rendered.

#### Scenario: Guest views the registered game wallet inventory

- **WHEN** a guest opens the Marketplace before any Player Wallet login
- **THEN** the Marketplace remains browseable using its public catalog data
- **AND** it does not display an active Game Wallet address or request Game Wallet inventory
- **AND** selecting Game Wallet ownership reports that a Player Wallet is required rather than showing the registered wallet's inventory

#### Scenario: Player-only login does not reactivate a retained Game Wallet

- **WHEN** a user logs out of the Player Wallet while a Game Wallet session is active, refreshes the Marketplace, and logs in only with the Player Wallet
- **THEN** the Marketplace reports the Player Wallet as active and the Game Wallet as not connected
- **AND** it does not use the prior Game Wallet identity, its address, or its prior inventory result until the user explicitly imports a new Game Wallet

#### Scenario: Player logout ends the game-facing wallet session

- **WHEN** the active Player Wallet is logged out while a Game Wallet identity or Game Wallet inventory result is present
- **THEN** the Marketplace removes the Game Wallet from its active game-facing wallet presentation
- **AND** it stops or invalidates Game Wallet inventory work and does not show the prior wallet's items as current
- **AND** retained Game Wallet identity storage is not treated as an active session until explicit Game Wallet login

#### Scenario: Game-wallet login uses a different address

- **WHEN** the user completes Game Wallet Login with an active Player Wallet and its public address differs from the registered address
- **THEN** the Marketplace refreshes inventory and trade context from the logged-in address for that browser session
- **AND** it retains the registered address as public catalog configuration and labels the session override accurately

#### Scenario: Ownership tabs use their corresponding wallets

- **WHEN** the user selects Game Wallet or Player Wallet ownership while a Player Wallet session is active
- **THEN** the Marketplace renders only the corresponding active wallet's owned items for that tab
- **AND** the selected tab does not wait for the unrelated wallet after its own inventory is ready or cached

#### Scenario: Logged-in Game Wallet inventory remains authoritative

- **WHEN** a logged-in Game Wallet public address differs from the registered address and the Player Wallet remains active
- **THEN** the Marketplace keeps the existing session override behavior
- **AND** it scopes the Game Wallet inventory cache to the logged-in wallet identity and active network

#### Scenario: BIS Assets confirms Player Wallet holdings

- **WHEN** the user opens Marketplace, opens Account, opens Assets, observes one or more positive Player Wallet holdings, closes BIS, and selects Player Wallet
- **THEN** Marketplace performs or uses a read associated with the same active Player Wallet and network
- **AND** the Player Wallet tab shows the verified marketplace items instead of an older empty result
- **AND** a Game Wallet read does not replace or clear those Player Wallet items

### Requirement: Empty registered games are browseable

The Marketplace SHALL expose each registered game identity as a selectable game option, including games with no implementation, wallet address, catalog items, or inventory. Selecting a game without published assets SHALL show a truthful empty state and SHALL NOT fabricate equipment or minting availability.

#### Scenario: Visitor selects Rogue's Dungeon before the game exists

- **WHEN** a visitor selects `Rogue's Dungeon` in the Marketplace game filter
- **THEN** `Rogue's Dungeon` remains visibly selected
- **AND** the Marketplace shows that no equipment is currently available for that game
- **AND** the Marketplace does not require a Rogue's Dungeon wallet, request Rogue's Dungeon inventory, or start a mint, transfer, or trading operation

#### Scenario: Stealth & Steel remains available beside the empty game

- **WHEN** a visitor switches from `Rogue's Dungeon` to `Stealth & Steel`
- **THEN** the existing Stealth & Steel catalog and registered game-wallet inventory behavior remains available
- **AND** the presence of `Rogue's Dungeon` does not change Stealth & Steel item classification, prices, artwork, or ownership state

#### Scenario: Empty game is not an Admin mint target

- **WHEN** an administrator uses the existing Marketplace catalog issuance workflow
- **THEN** only the existing defined Stealth & Steel catalog items are eligible for that workflow
- **AND** the registered `Rogue's Dungeon` identity is not represented as a mintable item or as a verified issued catalog

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

Selecting a catalog card SHALL open its detail view with the asset identity, game effect, tier, and ownership/trading state available to the current visitor. Asset ID, Ticker, Quantity, Speed, Offense, and Defense SHALL each appear as a labeled, contained read-only value field with an accessible Copy action named for its label. Each value SHALL remain selectable for manual copying, and the detail SHALL provide truthful feedback for successful or unsuccessful clipboard copying. Each field's label, value, and copy control SHALL use the same left-aligned type treatment. Decimals SHALL NOT be displayed. The detail SHALL be square and SHALL NOT present an internal scrollbar. Before the trading capability is available, Buy and Sell controls SHALL be visibly disabled in an upper-right action column; they SHALL NOT request login, create a transaction, or imply a price, sale, or listing. The detail SHALL NOT show bottom verification/status/footer copy.

#### Scenario: Guest selects an item before trading exists

- **WHEN** a logged-out visitor opens Dagger II before authenticated trading is delivered
- **THEN** the detail view describes Dagger II, displays its labeled, copyable Asset ID, Ticker, Quantity, Speed, Offense, and Defense fields
- **AND** it does not display Decimals, an internal detail scrollbar, or bottom verification/status/footer copy
- **AND** it displays disabled Buy and Sell controls in the upper-right action column
- **AND** the visitor can return to the public catalog without any account or wallet side effect

#### Scenario: Guest copies an item detail value
- **WHEN** a visitor selects Copy for an open catalog-item detail value
- **THEN** the Marketplace copies that full displayed value when clipboard access succeeds and confirms that result
- **AND** when clipboard access fails, the Marketplace keeps the full value selectable and explains that it can be copied manually

### Requirement: Approved catalog prices are published
The nine-item catalog SHALL publish the same integer sat price used for purchase and sell-back: Shoes I/II/III at 1,000/2,000/3,000; Dagger I/II/III at 1,100/2,100/3,100; and Shield I/II/III at 1,200/2,200/3,200. The catalog SHALL NOT add a fee or buy/sell spread.

#### Scenario: Browse the priced catalog
- **WHEN** a visitor views all nine entries
- **THEN** every entry displays its approved integer sat price
- **AND** the displayed price matches the item's verified chain metadata

### Requirement: Catalog artwork comes from chain asset URLs
Every equipment image rendered by the Marketplace SHALL request at runtime the absolute HTTPS icon URL carried by the corresponding chain asset. F.N.1 SHALL use immutable C.G.1-style versioned public PNG URLs so already minted metadata remains usable after later artwork revisions. A static bundled catalog-to-image mapping SHALL NOT determine the rendered item icon.

#### Scenario: Render an issued catalog item
- **WHEN** Marketplace renders an issued item with verified chain metadata
- **THEN** its image request uses that asset's chain-provided icon URL

#### Scenario: Artwork is revised later
- **WHEN** revised marketplace artwork is released
- **THEN** existing versioned URLs and their files remain available unchanged
- **AND** newly revised files use a new versioned path

### Requirement: Fluid Marketplace presentation
The BIS Marketplace SHALL retain its public sidebar-and-catalog presentation, its existing catalog content, filters, item artwork, prices, effects, and distinct poetic copy while sizing its page as one fluid system. Each catalog item SHALL render in a square cell. The Marketplace SHALL derive layout from available CSS pixels without branching on device pixel ratio or using viewport width or height media queries; motion-preference queries remain permitted. The Marketplace SHALL allow normal document scrolling whenever its content cannot fit rather than clipping catalog or sidebar content.

#### Scenario: User opens the Marketplace at the measured desktop viewport

- **WHEN** a visitor opens the Marketplace in Chrome at 100% browser zoom with a 1138 by 590 CSS-pixel viewport
- **THEN** the Signet banner, Marketplace heading and lede, all catalog filter rows, and the first row of catalog cards are visible without overlap or clipping
- **AND** the heading, controls, artwork, card dimensions, and surrounding spacing form a compact hierarchy appropriate to the available viewport
- **AND** the catalog presents three square item cells across its first row
- **AND** the Account entry and Marketplace resource controls do not obscure one another or the Signet label

#### Scenario: Available viewport changes because of browser or OS scaling

- **WHEN** the available CSS-pixel viewport becomes narrower, wider, shorter, or taller because of browser chrome, browser zoom, or operating-system display scaling
- **THEN** the sidebar, catalog controls, and cards reflow from available space without a device-specific branch
- **AND** no required Marketplace content overlaps, becomes horizontally inaccessible, or is cut off by a fixed page viewport

#### Scenario: Visitor uses a motion-reduction preference

- **WHEN** a visitor enables a reduced-motion preference
- **THEN** Marketplace motion may be reduced without changing the fluid layout, catalog content, or filter behavior
