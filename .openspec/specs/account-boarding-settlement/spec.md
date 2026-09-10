# account-boarding-settlement Specification

## Purpose
Let a player review movement between the Bitcoin and Arkade parts of their Signet account without confusing balance totals with spending eligibility.

## Requirements

Explicit player logout follows account-logout: backup acknowledgement and, when pending operations exist, separate pending-loss acknowledgement permit local player journal cleanup without cancelling submitted transactions. This exception does not relax Admin Reset guards or authorize spending reserved inputs.

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

#### Scenario: Admin withdrawal acceptance
- **WHEN** Arkade-to-Bitcoin is accepted as working
- **THEN** evidence SHALL include an explicitly confirmed real Signet transfer, its broadcast and confirmed transaction, the exact Bitcoin receipt, the corresponding Arkade balance change and retained assets
- **AND** navigation during execution and subsequent read-only recovery SHALL preserve the operation identity and outcome
- **AND** registration or isolated test success alone SHALL NOT satisfy acceptance

#### Scenario: Admin boarding acceptance
- **WHEN** Bitcoin-to-Arkade is accepted as working
- **THEN** evidence SHALL include a real confirmed deposit transferred into its exact owned Arkade receipt, verified Bitcoin change and refreshed balances
- **AND** each direction SHALL retain its own acceptance result rather than inheriting success from the other

### Requirement: Read-only account inspection
Account restoration, balance reads, address reads, funding-address lookup and status reconciliation SHALL use read-only identities and SHALL NOT enable SDK automatic settlement. Manual transfer signing SHALL occur only through an explicitly confirmed transfer path. The account-automatic-onboarding coordinator is the sole additional automatic signing path: it starts from account activation and follows its fixed plan, durable boundaries and safe continuation rules. Inspection methods themselves SHALL remain read-only and SHALL NOT enable generic SDK automatic settlement. The separate account-transfer-cancellation capability MAY add an explicitly confirmed, exact-operation cancellation proof only after its targeting and terminal-finality prerequisites pass; it SHALL NOT enable automatic cancellation, re-registration, replacement payments or signing during Check Status.

#### Scenario: Read funded account
- **WHEN** a player opens an account view or refreshes a balance containing confirmed boarding deposits
- **THEN** the view or refresh initiates no registration, signature submission or settlement; independently authorized automatic onboarding can continue under account-automatic-onboarding

### Requirement: Durable registration boundary
The application SHALL persist prepared before settlement preparation and submitting before the first registration network call. It SHALL record the operator intent ID when available. Under the mutation lock, an abandoned prepared record MAY become not-submitted and permit a fresh review. A submitting or registered record SHALL remain pending unless success is verified or authoritative evidence tied to that attempt proves terminal failure and that it cannot subsequently settle. SDK cancellation labels, elapsed time, missing history and unspent inputs SHALL NOT authorize resubmission. An unresolved outcome MAY require operator investigation and SHALL reserve its complete input set without a force-clear control. It SHALL NOT block independent operations on verified unreserved inputs. New balance transfers SHALL still require the pending-transfer confirmation. Partial transfers SHALL select only enough inputs for the requested amount and valid change; Max SHALL select all eligible unreserved inputs. Multiple records SHALL retain their own identities and outcomes. This limitation SHALL be visible to the user.

#### Scenario: Interrupted before registration
- **WHEN** recovery acquires the mutation lock and finds a prepared record whose registration gate is no longer active
- **THEN** it records not-submitted and requires a fresh review before any new transfer

#### Scenario: Lost registration response
- **WHEN** registration may have reached the operator but its response was lost
- **THEN** the record survives reload, status checks do not sign or submit, and conflicting inputs and account clearing remain blocked; independent transfers using verified unreserved inputs remain available

#### Scenario: Late preparation after timeout
- **WHEN** an old SDK callback reaches registration after its attempt timed out
- **THEN** the closed attempt gate rejects the callback before any network mutation

#### Scenario: Authoritatively verified failure
- **WHEN** supported authoritative evidence proves the recorded attempt has failed and cannot subsequently settle
- **THEN** reconciliation records verified failure and releases only that operation's reservations under the mutation lock; account-clearing guards release only when no unresolved operation remains
- **AND** another transfer requires a fresh review and explicit confirmation, without automatic retry

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

### Requirement: Same-account reverse transfer
Arkade-to-Bitcoin SHALL select SDK-spendable VTXOs, including asset-bearing outputs, while excluding recoverable and unrolled funds. It SHALL quote a same-account SDK-derived Bitcoin boarding destination with exact change and fee constraints. When inputs carry assets, Max SHALL reserve at least the operator and wallet minimum for owned Arkade change, and the SDK settlement SHALL retain every asset ID and exact quantity in that change. Quotes SHALL bind the input asset inventory; registration SHALL reject an intent with altered asset allocation. The durable operation SHALL record the asset-change script, sats and quantities. Automatic reboarding SHALL be disabled. Confirmation SHALL use the shared durable operation safeguards. Reverse completion SHALL require the recorded VTXOs settled by the confirmed commitment, exact Bitcoin receipt and exact owned Arkade change including its assets. The UI SHALL explain that Bitcoin funds remain in the account's boarding address and may be explicitly transferred back.

#### Scenario: Sats and assets share a spendable output
- **WHEN** the player chooses Max with 280715 eligible sats carrying assets and a 330-sat minimum Arkade change requirement under the supported zero-fee schedule
- **THEN** the quote withdraws 280385 sats to Bitcoin and retains 330 sats with every asset in owned Arkade change
- **AND** an explicit amount that would consume the required asset change is rejected before registration

#### Scenario: Asset inventory or receipt changes
- **WHEN** an input asset quantity changes after review, or confirmed recovery evidence omits or changes an expected asset
- **THEN** confirmation rejects the stale quote, or recovery retains the pending outcome respectively, without resubmitting

#### Scenario: Choose a reverse amount
- **WHEN** a player reviews an eligible Arkade-to-Bitcoin amount
- **THEN** the quote shows the amount, fee, resulting Bitcoin and Arkade balances, and the same-account destination purpose without transferring funds

#### Scenario: Keep Bitcoin after reverse transfer
- **WHEN** reverse transfer completes and the player refreshes or reopens the account
- **THEN** received Bitcoin stays on the Bitcoin side until explicit boarding confirmation

#### Scenario: Requested amount consumes asset reserve
- **WHEN** an otherwise eligible withdrawal would leave too few sats to retain the account's assets
- **THEN** the review SHALL explain the minimum Arkade reserve and direct the player to Max without submitting an operation

#### Scenario: Asset-free full withdrawal
- **WHEN** all selected spendable outputs are asset-free and the full amount satisfies current operator limits
- **THEN** Max SHALL allow the entire eligible amount without reserving sats for assets

#### Scenario: Recover a pre-fix operation
- **WHEN** an existing operation record lacks the new full-input amount and asset-change metadata
- **THEN** recovery SHALL retain its original amount interpretation and pending-state safeguards without clearing or replaying it

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

### Requirement: Attributable settlement failures
Each submitted withdrawal SHALL distinguish observed batch participation, signing progress, commitment availability and verified receipt. An interrupted operation SHALL retain its exact identity and the last safely observable attempted and acknowledged stage, plus a sanitized failure category when available. Missing legacy evidence SHALL be reported as unknown rather than reconstructed as fact. Progress observations SHALL NOT authorize success, replay or input release.

#### Scenario: Failure after participation confirmation
- **WHEN** participation is acknowledged but tree validation, signing initialization, provider submission or event delivery fails
- **THEN** the operation reports interruption and its observed failure boundary without claiming broadcast or completion
- **AND** no replacement withdrawal is automatically submitted

#### Scenario: Private failure payload
- **WHEN** an underlying failure contains a signed proof, nonce, recovery phrase or arbitrary provider payload
- **THEN** persisted and displayed diagnostics contain only allowed public fields and static failure labels

### Requirement: Withdrawal completion acceptance after payments and minting
Withdrawal repair SHALL require an actual confirmed Bitcoin receipt and exact owned asset change, not registration, a completed UI flow or a simulated settlement result. The original operation SHALL remain attributable across navigation and read-only reconciliation. A local post-broadcast failure SHALL NOT prevent later recognition of valid completion or authorize replay.

#### Scenario: Full player sequence
- **WHEN** a player logs in, logs out, restores a funded account, pays 1,000 sats to continue, mints to the player, pays 1,000 sats again, and explicitly confirms a 1,000-sat Arkade-to-Bitcoin withdrawal
- **THEN** successful withdrawal acceptance requires the matching confirmed Bitcoin receipt, exact Arkade change and preserved asset IDs and quantities
- **AND** the same account can pay 1,000 sats afterward from sufficient fresh eligible funds without logout

#### Scenario: Pending same-input payment
- **WHEN** the player attempts B1 before the sole input's withdrawal has resolved
- **THEN** that payment cannot reuse the reserved input or claim success
- **AND** its result explains the reservation rather than describing the positive total balance as zero

#### Scenario: Broadcast followed by local failure
- **WHEN** settlement has broadcast but local processing fails before the application records success
- **THEN** later verified receipt reconciliation resolves the original withdrawal without another submission

#### Scenario: Infrastructure checks only
- **WHEN** diagnostics, builds and isolated tests pass but no matching live confirmed receipt is available
- **THEN** withdrawal completion acceptance remains outstanding

### Requirement: Composed withdrawal status and confirmation
Arkade-to-Bitcoin transfers requiring preparation SHALL follow withdrawal-input-preparation within the existing transfer flow. Preparation SHALL have an independently recorded transaction identifier and outcome linked to the original transfer. Preparation completion SHALL NOT be represented as Bitcoin withdrawal success. A fresh confirmation after restart SHALL authorize only an outstanding unsubmitted leg and SHALL NOT replay a registered withdrawal. Existing direct asset-bearing withdrawals SHALL retain asset-change output validation.

#### Scenario: Navigation during withdrawal preparation
- **WHEN** a player navigates away after confirming preparation and withdrawal
- **THEN** the same authorized worker and operation retain ownership, and returning shows the actual stage without starting either leg again

#### Scenario: Bitcoin completion after B1 spent prepared change
- **WHEN** B1 consumes the independently prepared asset-bearing change before the Bitcoin withdrawal confirms
- **THEN** withdrawal reconciliation verifies its dedicated input and exact Bitcoin receipt without requiring that already-spent preparation change remain an unspent withdrawal output
- **AND** asset preservation is verified through the preparation and subsequent payment evidence

### Requirement: Existing interrupted account recovery remains a delivery gate
This change SHALL preserve all previously registered transfer identities and reservations. Preparation SHALL NOT spend an input reserved by an older unresolved intent. The issue SHALL NOT be declared fully resolved until the reported existing operation has verified completion or supported authoritative terminal cancellation/failure, its affected reservation is durably released, and B1 succeeds on the same restored account without clearing history or adding funds to mask the hold. Unsupported operator recovery SHALL remain an explicit undelivered dependency, distinct from successful preparation of new withdrawals.

#### Scenario: Reported existing operation remains unresolved
- **WHEN** operation 4428bcbe-72db-43e9-a59d-f39150837dae has only a recorded validation error and an unspent input, without sufficient terminal evidence
- **THEN** it remains unresolved and protected; tests passing on new withdrawals do not count as recovery of that operation

#### Scenario: Existing operation verified resolved
- **WHEN** supported evidence verifies the old transfer's completion or terminal cancellation/failure
- **THEN** its original record gains the verified outcome, only its reservations are released, and shared account state refreshes before a separately requested B1 payment
- **AND** receipt evidence for that B1 payment is required to close the existing-account acceptance gate

### Requirement: Automatic onboarding is a separate execution contract
The manual review, fresh-confirmation, pending-transfer acknowledgement and explicit recovery-authorization requirements of this capability SHALL continue to govern manual transfers. Automatic onboarding SHALL instead follow account-automatic-onboarding for its fixed two-leg authorization, safe continuation of provably unsubmitted work and spendability-based parent completion. Its automatic return leg SHALL verify exact owned final receipts without requiring Bitcoin block confirmation to complete the parent; manual reverse-transfer completion SHALL retain its confirmed-receipt requirement. These exceptions SHALL NOT permit ambiguous replay, automatic cancellation, spending another operation's reserved inputs, automatic reboarding of returned Bitcoin, or reinterpretation of legacy manual records.

#### Scenario: Automatic return after restart
- **WHEN** a resumed automatic onboarding parent has a verified boarding receipt and a return leg proven never submitted
- **THEN** it continues that fixed return without manual Review or Confirm Transfer and without replaying the first leg

#### Scenario: Manual transfer after restart
- **WHEN** an interrupted operation belongs to the manual transfer journey
- **THEN** its existing explicit review and recovery rules remain in force and onboarding does not adopt or automatically retry it
