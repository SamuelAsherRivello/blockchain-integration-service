## MODIFIED Requirements

### Requirement: Available and total balances
Account Details SHALL show Total balance first, then Bitcoin balance on the left and Arkade balance on the right, with separate read-only values and Copy controls. The player-facing label Available balance SHALL be removed. Bitcoin SHALL represent boarding totals; Arkade SHALL represent full Arkade-side totals, including temporarily unavailable funds. The two SHALL sum to Total. All amounts SHALL be validated nonnegative safe integer sats from a fresh read belonging to the active account. Failed, partial or inconsistent reads SHALL NOT appear as zero. Network: Signet SHALL remain visible.

#### Scenario: Successful nonzero read
- **WHEN** the SDK reports total 1500, boarding 500 and spendable 800 sats
- **THEN** the UI shows Total 1500, Bitcoin 500 and Arkade 1000 sats, each with its own copy action

#### Scenario: Genuine zero balance
- **WHEN** a complete read reports all zeros
- **THEN** each balance displays 0 sats
- **AND** a failed read displays unavailable rather than zero or previous balances

## ADDED Requirements

### Requirement: Transfer entry from Account Details
Account Details SHALL place Bitcoin <-> Arkade immediately above Recovery Phrase and open Account Transfer for the active account. Existing refresh and account navigation SHALL remain available. Transfer entry and return SHALL read fresh balances and SHALL NOT move funds.

#### Scenario: Open and return
- **WHEN** the player opens Account Transfer and then selects Back
- **THEN** Account Details returns with a fresh read and no transfer submitted
