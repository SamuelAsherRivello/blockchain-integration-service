## MODIFIED Requirements

### Requirement: Verified live transfers
When supported, confirmation SHALL revalidate the reviewed inputs, account and fee and submit only the selected same-account transfer. Changed terms SHALL require review again. Pending or uncertain outcomes SHALL be reconciled before retry across navigation/restart, preventing duplicate submissions. Completion SHALL refresh real balances and Activity. Partial Bitcoin change and the reverse Bitcoin destination SHALL be verified before enabling these paths.

#### Scenario: Interrupted submission
- **WHEN** a submitted operation has an unknown outcome after interruption
- **THEN** it remains unresolved until reconciled and cannot be blindly resubmitted

#### Scenario: Admin withdrawal acceptance
- **WHEN** Arkade-to-Bitcoin is accepted as working
- **THEN** evidence SHALL include an explicitly confirmed real Signet transfer, its broadcast and confirmed transaction, the exact Bitcoin receipt, the corresponding Arkade balance change and retained assets
- **AND** navigation during execution and subsequent read-only recovery SHALL preserve the operation identity and outcome
- **AND** registration or isolated test success alone SHALL NOT satisfy acceptance

#### Scenario: Admin boarding acceptance
- **WHEN** Bitcoin-to-Arkade is accepted as working
- **THEN** evidence SHALL include a real confirmed deposit transferred into its exact owned Arkade receipt, verified Bitcoin change and refreshed balances
- **AND** each direction SHALL retain its own acceptance result rather than inheriting success from the other


### Requirement: Evidence-based transfer status
Review Transfer SHALL only obtain a quote and SHALL NOT create a submitted operation. Transfer status SHALL distinguish known progress, awaiting confirmation, unavailable verification, verified success and verified failure using evidence for the recorded attempt. Status SHALL distinguish active execution from interrupted processing requiring recovery; registered evidence alone SHALL NOT imply an active worker. Errors SHALL preserve sanitized diagnostic categories without exposing secrets or falsely asserting submission. Status checks SHALL NOT sign, resubmit or clear uncertain records.

#### Scenario: Review without an existing attempt
- **WHEN** the player reviews an Arkade-to-Bitcoin amount and has no unresolved operation
- **THEN** a verified quote or actionable quote error appears without a pending submission warning or account-clearing lock

#### Scenario: Existing unresolved attempt
- **WHEN** the player opens transfer review with an unresolved recorded attempt
- **THEN** the UI identifies that existing attempt and its evidence-supported status and offers Check Status
- **AND** submission reusing its reserved inputs remains blocked until its outcome is resolved; independent submissions remain available

#### Scenario: Status service unavailable
- **WHEN** the operator or chain evidence cannot be retrieved
- **THEN** the UI reports verification unavailable while preserving the operation and its guards



#### Scenario: Registered transfer returns promptly
- **WHEN** the operator acknowledges registration and its intent ID is durably saved
- **THEN** the acknowledgement SHALL read "Transfer pending. You can view progress in Transactions."
- **AND** settlement continues independently of ordinary navigation within the open app session; registered is not verified success and the acknowledgement SHALL NOT contain keep-tab-open or refresh instructions
- **AND** lost registration acknowledgement SHALL instead show an uncertain pending result without claiming successful submission

#### Scenario: Another balance transfer while any transfer is pending
- **WHEN** the player attempts a new balance transfer in either direction and any balance transfer is pending
- **THEN** before fresh review the UI SHALL ask "You already have a transfer of X sats pending. Are you sure you want to send another?" with "Yes" and "Cancel"
- **AND** X SHALL be the sum of the account's currently pending transfer amounts
- **AND** Cancel SHALL not quote or submit; Yes SHALL permit fresh review against eligible unreserved inputs
- **AND** every new attempt SHALL ask again, and any additional pending operation appearing by final confirmation SHALL require renewed acknowledgement and a fresh review
- **AND** each operation SHALL retain its own record, reservations and Transactions status without reusing another operation's inputs

#### Scenario: Processing stops after registration
- **WHEN** execution ends or its supported deadline is reached without verified completion
- **THEN** Transactions SHALL retain the unresolved financial outcome and last evidenced stage while indicating interrupted processing or recovery needed
- **AND** timeout alone SHALL NOT prove failure, release reservations or authorize replay

#### Scenario: Verification unavailable after signing
- **WHEN** signing has completed but operator or chain reads are unavailable
- **THEN** Transactions SHALL retain known signing and transaction evidence and report unavailable verification without claiming signing failed


## ADDED Requirements

### Requirement: Transfer execution survives session navigation
The application SHALL own explicitly confirmed transfer execution independently of its presentation. Opening Transactions, switching in-app views, closing account panels, selecting Admin preview stories, refreshing displayed data or changing browser-tab focus SHALL NOT intentionally cancel or recreate that transfer. Session-ending actions SHALL remain distinct and SHALL NOT silently discard active signing work. This contract does not guarantee uninterrupted execution when the browser suspends or terminates the document.

#### Scenario: Leave transfer presentation during signing
- **WHEN** the player dismisses the acknowledgement and navigates elsewhere within the open app session
- **THEN** the same transfer SHALL continue without duplicate registration and its progress SHALL remain inspectable on return

#### Scenario: Refresh displayed data
- **WHEN** the player refreshes Balance or Transactions during execution
- **THEN** only presentation reads SHALL refresh and the transfer SHALL continue unaffected

#### Scenario: Background tab and late events
- **WHEN** the player changes browser-tab focus while the browser continues executing the app
- **THEN** there SHALL be no visibility-triggered cancellation or new registration and late events SHALL update only their owning operation

### Requirement: Safe stage-specific transfer recovery
The application SHALL retain operation-scoped public evidence for registration, batch participation, signing, known transactions and completion when observed. Local observation time SHALL be distinct from a chain timestamp. Missing legacy evidence SHALL remain unknown. Status checks SHALL remain read-only. Any signing continuation SHALL use a proven exact-operation SDK path within the original authorization; recovery after lost session state SHALL require explicit recovery authorization and separately proven safe continuation. Recovery SHALL NOT guess signing state, reuse unsafe nonces, recreate an ambiguous payment or use a local cancellation label as terminal proof.

#### Scenario: Legacy registered record
- **WHEN** a prior record has an intent ID but lacks stage and live-worker evidence
- **THEN** the application SHALL retain its identity and reservations, report the missing evidence honestly and look for authoritative receipts without replay

#### Scenario: Supported in-session continuation
- **WHEN** a recoverable interruption occurs and exact-operation continuation is proven for the retained session state
- **THEN** continuation SHALL preserve the original intent and input reservations and record new progress without creating another payment

#### Scenario: Safe continuation is unavailable
- **WHEN** neither safe continuation nor terminal finality can be proven
- **THEN** the operation SHALL remain unresolved with recovery information and reserved inputs
- **AND** independent unreserved balance transfers SHALL remain available with the existing per-attempt Yes/Cancel acknowledgement

#### Scenario: Known transaction can be inspected
- **WHEN** a validated explorer-compatible transaction ID is available
- **THEN** Transactions SHALL offer the matching Signet explorer while distinguishing any unconfirmed status
- **AND** operation and intent IDs alone SHALL NOT be treated as Bitcoin transaction IDs
