## ADDED Requirements

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
