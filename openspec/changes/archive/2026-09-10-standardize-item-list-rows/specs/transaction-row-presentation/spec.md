## MODIFIED Requirements

### Requirement: Transactions naming and asset-sized rows
The Account menu entry and transaction-list dialog title SHALL be Transactions. Each closed transaction row SHALL use the shared item-row geometry and show a leading toast status icon followed by six fields in a two-column by three-row grid. The visible fields SHALL contain only an emoji, separator, and value: operation (`⚙️`), cost (`🪙`), network (`📡`), status (`✅` for a completed example and `⏳` for a pending example), direction (`↙️` or `↗️` as appropriate), and locally presented time (`🕒`). The row SHALL NOT show a transaction identifier. Missing or unreported time SHALL be represented truthfully rather than invented. Every emoji SHALL have a programmatic accessible label, and full transaction values and identifiers SHALL remain available through Transaction Detail and the existing copy reports.

Pending or unresolved rows SHALL use the existing toast information-blue background/border and information status glyph. Done, confirmed, settled, verified, or recorded rows SHALL use the existing toast success-green background/border and success glyph. Truthful warning or error states SHALL use the corresponding existing toast palette and glyph. Hover and keyboard focus SHALL add a black outline without changing the status background. A selected row, when present in the list, SHALL use a stronger persistent black outline without changing that background. Selecting a row SHALL retain the existing Transaction Detail report and Back navigation.

#### Scenario: Inspect a transaction
- **WHEN** a completed transaction row is shown
- **THEN** its green closed row presents operation, cost, network, status, direction, and time as six emoji-value fields beside the toast success glyph
- **AND** selecting it opens Transaction Detail with the full report and identifiers, and Back returns to the list

#### Scenario: Inspect a pending transaction without a timestamp
- **WHEN** a pending transaction has no reported timestamp
- **THEN** its blue row uses the toast information glyph and presents a truthful unavailable-time value without inventing a timestamp

#### Scenario: Interact with a transaction row
- **WHEN** the row is hovered, keyboard-focused, or retained as selected
- **THEN** the appropriate black outline appears while the status-colored background remains unchanged

#### Scenario: Narrow transaction row
- **WHEN** one of the six transaction values exceeds its cell at a supported narrow width
- **THEN** the value is contained without horizontal overflow and its complete value remains available in Transaction Detail and copyable reports
