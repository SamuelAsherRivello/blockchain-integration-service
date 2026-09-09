## MODIFIED Requirements

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
