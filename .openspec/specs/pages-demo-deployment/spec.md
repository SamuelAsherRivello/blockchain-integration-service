## Purpose

Publish the independently usable BIS Admin and Marketplace demos at stable, clearly labeled GitHub Pages URLs for every release.

## Requirements

### Requirement: Two published demo entry points

Each GitHub Pages deployment SHALL publish BIS Admin at `/blockchain-integration-service/admin/` and BIS Marketplace at `/blockchain-integration-service/marketplace/`. Both URLs SHALL load their respective browser application directly from the repository's configured Pages base URL without relying on the other demo being open.

#### Scenario: Visitor opens the Admin URL

- **WHEN** a visitor requests `https://samuelasherrivello.github.io/blockchain-integration-service/admin/` after a successful deployment
- **THEN** the BIS Admin application loads with its expected assets
- **AND** it does not resolve to the Marketplace application

#### Scenario: Visitor opens the Marketplace URL

- **WHEN** a visitor requests `https://samuelasherrivello.github.io/blockchain-integration-service/marketplace/` after a successful deployment
- **THEN** the BIS Marketplace application loads with its expected catalog and assets
- **AND** it does not resolve to the Admin application

### Requirement: Release documentation names both demos

The repository README SHALL list the two published demos by the labels `BIS Admin` and `BIS Marketplace`, each linking to its stable Pages URL. The release instructions SHALL require verification of both links after the Pages deployment completes.

#### Scenario: Maintainer prepares a release

- **WHEN** a maintainer follows the README release instructions
- **THEN** the instructions identify the Pages deployment workflow and both public demo URLs
- **AND** they direct the maintainer to verify the Admin and Marketplace routes before considering the release complete
