# game-wallet-player-payment Specification

## Purpose

Enable a real fixed-value payment from the independent game wallet to the preview player, with verified, session-safe receipt feedback.

**F3 story status:** Complete ✓ — confirmed by the user on 2026-09-09.

## Requirements

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
Only verified incoming evidence correlated to the F3 transaction, original recipient and exact 1000-sat amount SHALL trigger `User <short sender ID> sent you 1000 sats (Confirmed)` in the original still-active preview session. The sender ID SHALL use its public profile ID's first four and last five characters separated by `....`; IDs of nine or fewer characters SHALL remain whole. The notification SHALL reuse shared toast ordering, default duration and runtime containment and occur at most once per payment status per operation. Submission acknowledgment or an uncorrelated balance increase SHALL NOT establish receipt.

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
BIS SHALL observe incoming Bitcoin and Arkade sats and own Bitcoin-to-Arkade or Arkade-to-Bitcoin transfers throughout the logged-in session independently of Account visibility. Unknown senders SHALL use `Unknown User sent you <amount> sats`. Pending messages SHALL append ` (Pending)`. Final incoming Arkade receipt messages, including F3, SHALL append ` (Confirmed)` when fresh SDK-owned spendable outputs match the transaction and exact received amount, or the SDK supplies settlement evidence; this label SHALL confirm Arkade receipt and SHALL NOT assert batch settlement or Bitcoin confirmation. Other final messages SHALL omit the pending suffix and retain their existing wording. Bitcoin final requires one confirmation, Arkade final requires verified receipt or settlement, and own transfers require verified completion. Own-transfer wording SHALL be `Transferred <amount> sats From Bitcoin To Arkade` or the reverse. Asset-only receipts and change SHALL NOT notify. A balance increase, submission acknowledgment or elapsed time SHALL NOT establish receipt. Receipt identity and session status tracking SHALL survive repeated snapshots and observer reconnection without losing a pending-to-settled transition or duplicating a notification.

#### Scenario: Pending and final
- **WHEN** a new receipt progresses from pending to confirmed or settled
- **THEN** exactly one pending and one final toast appear with the actual amount
- **AND** already-settled new receipts show only the final toast; new preconfirmed Arkade receipts verified spendable on first observation follow the pending-then-confirmed scenario below

#### Scenario: F3 Arkade settlement
- **WHEN** a pending F3 receipt for 1000 sats later has SDK-verified spendable receipt in the same active recipient session
- **THEN** `User <short sender ID> sent you 1000 sats (Confirmed)` follows the existing pending toast through the shared queue, even if Balance is closed
- **AND** repeated snapshots or metadata-only changes do not replay either toast

#### Scenario: Balance updates before settlement evidence
- **WHEN** Arkade balance increases but both spendable receipt and settlement evidence for the pending receipt are absent
- **THEN** no confirmed toast is fabricated and observation continues so later verified receipt produces the final toast

#### Scenario: History and reconnection
- **WHEN** a player logs in or reloads
- **THEN** loaded history establishes a silent baseline
- **AND** later new receipts and pending-to-final transitions notify without replay on observer reconnection

#### Scenario: Own transfers
- **WHEN** an own transfer is submitted then verified
- **THEN** pending and final notifications use transfer direction wording without attributing it to another user

#### Scenario: Stopped recipient session
- **WHEN** the recipient logs out, changes account or disposes its context before settlement arrives
- **THEN** the old session emits no confirmation into the new session


#### Scenario: Spendable receipt on its first observation
- **WHEN** a new preconfirmed incoming Arkade receipt is already verified spendable on its first live observation
- **THEN** its pending toast and Confirmed toast are queued in order once, while a login baseline stays silent
