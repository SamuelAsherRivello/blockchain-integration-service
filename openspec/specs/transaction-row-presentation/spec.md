# transaction-row-presentation Specification

## Purpose

Present account transactions in a consistent three-line list with clear identification and navigation to full transaction details.

## Requirements

### Requirement: Transactions naming and asset-sized rows
The Account menu entry and transaction-list dialog title SHALL be Transactions. Each closed transaction row SHALL use the shared item-row geometry and show a leading toast status icon followed by six emoji-value fields in a two-column by three-row grid: operation, status, chain, cost, direction, and locally presented elapsed time. The row SHALL NOT show a transaction identifier; missing time SHALL be truthful, while full values and identifiers remain in Transaction Detail and copy reports. Pending rows use toast information-blue; done rows use toast success-green; truthful warning/error states use their matching palette. Hover/focus add a black outline without changing the background, and selected rows use a stronger persistent outline. Selecting a row SHALL retain the existing Transaction Detail report and Back navigation.

#### Scenario: Inspect a transaction
- **WHEN** a completed transaction row is shown
- **THEN** its green row presents operation/status, chain/cost, direction/elapsed time beside the success glyph
- **AND** selecting it opens Transaction Detail with the full report and identifiers, and Back returns to the list

#### Scenario: Inspect a pending transaction without a timestamp
- **WHEN** a pending transaction has no reported timestamp
- **THEN** its blue row presents a truthful unavailable-time value without inventing a timestamp

#### Scenario: Narrow transaction row
- **WHEN** one of the six transaction values exceeds its cell at a supported narrow width
- **THEN** the value is contained without horizontal overflow and its complete value remains available in Transaction Detail and copyable reports

#### Scenario: Interact with a transaction row
- **WHEN** the row is hovered, keyboard-focused, or retained as selected
- **THEN** the appropriate black outline appears while the status-colored background remains unchanged

### Requirement: Saved operation rows without redundant unavailable notice
When live history is unavailable but saved operation rows are present, Transactions SHALL show those rows without the message Live transaction history unavailable. Showing saved operation status only. Use Refresh to retry. Refresh SHALL remain available. When no rows are present, the existing unavailable or empty-state feedback SHALL remain.

#### Scenario: Saved operation status remains visible
- **WHEN** live history fails and saved operation rows are available
- **THEN** those rows remain visible without the redundant live-history notice, and the player can use Refresh
