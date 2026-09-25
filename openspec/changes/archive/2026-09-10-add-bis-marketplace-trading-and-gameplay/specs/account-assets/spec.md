## ADDED Requirements

### Requirement: Assets provide marketplace loadout access
The BIS Assets experience SHALL recognize a Stealth & Steel marketplace item only from verified chain asset metadata that identifies the game, identifies the asset type as an item rather than a trophy, and provides its stable catalog identity, family, tier, price, and runtime icon URL. It SHALL provide access to loadout management for recognized items while preserving inspection and existing safeguards for trophies, generic assets, and all other assets.

#### Scenario: Player opens Assets with catalog and generic assets
- **WHEN** a player has both a chain-classified Stealth & Steel item and a generic Signet asset
- **THEN** Assets shows the generic asset without change and exposes loadout controls only for the recognized equipment

#### Scenario: Trophy is not treated as equipment
- **WHEN** an owned Stealth & Steel asset identifies its asset type as a trophy
- **THEN** Assets keeps the trophy inspectable as an asset
- **AND** it does not offer that trophy as a Shoes, Dagger, or Shield selection

### Requirement: Equipment icons use chain asset URLs
Every Stealth & Steel equipment icon rendered by BIS SHALL load at runtime from the URL carried by that chain asset. BIS SHALL NOT substitute a catalog-ID-to-bundled-icon mapping as the source of the item image.

#### Scenario: BIS renders a recognized item
- **WHEN** BIS renders a recognized Stealth & Steel item whose chain metadata contains an icon URL
- **THEN** the rendered image request uses that chain-provided URL
