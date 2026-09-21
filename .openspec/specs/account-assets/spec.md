# account-assets Specification

## Purpose

Let players inspect every owned asset and its exact quantity through a reusable runtime list/detail flow. Inspection is read-only; burning requires the separate explicit confirmation contract.

## Requirements

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

### Requirement: Complete and exact ownership presentation
Assets SHALL include all positive holdings returned by the existing fresh ownership query, including non-BIS assets, ordered by asset ID. Each closed row SHALL use shared two-column by three-row compact geometry with six emoji-value fields: name, exact quantity, ticker, ownership status, decimals, and network. The HTTPS metadata icon image with no referrer SHALL lead; missing or failed artwork SHALL use the toast success glyph. Asset IDs remain in detail/reports, not the priority row. Owned rows use toast success-green with black outline-only hover/focus/selection feedback. Quantities SHALL use integer base units and known valid decimals without floating-point rounding; absent or invalid decimals SHALL display truthful base units.

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
Asset presentation SHALL belong to the active account and current presentation session. Leaving the asset flow, switching or clearing accounts, reset, unmount, and disposal SHALL clear presentation values and invalidate delayed reads and copy feedback. Existing public asset listing SHALL remain UI-independent and SHALL NOT navigate or update runtime asset presentation as a side effect. C1 Mint Asset and Asset listing SHALL retain their existing Admin behavior. Inspection SHALL NOT submit transactions or require unrelated pending wallet operations to complete.

#### Scenario: Leave and reenter during loading
- **WHEN** a player leaves a pending asset read and enters Assets again, or another account becomes active
- **THEN** only results for the new presentation session and account can populate the view

#### Scenario: Admin listing while runtime exists
- **WHEN** a host calls the public listing API or executes the existing asset-listing action where enabled
- **THEN** results remain available to that caller without opening, clearing, or changing the runtime view

### Requirement: Event-driven visible asset updates
While Assets is open, BIS SHALL observe output changes for the current account receive scripts, including subdust, and refresh holdings on incoming, spent or swept output events without periodic asset polling. Event refreshes SHALL preserve an already prepared page without a covering progress dialog and coalesce bursts into a bounded number of reads. Leaving Assets, changing account or disposing the context SHALL stop observation and invalidate late results. Stream unavailability SHALL leave manual Refresh available without introducing a polling fallback.

#### Scenario: Holding changes while visible
- **WHEN** the stream reports an output change while Assets is open
- **THEN** a fresh read updates quantities or removes absent holdings without requiring a click or opening a progress overlay

#### Scenario: Exit and late events
- **WHEN** the player leaves Assets or changes account
- **THEN** the subscription is stopped and late callbacks cannot refresh or reopen the former view

### Requirement: Assets provide marketplace loadout access
The BIS Assets experience SHALL recognize a Stealth & Steel marketplace item only from verified chain asset metadata that identifies the game, identifies the asset type as an item rather than trophy, and provides its stable catalog identity, family, tier, price, and runtime icon URL. It SHALL provide access to loadout management for recognized items while preserving inspection and existing safeguards for trophies, generic assets, and all other assets.

#### Scenario: Player opens Assets with catalog and generic assets
- **WHEN** a player has both a chain-classified Stealth & Steel item and a generic Signet asset
- **THEN** Assets shows the generic asset without change and exposes loadout controls only for the recognized equipment

#### Scenario: Trophy is not treated as equipment
- **WHEN** an owned Stealth & Steel asset identifies its asset type as a trophy
- **THEN** Assets keeps the trophy inspectable as an asset
- **AND** it does not offer that trophy as a Shoes, Dagger, or Shield selection

### Requirement: Equipment icons use chain asset URLs
Every Stealth & Steel equipment icon rendered by BIS SHALL load at runtime from the URL carried by that chain asset. BIS SHALL NOT substitute a catalog-ID-to-bundled-icon mapping as the source of the item image.

#### Scenario: BIS renders a recognized item
- **WHEN** BIS renders a recognized Stealth & Steel item whose chain metadata contains an icon URL
- **THEN** the rendered image request uses that chain-provided URL

### Requirement: Asset detail exposes actionable identity and provenance
Asset Detail SHALL show the full Asset ID, exact owned quantity and base-unit quantity, Name, Ticker, Decimals, the active account network, the network-correct Explorer URL when available, and Icon URL when available. It SHALL also show a source or mint transaction ID and mint operation ID when those identifiers are known for the selected holding. Unknown or unavailable values SHALL be labeled `Not available` and SHALL never be inferred from a name, ticker, balance change, or asset ID.

The detail report and its copy action SHALL include these labeled values in stable order. Full identifiers SHALL remain selectable and usable for manual copying without wrapping away the significant characters.

#### Scenario: Level 3 achievement has inspectable identity
- **WHEN** the player opens an owned asset with name `Achievement: Level 3`, ticker `LVL3`, decimals `0`, and quantity `1`
- **THEN** Asset Detail shows those values plus the complete Asset ID, active network, Explorer URL, and any known source transaction or mint operation identifiers
- **AND** the copied report contains the same values and the exact base-unit quantity `1`

#### Scenario: External holding has no local provenance
- **WHEN** an owned asset was created outside BIS and no source transaction or mint operation record is available
- **THEN** Asset Detail remains usable and labels those provenance fields `Not available`
- **AND** it does not claim that the holding completed a BIS mint operation

### Requirement: Asset detail actions use the selected account and network
For a valid selected owned holding, Open On Explorer SHALL open the explorer URL for the active account's verified network in a new tab with safe opener protections. Burn SHALL remain enabled until the player explicitly confirms or the holding/account state becomes invalid, and SHALL submit the selected asset ID and entire displayed base-unit quantity through the existing burn safety contract. A missing or unsupported explorer URL SHALL disable only Open On Explorer and expose an accessible reason; it SHALL not disable Burn.

#### Scenario: Mutinynet asset opens the Mutinynet explorer
- **WHEN** the active account is verified on Mutinynet and the selected asset has a valid Asset ID
- **THEN** Open On Explorer is enabled and opens the Mutinynet asset page
- **AND** the action does not use the Signet URL

#### Scenario: Explorer URL unavailable but burn is valid
- **WHEN** the selected asset is owned and burnable but its explorer URL cannot be constructed
- **THEN** Open On Explorer is disabled with an accessible explanation
- **AND** Burn remains available and uses the selected asset's exact base-unit quantity after confirmation

#### Scenario: Selection changes before an action completes
- **WHEN** the player changes account, leaves Asset Detail, or the selected holding disappears before a delayed action completes
- **THEN** the obsolete action cannot open an explorer page for another asset or submit a burn under another account
