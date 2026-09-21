# Spec Delta

## MODIFIED Requirements

### Requirement: Two-page asset inspection
An active Account SHALL offer Assets immediately below Transactions. Assets SHALL show the title Assets, current account identity and Signet network, Refresh, a bounded scrollable list, and Back. Selecting a row SHALL replace the list with Asset Detail in the same dialog. Back from detail SHALL return to the same list without another ownership request, retaining the selected asset, scroll position, and focus on its row when that row remains present. Back from the list SHALL return to Account. Opening Account alone SHALL NOT request assets.

The Assets list page SHALL use the shared account-collection dimensions: a 456px compact parent-card height shared with Contracts and Transactions, a list viewport sized for 3.5 shared rows even when empty or nearly empty, a persistent vertical scrollbar with stable gutter, a Back footer that remains inside the card, and closed rows whose width and height exactly match contract and transaction rows.

#### Scenario: Inspect and return
- **WHEN** the player scrolls Assets, opens a row, and selects Back
- **THEN** the list returns at its previous scroll position with the selected row focused and no additional ownership read
- **AND** selecting Back again returns to Account

#### Scenario: Empty or short asset list
- **WHEN** the fresh ownership query returns zero, one, or two assets
- **THEN** the Assets list still reserves the full 3.5-row viewport and keeps its vertical scrollbar visible

#### Scenario: Keyboard and narrow host
- **WHEN** the player uses keyboard navigation or a narrow 9:16 host container
- **THEN** rows and actions remain reachable, detail entry announces/focuses the new heading, long fields wrap or scroll within their bounds, and the outer page does not overflow horizontally

#### Scenario: Shared asset row geometry
- **WHEN** an asset row is displayed beside contract and transaction rows
- **THEN** its rendered width and height are exactly equal to the other collection row types
