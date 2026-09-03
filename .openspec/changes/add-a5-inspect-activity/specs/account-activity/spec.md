## Purpose

Allow players and host applications to inspect and copy all Signet transaction history supplied by Arkade, including pending incoming funds and past incoming and outgoing transactions.

## ADDED Requirements

### Requirement: Arkade-supplied transaction history
The integration SHALL obtain activity only through the Arkade SDK and display all transaction history it supplies, including incoming and outgoing, pending and confirmed, and spent entries. It SHALL NOT filter history to current UTXOs or pending deposits, truncate available history to a recent-only subset, or remove a record solely because its output is spent. Its built-in providers MAY supply underlying Bitcoin data. The application SHALL NOT introduce a separate explorer client, custom server, simulated transaction results, or infer receipt from a balance change. Delivery SHALL require verification that the wallet API exposes existing unconfirmed deposits and subsequent updates. Completeness SHALL mean all history available from Arkade, without claiming records the SDK does not provide.

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
The dialog SHALL be titled Account Activity and show the active Account ID at the top, followed by a Transactions label with one Copy button and one read-only multiline text area. The text area SHALL contain one transaction per logical line, formatted with amount in sats, Incoming/Outgoing direction, supported status, and available transaction/output identifier. A line SHALL use the form `100 sats | Incoming | Pending | txid:output-index` when those facts are known. If no output index is supplied, the identifier SHALL use available transaction references without an invented index. Copy SHALL copy the entire current text area contents in displayed order and report success only after clipboard success. Failed copying SHALL preserve selectable text and show failure feedback. Copy SHALL be disabled when no transaction lines are available or data is unavailable. The dialog SHALL NOT require individual entry fields, individual Copy buttons, or explorer links. Bitcoin confirmation SHALL NOT imply spendable Arkade balance or completed boarding. Offchain settlement SHALL NOT be labeled Bitcoin confirmation. Unknown status SHALL remain unknown. Unavailable timestamps SHALL NOT appear as real transaction dates. Repeated observations SHALL NOT duplicate amounts or entries.

#### Scenario: Copy all transactions
- **WHEN** a player opens Account Activity containing multiple transactions and selects Copy
- **THEN** the entire text area is copied, including every line's amount, direction, status, and identifiers in displayed order, with truthful success or failure feedback

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
The public integration API SHALL expose normalized incoming and outgoing transaction history and loading, ready, and unavailable states without SDK-specific types or secrets. Opening Activity SHALL load existing history and enable automatic updates while open. A successful empty result SHALL say No transactions found and be distinguishable from an unavailable read or subscription. The Transactions text area SHALL show exactly Loading... during initial load and manual refresh; no separate loading paragraph or More Information field SHALL be added. Account Activity SHALL show a lightning-prefixed Refresh button immediately above Back, disabled while loading, matching Account Details. Unavailable state SHALL offer Refresh and SHALL NOT present prior data as current.

#### Scenario: Arrival while open
- **WHEN** a new incoming or outgoing transaction is reported while Activity is open
- **THEN** public state and the production list update without clicking Refresh Balance, including arrivals during initial loading

#### Scenario: Failure after success
- **WHEN** an activity read or detected monitoring failure occurs after a successful display
- **THEN** Activity reports unavailable rather than an empty successful list or apparently current prior result

### Requirement: Account-scoped activity lifecycle
Activity SHALL be transient and scoped to the active account and open view. Back SHALL return to Account. Leaving Activity, logout, account replacement, reset, and disposal SHALL stop its monitoring and clear its state. Late results SHALL NOT repopulate a closed view or another account's state.

#### Scenario: Account changes during a request
- **WHEN** the account changes before an activity request or callback finishes
- **THEN** the prior result is ignored and no prior account entry appears for the new account

#### Scenario: Reopen Activity
- **WHEN** a player returns to Activity after leaving it
- **THEN** a fresh SDK read runs and exactly one active monitoring lifecycle serves that view
