## Purpose

Enable a real fixed-value payment from the independent game wallet to the preview player, with verified, session-safe receipt feedback.

## ADDED Requirements

### Requirement: Fixed game wallet payment
An explicit eligible payment action SHALL send exactly 1000 Signet sats from the selected F1 game wallet to the active preview player's Arkade receiving address. The system SHALL validate distinct identities, current recipient, available funds including fees and sender mutation eligibility before submitting. It SHALL preserve unrelated asset holdings and wallet isolation.

#### Scenario: Eligible payment
- **WHEN** the operator activates the action with two distinct ready accounts and sufficient spendable funds
- **THEN** one real 1000-sat payment is submitted from F1 to the preview player
- **AND** any fee is accounted for separately from the recipient's 1000 sats

#### Scenario: Ineligible sender or recipient
- **WHEN** either account is unavailable, the accounts match, funds including fees are insufficient, or a conflicting sender operation exists
- **THEN** no payment is submitted and the action is unavailable with truthful Admin feedback

### Requirement: Durable payment identity and uncertainty
Each payment SHALL retain its original sender, recipient, amount and operation identity for reconciliation. Repeated activation while unresolved SHALL NOT create another payment. Unknown outcomes SHALL remain pending without automatic resubmission. Session changes SHALL NOT retarget a submitted payment or erase recovery evidence.

#### Scenario: Timeout and reload
- **WHEN** submission times out and the page reloads before resolution
- **THEN** the original operation is reconciled without submitting a replacement or claiming failure as certain

#### Scenario: Concurrent activation
- **WHEN** a repeated click or another tab attempts payment while the sender has a conflicting unresolved mutation
- **THEN** no additional conflicting submission occurs

#### Scenario: Account replacement
- **WHEN** the selected sender or player changes during preparation
- **THEN** stale preparation cannot submit against the new identity
- **AND** any already-submitted operation remains attached to the original identities

### Requirement: Verified receipt notification
Only verified incoming evidence correlated to the F2 transaction, original recipient and exact 1000-sat amount SHALL trigger `User <short sender ID> Sent You 1000 Sats` in the original still-active preview session. The sender ID SHALL use its public profile ID's first four and last five characters separated by `....`; IDs of nine or fewer characters SHALL remain whole. The notification SHALL reuse shared toast ordering, default duration and runtime containment and occur at most once per payment status per operation. Submission acknowledgment or an uncorrelated balance increase SHALL NOT establish receipt.

#### Scenario: Player receives payment
- **WHEN** receipt is verified for the original active player session
- **THEN** one toast displays the exact message format with the actual shortened sender ID
- **AND** sender and recipient balances are refreshed from real data

#### Scenario: Failed or uncertain payment
- **WHEN** payment fails or incoming evidence is not yet sufficient
- **THEN** no final receipt toast appears and Admin reports the actual failed or pending status

#### Scenario: Duplicate evidence or departed session
- **WHEN** receipt events repeat, the player logs out, the preview context is replaced, or recovery occurs after reload
- **THEN** no duplicate or stale-session toast is delivered
- **AND** financial reconciliation remains independent of toast delivery

### Requirement: Shared incoming payment notifications
BIS SHALL observe incoming Bitcoin and Arkade sats and own Bitcoin-to-Arkade or Arkade-to-Bitcoin transfers throughout the logged-in session independently of Account visibility. Unknown senders SHALL use `Unknown User Sent You <amount> Sats`. Pending messages SHALL append ` (Pending)`; final messages SHALL omit it. Bitcoin final requires one confirmation, Arkade final requires settlement, and own transfers require verified completion. Own-transfer wording SHALL be `Transferred <amount> Sats From Bitcoin To Arkade` or the reverse. Asset-only receipts and change SHALL NOT notify.

#### Scenario: Pending and final
- **WHEN** a new receipt progresses from pending to confirmed or settled
- **THEN** exactly one pending and one final toast appear with the actual amount
- **AND** already-final new receipts show only the final toast

#### Scenario: History and reconnection
- **WHEN** a player logs in or reloads
- **THEN** loaded history establishes a silent baseline
- **AND** later new receipts and pending-to-final transitions notify without replay on observer reconnection

#### Scenario: Own transfers
- **WHEN** an own transfer is submitted then verified
- **THEN** pending and final notifications use transfer direction wording without attributing it to another user
