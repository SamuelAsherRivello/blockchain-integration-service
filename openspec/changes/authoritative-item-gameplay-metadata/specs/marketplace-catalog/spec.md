# Spec Delta

## MODIFIED Requirements

### Requirement: Nine durable game-equipment assets

The public catalog SHALL contain exactly these nine named equipment entries for the Stealth & Steel game ID: Shoes I, Shoes II, Shoes III; Dagger I, Dagger II, Dagger III; and Shield I, Shield II, Shield III. Each entry SHALL identify its game ID, Signet asset ID after issuance, tier, equipment family, artwork, and a player-facing effect description. Each higher tier SHALL describe a stronger effect than the preceding tier in the same family, and the corresponding structured `bisAttributeDeltas` on the issued asset SHALL be the sole authority for gameplay strength.

#### Scenario: Browse the complete grid
- **WHEN** a visitor views the marketplace catalog after the catalog assets have been issued
- **THEN** all nine entries appear in a stable 3 by 3 grid with distinct names, tiers, family labels, artwork, effect descriptions, and asset identities
- **AND** no item is represented as minted, owned, listed, or sold without the corresponding verified evidence

#### Scenario: Catalog presentation differs from chain delta
- **WHEN** a catalog description differs from the issued item's structured attribute delta
- **THEN** the structured chain delta remains authoritative for gameplay
- **AND** the discrepancy is surfaced as invalid or unavailable metadata rather than silently converted into a different effect

### Requirement: Game-wallet catalog batch issuance

BIS Admin SHALL provide an H. Marketplace section that is available only when the existing F. Game Wallet has an active selected wallet. H SHALL offer one explicit action to mint the complete nine-item Stealth & Steel catalog to that game wallet through the existing BIS asset-mint boundary. Each catalog record SHALL use a stable item identity and operation identity so a repeated or interrupted batch reconciles the original item issuance rather than minting a duplicate. H SHALL publish only verified public game ID, catalog item identity, asset ID, display metadata, structured attribute deltas, and quantity records for Marketplace rendering; it SHALL not publish wallet recovery material, signing material, or private transaction payloads.

#### Scenario: Game wallet mints the catalog batch
- **WHEN** an Admin has selected a funded F. Game Wallet and explicitly starts the Marketplace catalog batch
- **THEN** H creates or reconciles exactly one intended issuance for each of the nine named catalog items on that wallet
- **AND** the standalone Marketplace receives public records only for items whose original issuance has a verified result
- **AND** every issued item contains validated structured attribute deltas

#### Scenario: Game wallet is unavailable
- **WHEN** no F. Game Wallet is selected or the selected wallet cannot mint an item
- **THEN** H prevents that item from being represented as minted in the public catalog and gives truthful unavailable or recovery feedback
- **AND** the public Marketplace remains browseable without the missing item being fabricated

