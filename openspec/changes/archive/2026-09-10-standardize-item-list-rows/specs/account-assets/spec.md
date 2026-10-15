## MODIFIED Requirements

### Requirement: Complete and exact ownership presentation
Assets SHALL include all positive holdings returned by the existing fresh ownership query, including non-BIS assets, ordered by asset ID. Each closed asset row SHALL use the shared item-row geometry and show six fields in a two-column by three-row grid. The visible fields SHALL contain only an emoji, separator, and value: available name (`🏷️`), exact owned quantity (`🔢`), available ticker (`🔤`), ownership status (`✅`), known decimals (`🎯`), and network context (`🌐`). Every emoji SHALL have a programmatic accessible label. The row SHALL NOT prioritize or show the asset ID; the complete ID SHALL remain available in Asset Detail and copyable reports.

The HTTPS metadata icon image with no referrer SHALL occupy the leading visual position. When artwork is missing, invalid, or fails, the row SHALL use the matching toast status glyph instead of reserving an empty position. An owned asset SHALL use the existing toast success-green background/border without recoloring on hover, focus, or selection. Hover and keyboard focus SHALL add a black outline, and a retained selected row SHALL use a stronger persistent black outline. Absent names SHALL fall back to an asset-ID-derived label. Quantities SHALL use integer base units and known valid decimals without floating-point rounding; absent or invalid decimals SHALL be represented truthfully rather than invented.

#### Scenario: Duplicate names and large quantities
- **WHEN** two distinct assets share a name and ticker and one quantity exceeds JavaScript's safe integer range
- **THEN** both remain independently selectable by asset ID and every quantity digit is preserved in Asset Detail and copyable reports
- **AND** their closed rows remain distinguishable through selection/detail behavior without displaying the ID as one of the six priority fields

#### Scenario: Missing metadata
- **WHEN** an owned holding has no name, ticker, decimals, or valid icon URL
- **THEN** it remains visible using truthful fallback values and the toast success glyph in the leading position
- **AND** no name, ticker, decimals, or artwork is manufactured

#### Scenario: Asset row with artwork
- **WHEN** an owned asset has prepared artwork
- **THEN** the artwork replaces the leading toast glyph while the same six emoji-value fields and green owned background remain

#### Scenario: Interact with an asset row
- **WHEN** the row is hovered, keyboard-focused, or retained as selected
- **THEN** the appropriate black outline appears while the green background remains unchanged

#### Scenario: Narrow asset row
- **WHEN** one of the six asset values exceeds its cell at a supported narrow width
- **THEN** the value is contained without horizontal overflow and its complete value remains available in Asset Detail and copyable reports
