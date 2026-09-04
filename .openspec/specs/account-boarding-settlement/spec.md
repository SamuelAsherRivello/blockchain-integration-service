# account-boarding-settlement Specification

## Purpose
Let a player review movement between the Bitcoin and Arkade parts of their Signet account without confusing balance totals with spending eligibility.

## Requirements

### Requirement: Account Transfer presentation
Account Transfer SHALL show Total, Bitcoin and Arkade balances, selectable Bitcoin-to-Arkade and Arkade-to-Bitcoin directions, an editable nonnegative integer sats amount with minus/plus/Max controls, Review Transfer and Back. Back from review SHALL return to entry; Back from entry SHALL return to Account Details. Entry SHALL reset on leaving or account replacement.

#### Scenario: Review an amount
- **WHEN** the player selects a direction and valid positive amount and chooses Review Transfer
- **THEN** the review shows that direction and amount with fee and resulting balances, or explicitly unavailable values if no verified quote exists

### Requirement: Honest capability availability
Availability SHALL be determined independently for each direction. Max and quote review SHALL become available after eligibility and quotes are verified. Confirm Transfer SHALL remain unavailable until submission/reconciliation safeguards pass their tests; the first explicitly confirmed Signet transfer then provides live verification. No stage SHALL display fabricated quotes, projected balances, or success. Each direction SHALL pass its own quote and recovery checks before confirmation becomes available. Live verification MAY start with Arkade-to-Bitcoin when the account has no boarding funds; both direction tests remain required. Displaying the UI SHALL NOT count as completion of real transfers.

#### Scenario: Unverified service
- **WHEN** the transfer screen opens without a verified transfer service
- **THEN** entry and review remain inspectable but no funds can move

#### Scenario: Boarding ready before withdrawal
- **WHEN** Bitcoin-to-Arkade has passed its quote and recovery safeguards but Arkade-to-Bitcoin has not
- **THEN** boarding can be quoted and explicitly confirmed while reverse transfer controls remain unavailable
- **AND** switching direction invalidates the previous quote

#### Scenario: Partial amount unsupported
- **WHEN** the player requests a partial amount that cannot be transferred with verified change handling
- **THEN** the UI explains the unsupported amount and does not quote or submit the whole deposit instead

### Requirement: Verified live transfers
When supported, confirmation SHALL revalidate the reviewed inputs, account and fee and submit only the selected same-account transfer. Changed terms SHALL require review again. Pending or uncertain outcomes SHALL be reconciled before retry across navigation/restart, preventing duplicate submissions. Completion SHALL refresh real balances and Activity. Partial Bitcoin change and the reverse Bitcoin destination SHALL be verified before enabling these paths.

#### Scenario: Interrupted submission
- **WHEN** a submitted operation has an unknown outcome after interruption
- **THEN** it remains unresolved until reconciled and cannot be blindly resubmitted

### Requirement: Read-only account inspection
Account restoration, balance reads, address reads, funding-address lookup and status reconciliation SHALL use read-only identities and SHALL NOT enable SDK automatic settlement. Transfer signing SHALL occur only through an explicitly confirmed transfer path. The separate account-transfer-cancellation capability MAY add an explicitly confirmed, exact-operation cancellation proof only after its targeting and terminal-finality prerequisites pass; it SHALL NOT enable automatic cancellation, re-registration, replacement payments or signing during Check Status.

#### Scenario: Read funded account
- **WHEN** a player opens an account view or refreshes a balance containing confirmed boarding deposits
- **THEN** no registration, signature submission or background settlement occurs

### Requirement: Durable registration boundary
The application SHALL persist prepared before settlement preparation and submitting before the first registration network call. It SHALL record the operator intent ID when available. Under the mutation lock, an abandoned prepared record MAY become not-submitted and permit a fresh review. A submitting or registered record SHALL remain pending unless success is verified or authoritative evidence tied to that attempt proves terminal failure and that it cannot subsequently settle. SDK cancellation labels, elapsed time, missing history and unspent inputs SHALL NOT authorize resubmission. An unresolved outcome MAY require operator investigation and SHALL remain blocked without a force-clear control. This limitation SHALL be visible to the user.

#### Scenario: Interrupted before registration
- **WHEN** recovery acquires the mutation lock and finds a prepared record whose registration gate is no longer active
- **THEN** it records not-submitted and requires a fresh review before any new transfer

#### Scenario: Lost registration response
- **WHEN** registration may have reached the operator but its response was lost
- **THEN** the record survives reload, status checks do not sign or submit, and another transfer and account clearing remain blocked

#### Scenario: Late preparation after timeout
- **WHEN** an old SDK callback reaches registration after its attempt timed out
- **THEN** the closed attempt gate rejects the callback before any network mutation

#### Scenario: Authoritatively verified failure
- **WHEN** supported authoritative evidence proves the recorded attempt has failed and cannot subsequently settle
- **THEN** reconciliation records verified failure and releases transfer and account-clearing guards under the mutation lock
- **AND** another transfer requires a fresh review and explicit confirmation, without automatic retry

### Requirement: Evidence-based transfer status
Review Transfer SHALL only obtain a quote and SHALL NOT create a submitted operation. Transfer status SHALL distinguish known progress, awaiting confirmation, unavailable verification, verified success and verified failure using evidence for the recorded attempt. Errors SHALL preserve sanitized diagnostic categories without exposing secrets or falsely asserting submission. Status checks SHALL NOT sign, resubmit or clear uncertain records.

#### Scenario: Review without an existing attempt
- **WHEN** the player reviews an Arkade-to-Bitcoin amount and has no unresolved operation
- **THEN** a verified quote or actionable quote error appears without a pending submission warning or account-clearing lock

#### Scenario: Existing unresolved attempt
- **WHEN** the player opens transfer review with an unresolved recorded attempt
- **THEN** the UI identifies that existing attempt and its evidence-supported status and offers Check Status
- **AND** new submission remains blocked until its outcome is resolved

#### Scenario: Status service unavailable
- **WHEN** the operator or chain evidence cannot be retrieved
- **THEN** the UI reports verification unavailable while preserving the operation and its guards

### Requirement: Same-account reverse transfer
Arkade-to-Bitcoin SHALL select only spendable asset-free VTXOs and quote a same-account SDK-derived Bitcoin boarding destination with exact change and fee constraints. Automatic reboarding SHALL be disabled. Confirmation SHALL use the shared durable operation safeguards. Reverse completion SHALL require the recorded VTXOs settled by the confirmed commitment, exact Bitcoin receipt and exact Arkade change. The UI SHALL explain that Bitcoin funds remain in the account's boarding address and may be explicitly transferred back.

#### Scenario: Choose a reverse amount
- **WHEN** a player reviews an eligible Arkade-to-Bitcoin amount
- **THEN** the quote shows the amount, fee, resulting Bitcoin and Arkade balances, and the same-account destination purpose without transferring funds

#### Scenario: Keep Bitcoin after reverse transfer
- **WHEN** reverse transfer completes and the player refreshes or reopens the account
- **THEN** received Bitcoin stays on the Bitcoin side until explicit boarding confirmation

### Requirement: Transfer state in Account Activity
The Transactions field SHALL include the active account's durable transfer operation before it appears in SDK history. It SHALL show the requested sats, transfer direction, precise pending/registered/unverified status, and separately labeled operation, intent and known commitment identifiers. No transaction ID, timestamp or confirmation SHALL be invented. Pending transfer entries SHALL appear first. When matching commitment history exists, annotate its status instead of adding a duplicate row. Verified and not-submitted outcomes SHALL remain distinct from pending. Copy Transactions SHALL include the visible transfer status.

#### Scenario: Registered transfer absent from history
- **WHEN** a 1000-sat Arkade-to-Bitcoin operation is registered but its outcome is unverified
- **THEN** Transactions shows its amount, direction, registered/pending status and operation/intent IDs even if SDK history has no corresponding transaction

#### Scenario: Activity service fails
- **WHEN** SDK history is unavailable but a validated account-scoped local transfer record exists
- **THEN** the field may show that local operation while explicitly reporting history unavailable; stale SDK history is not retained

#### Scenario: Another account
- **WHEN** the active account differs from the stored operation profile
- **THEN** that operation is not displayed
