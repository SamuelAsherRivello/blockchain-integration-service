# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal truthful presentation
The dialog SHALL be titled Transactions. Account ID and its Copy action SHALL appear only on Accounts Details, not in Transactions or Transaction Detail. The list SHALL retain the delivered compact rows: operation and amount, On-chain or Off-chain network, and a shortened primary identifier. Full direction, supported status, identifiers, available timestamps and exact asset quantities SHALL remain in Transaction Detail and the full-list export. One click SHALL open Transaction Detail with a selectable full report and its own Copy action. Detail Back SHALL return to the list and retain selection; leaving Activity SHALL clear selection. Both views SHALL retain the native compact 384px height capped by available host space. The list and full detail text SHALL scroll internally with persistent scrollbars, without whole-dialog or host-window scrolling.

The Transactions list page SHALL use the same 456px parent-card height, 3.5-row list viewport, persistent vertical scrollbar, stable scrollbar gutter, visible Back footer, and closed-row width and height as Assets and Contracts. A successful empty or short result SHALL retain that complete viewport and scrollbar setup.

Copy all transactions SHALL export every current record in displayed order, one transaction per logical line, with amount in sats or explicit unknown amount, direction, full supported status, available identifiers, and exact asset quantities where supplied. It SHALL NOT truncate identifiers or invent output indexes. Clipboard success SHALL be reported only after writing succeeds. Clipboard failure SHALL expose the entire export as selectable read-only text and allow retry. Copy-all SHALL be disabled during loading and without records. Per-transaction Copy SHALL remain separate and copy only the selected report.

Bitcoin confirmation SHALL NOT imply spendable Arkade balance or completed boarding. Offchain settlement SHALL NOT be labeled Bitcoin confirmation. Unknown status SHALL remain unknown. Unavailable timestamps SHALL NOT appear as real transaction dates. Repeated observations SHALL NOT duplicate amounts or entries.

#### Scenario: Copy all transactions
- **WHEN** a player opens Transactions containing multiple transactions
- **THEN** every current record is exported as one line with its full amount, direction, status, identifiers and available asset data in displayed order, with truthful success or failure feedback

#### Scenario: Empty or short transaction list
- **WHEN** the transaction read succeeds with zero, one, or two records
- **THEN** Transactions retains its fixed 3.5-row viewport, visible persistent scrollbar, and equal row geometry contract for any rows that are present

#### Scenario: Consistent collection row geometry
- **WHEN** a transaction row is displayed beside an asset or contract row
- **THEN** its rendered width and height are exactly equal to the other collection row types

#### Scenario: Identifier is incomplete
- **WHEN** Arkade supplies a history record with a transaction ID but no output index
- **THEN** the line contains that transaction ID without fabricating an output index or dropping the record

#### Scenario: Confirmed deposit
- **WHEN** the SDK reports Bitcoin confirmation for a previously unconfirmed deposit
- **THEN** the same entry reflects confirmation without asserting that its funds are available to spend

#### Scenario: Pending transaction disappears
- **WHEN** a fresh SDK snapshot no longer contains a previously observed pending entry
- **THEN** it is reconciled out of the current pending list without being relabeled confirmed, failed, or replaced without supporting evidence
