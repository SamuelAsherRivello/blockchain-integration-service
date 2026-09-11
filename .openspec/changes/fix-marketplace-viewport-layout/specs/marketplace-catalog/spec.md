## MODIFIED Requirements

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
