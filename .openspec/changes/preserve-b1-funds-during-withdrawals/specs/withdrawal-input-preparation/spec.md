## Purpose

Prepare only the funds needed for a Bitcoin withdrawal while keeping the remaining Arkade sats and assets independently spendable.

## ADDED Requirements

### Requirement: Reviewed same-account preparation
The system SHALL include any required same-account preparation in the withdrawal review, identifying the Bitcoin amount, combined verified fees, sats retained in Arkade, and asset preservation. Confirming this review SHALL authorize only its bounded preparation and withdrawal in the current account/session. Review, opening Account, and status checks SHALL NOT submit either leg. Changed amounts, ownership, fee terms or input inventory SHALL invalidate the review.

#### Scenario: Partial withdrawal from one asset-bearing input
- **WHEN** a player reviews 1000 sats to Bitcoin from a 263715-sat eligible input carrying two assets at verified zero fees
- **THEN** the review states 1000 sats to Bitcoin and 262715 sats retained in Arkade with both assets, including that funds will first be separated within the account
- **AND** no transaction is submitted until confirmation

#### Scenario: Existing exact funding
- **WHEN** eligible asset-free inputs exactly cover the reviewed withdrawal and fees
- **THEN** no additional preparation transaction is submitted

#### Scenario: Unsupported fees or change
- **WHEN** preparation fees, exact withdrawal funding, or valid retained asset change cannot be verified
- **THEN** confirmation is unavailable with the specific reason and no larger amount is submitted instead

### Requirement: Verify preparation before withdrawal
Preparation SHALL spend only reviewed, eligible, unreserved inputs into verified same-account outputs. The dedicated withdrawal output SHALL contain the exact funding required and no assets. All input assets SHALL be conserved in independently spendable owned change with exact integer quantities. The system SHALL verify the preparation transaction, its actual input ancestry, output indices, scripts, amounts, asset allocation and finalized spendability before registering the withdrawal. A returned identifier, matching balance or matching amount alone SHALL NOT establish preparation success.

#### Scenario: Correct preparation
- **WHEN** the preparation of 263715 sats is finalized and verified as 1000 asset-free sats plus 262715 sats with both original assets
- **THEN** only the verified 1000-sat output is reserved for withdrawal and the change becomes available to independent operations

#### Scenario: Wrong or unavailable receipt
- **WHEN** preparation returns an unknown result, swapped asset allocation, wrong amount, foreign script, unfinalized output or unavailable evidence
- **THEN** no withdrawal intent is registered and the relevant preparation inputs remain protected pending reconciliation

### Requirement: Durable two-leg lifecycle
The transfer SHALL preserve one user-visible identity with distinct preparation and withdrawal outcomes and public identifiers. Preparation uncertainty SHALL be persisted before network submission. Verified completion of preparation SHALL atomically hand off its dedicated output reservation before independent spending is enabled. Concurrent confirmations, account replacement, navigation, late callbacks and restart SHALL NOT duplicate either leg or create a gap where another payment can spend the dedicated output. A restart SHALL reconcile read-only and require fresh explicit confirmation before any unsubmitted withdrawal leg; it SHALL NOT automatically replay preparation.

#### Scenario: Lost preparation response and restart
- **WHEN** preparation may have reached the operator but its response is lost
- **THEN** its original inputs remain reserved, restart performs read-only verification, and neither preparation nor withdrawal is automatically submitted

#### Scenario: Preparation complete but withdrawal not submitted
- **WHEN** verified preparation survives restart without any withdrawal registration attempt
- **THEN** the user can review and confirm withdrawal using the original dedicated output without repeating preparation
- **AND** independently verified change remains spendable

#### Scenario: Interrupted withdrawal
- **WHEN** the withdrawal fails or becomes uncertain after verified preparation
- **THEN** its dedicated input remains protected and its separate change remains available

### Requirement: Immediate independent B1 after withdrawal acknowledgement
Once the confirmed transfer is presented as withdrawal pending, verified change SHALL already be independent of the withdrawal input. If it covers B1 and its fees, an explicit B1 request SHALL succeed without awaiting withdrawal completion or requiring logout, account replacement, additional funding, or manual reservation clearing. Preparation in progress SHALL be presented distinctly and SHALL NOT claim that the independent change is ready.

#### Scenario: User reproduction succeeds while withdrawal is pending
- **WHEN** a funded account restores 264715 sats, pays B1 to reach 263715 sats, then confirms a prepared 1000-sat Bitcoin withdrawal at zero fees and invokes B1 while that withdrawal is pending
- **THEN** B1 pays 1000 sats from the 262715-sat change, leaves 261715 independently owned sats with both assets, and preserves the separate 1000-sat withdrawal reservation

#### Scenario: Remainder is genuinely insufficient
- **WHEN** Max or another reviewed amount leaves less than B1 plus its fees
- **THEN** B1 reports the real independent-funds shortfall and does not spend the withdrawal input
