## ADDED Requirements

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
