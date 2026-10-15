## MODIFIED Requirements

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


### Requirement: Durable registration boundary
The application SHALL persist prepared before settlement preparation and submitting before the first registration network call. It SHALL record the operator intent ID when available. Under the mutation lock, an abandoned prepared record MAY become not-submitted and permit a fresh review. A submitting or registered record SHALL remain pending unless success is verified or authoritative evidence tied to that attempt proves terminal failure and that it cannot subsequently settle. SDK cancellation labels, elapsed time, missing history and unspent inputs SHALL NOT authorize resubmission. An unresolved outcome MAY require operator investigation and SHALL reserve its complete input set without a force-clear control. It SHALL NOT block independent balance transfers on verified unreserved inputs after the pending-transfer confirmation. Partial transfers SHALL select only enough inputs for the requested amount and valid change; Max SHALL select all eligible unreserved inputs. Multiple records SHALL retain their own identities and outcomes. This limitation SHALL be visible to the user.

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
