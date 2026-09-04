# transaction-row-presentation Specification

## Purpose

Present account transactions in a consistent three-line list with clear identification and navigation to full transaction details.

## Requirements

### Requirement: Transactions naming and asset-sized rows
The Account menu entry and transaction-list dialog title SHALL be Transactions. Each transaction row SHALL match the asset rows' padding, border radius and three-line rhythm, without an icon. The first line SHALL be a bold amount/direction summary, the second supported status, and the third shortened identifier. Selecting a row SHALL retain the existing Transaction Detail report and Back navigation.

#### Scenario: Inspect a transaction
- **WHEN** a player selects Transactions from Account
- **THEN** the title is Transactions and rows use a bold summary, status and ID on separate lines without icons
- **WHEN** a row is selected
- **THEN** Transaction Detail opens with the full report and Back returns to the list

### Requirement: Saved operation rows without redundant unavailable notice
When live history is unavailable but saved operation rows are present, Transactions SHALL show those rows without the message Live transaction history unavailable. Showing saved operation status only. Use Refresh to retry. Refresh SHALL remain available. When no rows are present, the existing unavailable or empty-state feedback SHALL remain.

#### Scenario: Saved operation status remains visible
- **WHEN** live history fails and saved operation rows are available
- **THEN** those rows remain visible without the redundant live-history notice, and the player can use Refresh
