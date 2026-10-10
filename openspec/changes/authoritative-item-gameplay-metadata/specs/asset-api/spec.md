# Spec Delta

## MODIFIED Requirements

### Requirement: Generic asset metadata round-trips through the public API

The generic asset mint and listing boundaries SHALL support JSON-safe chain asset metadata without assigning game meaning inside the generic API. For each marketplace item, the round-tripped metadata SHALL preserve its game ID, asset type, stable catalog ID, equipment family, tier, integer sat price, absolute HTTPS icon URL, human-readable BIS description, and structured BIS attribute delta array. Listing SHALL expose available metadata as untrusted JSON-safe public data and SHALL continue returning generic assets whose optional marketplace fields are absent.

#### Scenario: Mint and list a marketplace item
- **WHEN** F.N.1 mints a valid Stealth & Steel item through the generic asset boundary and a fresh list succeeds
- **THEN** the listed asset contains the same game, item type, catalog identity, family, tier, price, icon URL, description, and structured attribute deltas stored on-chain
- **AND** recognition can occur without a browser-local catalog-to-asset-ID mapping

#### Scenario: List a generic or trophy asset
- **WHEN** a fresh ownership read returns an asset without complete marketplace item metadata
- **THEN** the generic API still returns that holding and its available metadata
- **AND** it does not manufacture item classification fields

