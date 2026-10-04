## MODIFIED Requirements

### Requirement: Direct send entry
Send SHALL support only same-selected-network Arkade-to-Arkade payments with manual recipient entry, explicit Paste, live spendable funds, whole-sats amount, and Max. It SHALL omit Bitcoin source/destination choices, Lightning, QR, and fiat controls. Unsupported, invalid, mainnet, self, foreign-operator, or different-test-network recipients SHALL be rejected. Unknown funds SHALL be unavailable rather than zero.

#### Scenario: Cross-network recipient
- **WHEN** a Mutinynet Player Wallet enters a Signet or otherwise different-network recipient
- **THEN** BIS rejects the recipient before Review Send and does not request a payment quote

#### Scenario: Usable entry
- **WHEN** a user enters a supported same-network recipient and affordable positive whole-sats amount
- **THEN** Review Send is available without automatically sending or converting funds

#### Scenario: Clipboard race
- **WHEN** Paste fails or completes after newer edits
- **THEN** manual entry remains usable and newer input is preserved

### Requirement: Exact review and confirmation
Review SHALL show full recipient, source, payment type, the selected test-network name, exact recipient amount, aggregate fee, and total deducted. Max SHALL respect fees and dust. Back SHALL preserve the draft. Only explicit confirmation of the current account's issued, unexpired, unchanged review on the still-selected network SHALL authorize submission.

#### Scenario: Network changes after review
- **WHEN** the selected test network changes after a send review is issued
- **THEN** submission is rejected and fresh login plus a fresh review are required

#### Scenario: Stale or forged review
- **WHEN** account, inputs, amount, recipient, fee, or network session changes, or the quote expires or is replayed
- **THEN** submission is rejected and a fresh review is required
