# account-activity Specification

## Purpose
Allow players and host applications to inspect and copy all Signet transaction history supplied by Arkade, including pending incoming funds and past incoming and outgoing transactions.

**Story status:** A5 ✓ — complete, confirmed by the user on 2026-09-09.

## Requirements

### Requirement: Pending activity belongs to Transactions
Accounts Details SHALL provide Transactions as the single destination for transaction history and pending wallet activity, with no separate Pending Operations button or panel. Pending saved records SHALL join existing rows by operation reference or known transaction ID; records absent from network history SHALL remain inspectable without invented amounts, timestamps or success. Unsent drafts SHALL be labeled Not submitted and unknown submitted outcomes SHALL remain pending. The selected transaction detail SHALL include only its matching recovery records, reservation information, Check Status, Copy Recovery Details and discard controls only for eligible unsent transfer drafts. Discard SHALL preserve recovery history and SHALL NOT imply network cancellation. Recovery actions SHALL fit the compact dialog with Back accessible.

#### Scenario: Existing network record also has a pending operation
- **WHEN** a saved operation matches an existing transaction ID
- **THEN** Transactions retains one history row and its detail contains the matching recovery data and actions

#### Scenario: Unsent draft is discarded
- **WHEN** the player selects an eligible unsent draft in Transactions and discards it
- **THEN** only that draft is discarded, submitted records retain recovery protection, and the list refreshes without claiming cancellation

### Requirement: Bounded loading and asset history
Initial Activity loading SHALL allow 75 seconds per attempt and automatically retry once under the Pending Operation Dialog. After two failures, the dialog SHALL show an error and only OK, which closes it and the source page. History reads SHALL begin without awaiting notification subscription setup. Polling SHALL remain available when subscription setup fails or stalls. Cleanup SHALL NOT delay failure reporting, and late results after cancellation SHALL be ignored.

Transactions SHALL retain SDK asset mint, receive, and transfer entries, including asset identifiers and exact signed integer quantities. Negative outgoing asset deltas, including burns, SHALL remain valid history and preserve their sign without rounding. Quantities without known decimal metadata SHALL be labeled base units. Account-scoped saved mint and transfer operations MAY supplement SDK history, with explicit pending or recorded statuses rather than fabricated confirmation, timestamps, or sats. Matching known transaction references SHALL avoid duplicate local mint entries. On live history failure, saved operations MAY remain visible with a notice that live history is unavailable; Copy SHALL remain available for that displayed text.

#### Scenario: Subscription or cleanup never completes
- **WHEN** notification setup stalls or wallet cleanup never resolves
- **THEN** initial history can load independently and exhausted foreground failures show the operation error and OK without waiting for cleanup

#### Scenario: Asset amount exceeds safe JavaScript integer range
- **WHEN** SDK history includes an asset quantity larger than the safe integer range
- **THEN** Transactions and Copy preserve every digit alongside the asset ID and supported status

#### Scenario: Outgoing asset delta
- **WHEN** history includes a negative asset quantity for an outgoing transaction or burn
- **THEN** the history loads successfully and displayed or copied details retain its exact signed quantity alongside other records

### Requirement: Arkade-supplied transaction history
The integration SHALL obtain network transaction history only through the Arkade SDK and display all transaction history it supplies, including incoming and outgoing, pending and confirmed, and spent entries. It SHALL NOT filter history to current UTXOs or pending deposits, truncate available history to a recent-only subset, or remove a record solely because its output is spent. Its built-in providers MAY supply underlying Bitcoin data. The application SHALL NOT introduce a separate explorer client, custom server, simulated transaction results, or infer receipt from a balance change. Delivery SHALL require verification that the wallet API exposes existing unconfirmed deposits and subsequent updates. Completeness SHALL mean all history available from Arkade, without claiming records the SDK does not provide.

#### Scenario: Existing unconfirmed deposit
- **WHEN** Activity opens for an active account whose SDK reports an unconfirmed incoming deposit
- **THEN** it shows its amount in sats, Incoming direction, available transaction/output identifier, and Pending status even when the available balance has not changed

#### Scenario: Retain full available history
- **WHEN** Arkade supplies incoming and outgoing records including confirmed and spent entries
- **THEN** all appear in the list, including older records and records no longer present in current UTXOs

#### Scenario: SDK capability is insufficient
- **WHEN** the wallet API cannot supply the required deposit/status information
- **THEN** the implementation is reported blocked by that limitation and no separate explorer integration is substituted

### Requirement: Minimal truthful presentation
The dialog SHALL be titled Transactions. Account ID and its Copy action SHALL appear only on Accounts Details, not in Transactions or Transaction Detail. The list SHALL retain the delivered three-line rows: operation and amount, On-chain or Off-chain network, and a shortened primary identifier. Full direction, supported status, identifiers, available timestamps and exact asset quantities SHALL remain in Transaction Detail and the full-list export. One click SHALL open Transaction Detail with a selectable full report and its own Copy action. Detail Back SHALL return to the list and retain selection; leaving Activity SHALL clear selection. Both views SHALL retain the native compact 384px height capped by available host space. The list and full detail text SHALL scroll internally with persistent scrollbars, without whole-dialog or host-window scrolling.

Copy all transactions SHALL export every current record in displayed order, one transaction per logical line, with amount in sats or explicit unknown amount, direction, full supported status, available identifiers, and exact asset quantities where supplied. It SHALL NOT truncate identifiers or invent output indexes. Clipboard success SHALL be reported only after writing succeeds. Clipboard failure SHALL expose the entire export as selectable read-only text and allow retry. Copy-all SHALL be disabled during loading and without records. Per-transaction Copy SHALL remain separate and copy only the selected report.

Bitcoin confirmation SHALL NOT imply spendable Arkade balance or completed boarding. Offchain settlement SHALL NOT be labeled Bitcoin confirmation. Unknown status SHALL remain unknown. Unavailable timestamps SHALL NOT appear as real transaction dates. Repeated observations SHALL NOT duplicate amounts or entries.

#### Scenario: Copy all transactions
- **WHEN** a player opens Transactions containing multiple transactions and selects Copy all transactions
- **THEN** every current record is exported as one line with its full amount, direction, status, identifiers and available asset data in displayed order, with truthful success or failure feedback

#### Scenario: Identifier is incomplete
- **WHEN** Arkade supplies a history record with a transaction ID but no output index
- **THEN** the line contains that transaction ID without fabricating an output index or dropping the record

#### Scenario: Confirmed deposit
- **WHEN** the SDK reports Bitcoin confirmation for a previously unconfirmed deposit
- **THEN** the same entry reflects confirmation without asserting that its funds are available to spend

#### Scenario: Pending transaction disappears
- **WHEN** a fresh SDK snapshot no longer contains a previously observed pending entry
- **THEN** it is reconciled out of the current pending list without being relabeled confirmed, failed, or replaced without supporting evidence

### Requirement: Newest-first history
Transactions SHALL be ordered newest first using available SDK transaction timestamps. Equal timestamps SHALL retain SDK order. Pending records without usable timestamps SHALL appear first in SDK order; other undated records SHALL follow dated records in SDK order. The integration SHALL NOT manufacture transaction timestamps from retrieval time or epoch-zero placeholders.

#### Scenario: Mixed dated and undated records
- **WHEN** the SDK supplies timestamped transactions, timestamp-free pending entries, and other undated records
- **THEN** undated pending entries appear first, timestamped entries follow newest first, and other undated entries follow in SDK order

### Requirement: Public state and freshness
The public integration API SHALL expose normalized incoming and outgoing transaction history and loading, ready, and unavailable states without SDK-specific types or secrets. Opening Activity SHALL load existing history and enable automatic updates while open. A successful empty result SHALL retain the Transactions heading, disabled copy icon, list space and scrollbar without an empty-state message; it SHALL remain distinguishable from an unavailable read. Subscription failure alone SHALL permit polling fallback. Initial load and manual refresh SHALL be covered immediately by the Pending Operation Dialog with no inline loading text. Only prepared content SHALL be revealed; final loading errors and OK SHALL close the source page. Transactions SHALL provide an explicitly labeled Refresh control, disabled while loading, matching Balance. Unavailable foreground loads SHALL use the Pending Operation Dialog failure contract and SHALL NOT present prior data as current.

#### Scenario: Arrival while open
- **WHEN** a new incoming or outgoing transaction is reported while Activity is open
- **THEN** public state and the production list update without clicking Refresh Balance, including arrivals during initial loading

#### Scenario: Failure after success
- **WHEN** an activity read or detected monitoring failure occurs after a successful display
- **THEN** Activity reports unavailable rather than an empty successful list or apparently current prior result

### Requirement: Account-scoped activity lifecycle
Activity SHALL be transient and scoped to the active account and open view. List Back SHALL return to the Accounts Details submenu; its Back SHALL return to Account. Leaving Activity, logout, account replacement, reset, and disposal SHALL stop its monitoring and clear its state. Late results SHALL NOT repopulate a closed view or another account's state.

#### Scenario: Account changes during a request
- **WHEN** the account changes before an activity request or callback finishes
- **THEN** the prior result is ignored and no prior account entry appears for the new account

#### Scenario: Reopen Activity
- **WHEN** a player returns to Activity after leaving it
- **THEN** a fresh SDK read runs and exactly one active monitoring lifecycle serves that view

### Requirement: Three transaction detail actions
Transaction Detail SHALL retain its Transaction label, inline copy icon, and selectable report. Its action area SHALL contain exactly View Recovery Info, Open On Explorer, and Back, in that order. View Recovery Info SHALL be disabled when no recovery report exists for the selected record. Open On Explorer SHALL remain disabled without a supported explorer URL, with its reason accessible on the control. The view SHALL NOT show a bottom explorer-unavailable text block or additional bottom textfield. Detail Back SHALL return to Transactions and retain selection.

#### Scenario: Pending transaction without an explorer identifier
- **WHEN** a pending transaction with recovery information but no explorer URL is opened
- **THEN** the three actions are visible, View Recovery Info is enabled, Open On Explorer is disabled, and no explanatory textfield or explorer message appears below Back

#### Scenario: Ordinary transaction
- **WHEN** a transaction has no recovery report
- **THEN** View Recovery Info remains visible and disabled, and the existing explorer and Back behavior remains available as appropriate

### Requirement: Matching recovery information dialog
View Recovery Info SHALL open a dialog inside the BIS overlay with visible title Recovery Info. It SHALL match Transaction Detail typography, colors, report styling, compact card layout and internally scrolling report. A Recovery Info label SHALL have an adjacent copy icon above a selectable read-only report for the selected transaction. Back SHALL be the only footer action and SHALL dismiss the dialog, leaving the originating Transaction Detail selection intact. There SHALL be no Check Status, standalone Copy Recovery Details, discard, explorer, or refresh action in this dialog. Report generation and copying SHALL remain read-only and secret-free.

#### Scenario: Open and return
- **WHEN** the player selects View Recovery Info and then Back in the new dialog
- **THEN** the matching Recovery Info dialog closes and the original selected Transaction Detail remains open

#### Scenario: Clipboard failure
- **WHEN** copying fails
- **THEN** the dialog retains selectable report text and truthful accessible feedback without additional action buttons

#### Scenario: Dialog navigation stays inside BIS
- **WHEN** Recovery Info opens
- **THEN** no browser window is created, the originating card is inert, keyboard focus stays inside the recovery dialog, and Back or Escape restores the originating detail and trigger focus

#### Scenario: Copy selected recovery report
- **WHEN** the player activates the copy icon beside Recovery Info
- **THEN** only the selected recovery report is copied and success is indicated only after the clipboard write succeeds
