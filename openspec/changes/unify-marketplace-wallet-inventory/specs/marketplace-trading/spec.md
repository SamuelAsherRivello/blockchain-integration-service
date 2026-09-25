## MODIFIED Requirements

### Requirement: Marketplace items are chain-classified

Every marketplace item offered for purchase or sell-back SHALL carry verified chain metadata identifying Stealth & Steel as its game, identifying its asset type as item rather than trophy, and providing a stable catalog identity, Shoes/Dagger/Shield family, I/II/III tier, approved integer sat price, and absolute HTTPS icon URL. Marketplace classification, pricing, and icon rendering SHALL use that chain data at runtime rather than an asset name, ticker, or bundled icon lookup. A verified Stealth & Steel trophy SHALL remain a visible player-owned asset when its presentation metadata is valid, but SHALL never be classified, priced, or offered as a purchasable, sellable, or loadout equipment item.

#### Scenario: Marketplace reads a valid item

- **WHEN** a chain asset supplies the complete verified Stealth & Steel item metadata
- **THEN** Marketplace classifies it under the declared family and tier, uses its approved price, and requests its chain-provided icon URL

#### Scenario: Player inventory includes a valid trophy

- **WHEN** the active Player Wallet holds a Stealth & Steel trophy with valid chain presentation metadata
- **THEN** Marketplace presents it as a player-owned trophy with its verified identity and artwork
- **AND** the trophy has no Buy, Sell, price, or equipment-selection affordance

#### Scenario: Asset lacks item or trophy presentation classification

- **WHEN** an asset belongs to another game or lacks the required verified metadata for its declared Marketplace presentation type
- **THEN** Marketplace does not offer it as a purchasable or sellable Stealth & Steel item
- **AND** it does not fabricate a trophy presentation from its name or ticker

#### Scenario: Asset lacks item classification

- **WHEN** an asset is a trophy, belongs to another game, or lacks the required item metadata
- **THEN** Marketplace does not offer it as a purchasable or sellable Stealth & Steel item

## ADDED Requirements

### Requirement: Wallet-partitioned Marketplace inventory

The Marketplace SHALL render fresh verified Stealth & Steel holdings according to their source wallet. It SHALL render recognized Shoes, Daggers, and Shields held by the active game inventory source as Game Wallet items. It SHALL render recognized equipment and valid trophies held by the active Player Wallet as Player Wallet items. A wallet-owner filter SHALL not show assets from the other wallet; the All owner filter SHALL retain the source wallet identity for every rendered asset. A type-specific equipment filter SHALL include only its matching equipment family, while the all-types view SHALL retain valid trophies.

#### Scenario: Game and player wallets hold different asset kinds

- **WHEN** the active game inventory source holds catalog equipment and the active Player Wallet holds equipment and a trophy
- **THEN** the Game Wallet filter renders only the game-held equipment and the Player Wallet filter renders the player-held equipment and trophy
- **AND** the All owner filter renders every eligible holding with its truthful owner

#### Scenario: Player chooses an equipment-type filter

- **WHEN** the player chooses Speed, Offense, or Defense while viewing Marketplace inventory
- **THEN** Marketplace renders only the matching Shoes, Daggers, or Shields from the selected owner scope
- **AND** it excludes trophies without reclassifying or hiding them from the all-types view

#### Scenario: Player wallet has no recognized holdings

- **WHEN** a fresh active Player Wallet ownership read succeeds with no valid Marketplace equipment or trophy
- **THEN** Marketplace shows a truthful empty Player Wallet inventory state
- **AND** it does not substitute game-wallet holdings or cached player holdings
