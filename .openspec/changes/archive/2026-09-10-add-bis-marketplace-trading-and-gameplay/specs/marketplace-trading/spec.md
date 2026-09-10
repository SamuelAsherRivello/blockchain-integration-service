## Purpose

Provide an optional local two-wallet Marketplace demonstration of real player-to-game-wallet asset and sats transfers without a hosted service or player-to-player market.

## ADDED Requirements

### Requirement: Optional local wallet sessions
The Marketplace SHALL retain public catalog access without login. It SHALL provide Marketplace-specific Player Wallet Login and Game Wallet Login buttons for protected Buy, Sell, or My Items actions. Each button SHALL open the existing BIS account UI for that role; BIS SHALL retain ownership of recovery entry, profile selection, import, active-session state, and logout. A trade SHALL require both sessions in the same Marketplace browser and SHALL explain a missing session without starting or simulating a trade.

#### Scenario: Visitor requests a protected action
- **WHEN** a visitor chooses Buy or Sell before both wallet sessions are active
- **THEN** the Marketplace identifies the missing Player Wallet or Game Wallet session
- **AND** the public item view remains available with no submitted trade

#### Scenario: Marketplace opens BIS login
- **WHEN** a visitor selects Marketplace Player Wallet Login or Game Wallet Login
- **THEN** the applicable existing BIS account UI opens for the selected role
- **AND** the Marketplace does not present a second recovery, profile, or logout implementation

### Requirement: Registered and active game-wallet addresses
The Marketplace SHALL use the published registered game-wallet address for anonymous read-only inventory lookup. When Game Wallet Login yields a different public address, the Marketplace SHALL use it as the active inventory and counterparty address only for that browser session and SHALL label the override accurately.

#### Scenario: Logged-in game wallet differs from the registered wallet
- **WHEN** Game Wallet Login completes with a public address different from the catalog's registered address
- **THEN** the Marketplace refreshes its local trade context from the logged-in address
- **AND** it does not change the deployed catalog or claim that the registered address changed

### Requirement: Trading requires a proven atomic exchange
Buy and Sell actions SHALL be enabled only after the implementation demonstrates on Arkade Signet a supported atomic asset-for-sats exchange whose settlement cannot complete only the asset leg or only the sats leg. The Marketplace SHALL NOT substitute sequential transfers, compensation logic, or simulated success. If the primitive cannot satisfy this contract, Buy and Sell SHALL remain unavailable with an accurate explanation while catalog browsing, wallet access, owned-item inspection, and equipment selection remain usable.

#### Scenario: Atomic primitive is not proven
- **WHEN** the supported Arkade integration cannot demonstrate atomic asset-for-sats settlement and recovery on Signet
- **THEN** Buy and Sell remain unavailable and accurately explain why
- **AND** the independent catalog and equipment experiences remain usable

#### Scenario: Atomic primitive is proven
- **WHEN** the supported Arkade integration demonstrates atomic settlement and recovery on Signet
- **THEN** Marketplace may enable Buy and Sell for two eligible active wallet sessions
- **AND** each submitted trade uses that demonstrated atomic path

### Requirement: Approved item prices apply in both directions
The Marketplace SHALL use these integer sat prices for both purchase and sell-back: Shoes I/II/III at 1,000/2,000/3,000 sats; Dagger I/II/III at 1,100/2,100/3,100 sats; and Shield I/II/III at 1,200/2,200/3,200 sats. The price used for a trade SHALL come from verified chain metadata for the exact catalog item and SHALL match the approved catalog value.

#### Scenario: Player buys or sells Shield II
- **WHEN** the player starts an eligible Shield II purchase or sell-back
- **THEN** Marketplace verifies and uses a price of 2,200 sats
- **AND** it does not add a fee or direction-specific spread

### Requirement: Verified local player-to-game-wallet trading
Every purchase SHALL atomically transfer the agreed sats from the active player wallet to the active game wallet and the exact agreed catalog asset to the player. Every sell-back SHALL atomically transfer the exact agreed catalog asset from the player to the active game wallet and the agreed sats to the player. The Marketplace SHALL verify the two wallets, sats amount, asset identity, asset quantity, and recipients before calling an outcome confirmed. Interrupted submissions SHALL remain pending or unknown until reconciled.

#### Scenario: Purchase completes
- **WHEN** an eligible atomic purchase is confirmed
- **THEN** the active player wallet owns the purchased item and paid its approved sats price
- **AND** the active game wallet owns the received sats and no longer owns that item

#### Scenario: Trade outcome is uncertain
- **WHEN** acknowledgement is lost after a trade submission might have occurred
- **THEN** the Marketplace presents the original operation as pending or unknown and offers reconciliation
- **AND** it does not issue a replacement asset, payment, listing, or credit

### Requirement: Marketplace items are chain-classified
Every marketplace item SHALL carry verified chain metadata identifying Stealth & Steel as its game, identifying its asset type as item rather than trophy, and providing a stable catalog identity, Shoes/Dagger/Shield family, I/II/III tier, approved integer sat price, and absolute HTTPS icon URL. Marketplace classification, pricing, and icon rendering SHALL use that chain data at runtime rather than an asset name, ticker, or bundled icon lookup.

#### Scenario: Marketplace reads a valid item
- **WHEN** a chain asset supplies the complete verified Stealth & Steel item metadata
- **THEN** Marketplace classifies it under the declared family and tier, uses its approved price, and requests its chain-provided icon URL

#### Scenario: Asset lacks item classification
- **WHEN** an asset is a trophy, belongs to another game, or lacks the required item metadata
- **THEN** Marketplace does not offer it as a purchasable or sellable Stealth & Steel item

### Requirement: H1 mints the nine-item marketplace catalog
The Admin H1 workflow SHALL mint to the active Game Wallet one distinct chain asset for every Shoes, Dagger, and Shield tier I, II, and III combination. Each minted item SHALL contain the required chain classification, approved price, and a C1-style versioned public icon URL. H1 SHALL require the active Game Wallet signer and SHALL NOT mint through the Player Wallet.

#### Scenario: Administrator runs H1 with the active game wallet
- **WHEN** H1 completes successfully for an eligible active Game Wallet
- **THEN** that wallet freshly owns all nine correctly classified catalog items
- **AND** every item carries its approved family, tier, price, and public runtime icon URL

### Requirement: H2 burns all owned marketplace items safely
The Admin H2 workflow, labelled `Burn All Items for Marketplace`, SHALL inspect the active Game Wallet's fresh chain inventory and burn every asset currently classified on-chain as a Stealth & Steel item. It SHALL preserve trophies, assets for other games, generic assets, and assets not owned by that wallet.

#### Scenario: Active game wallet owns items and a trophy
- **WHEN** H2 runs while the active Game Wallet owns marketplace items and a Stealth & Steel trophy
- **THEN** H2 burns the owned marketplace items
- **AND** it does not burn the trophy or unrelated assets

#### Scenario: One burn result becomes unknown
- **WHEN** one submitted item burn becomes pending or unknown
- **THEN** H2 records that result against only that exact asset and continues processing other eligible items
- **AND** no unrelated user interaction is blocked by that pending transaction

#### Scenario: Administrator runs H2 again after an unknown result
- **WHEN** a later H2 run encounters an asset with an unresolved prior burn submission
- **THEN** H2 reconciles that submission and does not submit a duplicate burn while it remains unresolved
- **AND** it continues reconciling or burning every other eligible item

### Requirement: No player-to-player market
The Marketplace SHALL not create player listings, bids, recipient fields, player-to-player transfers, or claims of remote self-service trading. Sell means sell back to the active game wallet only.

#### Scenario: Player views an owned catalog item
- **WHEN** a player opens an owned catalog item in Marketplace
- **THEN** any enabled Sell action identifies the active game wallet as its counterparty
- **AND** no player listing or bid control is available
