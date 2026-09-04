# account-assets Specification

## Purpose

Let players inspect every owned asset and its exact quantity through a reusable runtime list/detail flow. Inspection is read-only; burning requires the separate explicit confirmation contract.

## Requirements

### Requirement: Two-page asset inspection
An active Account SHALL offer Assets immediately below Transactions. Assets SHALL show the title Assets, current account identity and Signet network, Refresh, a bounded scrollable list, and Back. Selecting a row SHALL replace the list with Asset Detail in the same dialog. Back from detail SHALL return to the same list without another ownership request, retaining the selected asset, scroll position, and focus on its row when that row remains present. Back from the list SHALL return to Account. Opening Account alone SHALL NOT request assets.

#### Scenario: Inspect and return
- **WHEN** a player scrolls Assets, opens a row, and selects Back
- **THEN** the list returns at its previous scroll position with the selected row focused and no additional ownership read
- **AND** selecting Back again returns to Account

#### Scenario: Keyboard and narrow host
- **WHEN** the player uses keyboard navigation or a narrow 9:16 host container
- **THEN** rows and actions remain reachable, detail entry announces/focuses the new heading, long fields wrap or scroll within their bounds, and the outer page does not overflow horizontally

### Requirement: Complete and exact ownership presentation
Assets SHALL include all positive holdings returned by the existing fresh ownership query, including non-BIS assets, ordered by asset ID. Each row SHALL use the HTTPS metadata icon image with no referrer and a neutral local fallback for missing, invalid or failed images, available name, exact owned quantity and available ticker, and a shortened ID. Absent names SHALL fall back to an asset-ID label. Quantities SHALL use integer base units and known valid decimals without floating-point rounding; absent or invalid decimals SHALL display the exact integer labeled base units.

#### Scenario: Duplicate names and large quantities
- **WHEN** two distinct assets share a name and ticker and one quantity exceeds JavaScript's safe integer range
- **THEN** both remain independently selectable by asset ID and every quantity digit is preserved

#### Scenario: Missing metadata
- **WHEN** an owned holding has no name, ticker, decimals, or icon URL
- **THEN** it remains visible using its asset ID and exact base-unit quantity with neutral artwork

### Requirement: Structured asset detail and truthful copying
Asset Detail SHALL use the same metadata image/fallback and show exact quantity, available ticker/name, a one-line selectable full Asset ID with Copy, and Details with inline Copy above Name/Ticker/Decimals. The ID field SHALL scroll horizontally without wrapping. Details Copy SHALL copy those three labeled metadata fields in stable order. Missing metadata SHALL be Not provided. Copy success SHALL follow clipboard success and be scoped to current content; failure SHALL offer selectable manual-copy text and safe feedback. There SHALL be no separate Copy asset details button.

The flow SHALL NOT equate quantity with total supply, manufacture metadata, show verification badges, or offer Import, Mint, Send, Receive, Reissue, Hide Icon or an unverified explorer link. Burn SHALL follow asset-burning's confirmation contract.

#### Scenario: Known decimal quantity
- **WHEN** an asset has quantity 12345 and decimals 2
- **THEN** its owned amount is shown as 123.45 with the available ticker, and its displayed/copied Decimals field is 2

#### Scenario: Clipboard failure and changed selection
- **WHEN** clipboard access fails or completes after the selected asset or detail content changes
- **THEN** failure offers selectable manual-copy content and an obsolete completion does not mark the new detail as copied

#### Scenario: Metadata cannot instruct the UI
- **WHEN** metadata contains markup or an external icon URL
- **THEN** text metadata is inert, a valid HTTPS icon URL renders only as an image, and no badge or action is derived from metadata

### Requirement: Fresh bounded reads and explicit states
Assets SHALL request fresh ownership on entry and explicit Refresh. The Pending Operation Dialog SHALL cover loading and retry once with 30 seconds per attempt. Underlying controls SHALL be inert. On success it SHALL reveal fresh holdings or No assets found. Final failure SHALL show an error and OK in the operation dialog; OK closes the source page. Previous rows and amounts SHALL not be revealed as current or persisted as a fallback. No background polling SHALL be introduced.

Detail Refresh SHALL retain selection and navigation context underneath the covering dialog. Fresh results SHALL update detail or return to Assets when the holding is absent with Asset is no longer in your owned assets., restoring appropriate focus and clamped scroll position. After a terminal detail-refresh failure, OK SHALL return to the parent Assets list through a fresh covered read if necessary.

#### Scenario: Empty versus failed query
- **WHEN** a fresh query succeeds with zero holdings or both read attempts fail
- **THEN** the former reveals No assets found and the latter keeps the source page covered by an error with OK

#### Scenario: Detail refresh updates or removes a holding
- **WHEN** Refresh returns a changed quantity or no longer contains the selected asset
- **THEN** the prepared detail shows the exact new quantity or the prepared list is revealed with appropriate focus and scroll

### Requirement: Account isolation and API compatibility
Asset presentation SHALL belong to the active account and current presentation session. Leaving the asset flow, switching or clearing accounts, reset, unmount, and disposal SHALL clear presentation values and invalidate delayed reads and copy feedback. Existing public asset listing SHALL remain UI-independent and SHALL NOT navigate or update runtime asset presentation as a side effect. C1 Mint Asset and C4 List Assets SHALL retain their existing Admin behavior. Inspection SHALL NOT submit transactions or require unrelated pending wallet operations to complete.

#### Scenario: Leave and reenter during loading
- **WHEN** a player leaves a pending asset read and enters Assets again, or another account becomes active
- **THEN** only results for the new presentation session and account can populate the view

#### Scenario: Admin listing while runtime exists
- **WHEN** a host calls the public listing API or executes the existing C4 action where enabled
- **THEN** results remain available to that caller without opening, clearing, or changing the runtime view
