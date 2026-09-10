# wallet-operation-availability Specification

## Purpose

Allow independently funded wallet operations while preserving pending-operation recovery and explaining available actions accurately.

## Requirements

Explicit player logout follows account-logout: backup acknowledgement and, when pending operations exist, separate pending-loss acknowledgement permit local player journal cleanup without cancelling submitted transactions. This exception does not relax Admin Reset guards or authorize spending reserved inputs.

### Requirement: Durable input reservations
The system SHALL maintain multiple account/network/operator-scoped operations, reserving every input of unresolved operations before network submission. It SHALL preserve legacy records during migration and prevent conflicting submissions across cooperating same-origin contexts. Incomplete or corrupt unresolved input records SHALL block spending with an explicit reason. Completion SHALL release only the corresponding operation's reservations.

#### Scenario: Disjoint operations
- **WHEN** one transfer is pending and verified eligible inputs exist outside all reservations
- **THEN** a new explicitly confirmed operation can use only those inputs without replacing the old record

#### Scenario: Competing confirmations
- **WHEN** two contexts confirm operations selecting the same input
- **THEN** only one reserves and submits it; the other requires fresh review

#### Scenario: Migration cannot establish inputs
- **WHEN** a legacy unresolved operation has unknown inputs or migration cannot persist
- **THEN** no new spending occurs and the original recovery record remains intact

#### Scenario: Reconstruct legacy reservations
- **WHEN** a pending operation lacks a complete input set
- **THEN** the system attempts read-only reconstruction from supported evidence and persists verified reservations before enabling independent spending
- **AND** while uncertainty remains it explains the specific spending hold and keeps receiving, inspection and recovery available without signing or resubmitting

### Requirement: Consistent operation availability
Max, quotes and submissions SHALL use fresh eligible unreserved inputs including fees, revalidated at confirmation. New partial Arkade-to-Bitcoin withdrawals SHALL prepare independent change under withdrawal-input-preparation when the selected funds exceed the required withdrawal funding, rather than reserve the excess through settlement. Mint input control SHALL be proven before independent minting is enabled. The UI SHALL distinguish insufficient independent funds, unavailable verification, unsupported input selection and input conflict. SDK balance alone SHALL NOT override reservations. Verified preparation SHALL transition reservations atomically between its completed input spend and the dedicated withdrawal output; surplus change SHALL NOT remain reserved by the parent transfer.

#### Scenario: Small request reserves large coin
- **WHEN** an existing unresolved 1000-sat transfer predates preparation and consumes the account's sole 289715-sat eligible input
- **THEN** no independent spendable funds are advertised and the UI explains that the whole input remains reserved pending verified recovery

#### Scenario: New small withdrawal preserves change
- **WHEN** a newly confirmed 1000-sat withdrawal starts from the sole 263715-sat eligible input at verified zero fees
- **THEN** withdrawal registration follows verified preparation and only 1000 sats remain reserved for that withdrawal; the 262715-sat change is independently spendable

#### Scenario: Independent funding arrives
- **WHEN** a fresh read verifies a newly received independent spendable coin
- **THEN** eligible operations become available without clearing the existing pending transfer

#### Scenario: Mint adapter cannot constrain inputs
- **WHEN** supported SDK issuance cannot exclude reserved inputs
- **THEN** independent minting remains unavailable with that reason while supported disjoint transfers and sends remain available

### Requirement: Shared B1 payment availability
BIS SHALL apply the shared input reservation policy to B1 payments as well as sends, transfers and supported minting. B1 SHALL be greyed out when verified unreserved funds cannot cover the payment and applicable fees, or payment readiness cannot be verified. It SHALL expose an accessible specific reason and known available/reserved amounts. Opening Account alone SHALL NOT disable B1. Fund and reservation changes SHALL refresh availability without automatically submitting a queued payment. Duplicate submission protection SHALL remain enforced.

#### Scenario: Pending transfer with independent B1 funds
- **WHEN** the player is logged in, the game wallet recipient is available, and verified unreserved inputs cover B1 while an unrelated transfer remains pending
- **THEN** B1 remains enabled even with Account open and its explicit click uses only independent inputs

#### Scenario: Insufficient independent B1 funds
- **WHEN** verified unreserved funds cannot cover B1
- **THEN** B1 is greyed out with the specific reason and known available/reserved amounts
- **AND** when sufficient eligible funds become available it re-enables and requires a new explicit click

#### Scenario: Independent minting unsupported
- **WHEN** minting cannot enforce exclusion of reserved inputs but B1 and sends can
- **THEN** minting is greyed out with its specific reason and supported independently funded operations remain enabled

### Requirement: Actionable recovery view
Account SHALL expose all its pending operations with amount, known status, last verification, reserved value and action availability. Transaction Detail SHALL offer recovery inspection through View Recovery Info only, with copying inside its Recovery Info dialog. Check Status, Copy Recovery Details and discard controls SHALL NOT appear in Transaction Detail or that window. Existing recovery checks elsewhere SHALL remain read-only and secret-free. Discard SHALL apply only to drafts proven never submitted under the mutation lock. Network cancellation SHALL obey account-transfer-cancellation requirements; unavailable cancellation SHALL explain its reason. No Undo or force-clear action SHALL falsely release submitted work. Log Out and Reset SHALL remain protected while any unresolved operation exists.

#### Scenario: Registered transfer cannot be cancelled safely
- **WHEN** cancellation finality is unverified
- **THEN** Transaction Detail offers View Recovery Info, whose read-only report explains cancellation unavailability and shows independent spending availability separately, without execution actions

#### Scenario: Proven unsent draft
- **WHEN** the user discards a prepared draft whose registration gate is closed and which never reached submission
- **THEN** it is retained as not-submitted and its reservations are released without a network request

#### Scenario: Completed transaction
- **WHEN** completion is verified
- **THEN** the UI shows completed, offers no undo, and any reverse transfer requires a new review and confirmation

### Requirement: Evidence-based delivery report
Delivery SHALL report supported and unavailable actions separately, including SDK input-control limits, whole-input reservations, cancellation feasibility and outstanding live evidence. Independent spending/recovery delivery SHALL NOT depend on cancellation feasibility or claim that the original transfer was resolved.

#### Scenario: Required live B1 acceptance
- **WHEN** this change is reported complete
- **THEN** evidence includes live Signet B1 success while an unrelated transfer remains pending, verified receipt of 1,000 sats at the configured game wallet, and preservation of the original transfer recovery record and reservations
- **AND** automated tests verify conflicting-input and duplicate-submission protection; isolated browser success alone does not satisfy live acceptance

#### Scenario: Cancellation remains blocked
- **WHEN** independent spending and recovery pass verification but cancellation guarantees remain unproven
- **THEN** those features are reported delivered with their evidence, cancellation remains explicitly undelivered, and the current account's actual eligible funds determine whether it can spend

### Requirement: Resolution refreshes spendability without logout
Verified completion or terminal cancellation SHALL durably release only the resolved operation's reservation and refresh the owning account's balances, assets, Activity and payment availability. Unresolved operations SHALL retain reservations across ordinary navigation and restart. Explicit logout after wallet-backup acknowledgement and, when the pending count exceeds zero, pending-loss acknowledgement SHALL clear player transaction and recovery records, including continuation and reservation journals, without requiring pending operations to resolve. Separate Admin game-wallet records SHALL remain intact. Administrative reset retains its existing guards. A total balance exceeding a requested payment SHALL NOT imply that reserved inputs are spendable.

#### Scenario: Payment after verified resolution
- **WHEN** a withdrawal or its cancellation is durably verified and the original account has enough fresh eligible sats
- **THEN** B1 can pay without logout or manually clearing browser state
- **AND** unrelated operation reservations remain protected

#### Scenario: Positive balance entirely reserved
- **WHEN** a pending withdrawal reserves all currently eligible inputs and B1 cannot fund 1,000 sats
- **THEN** B1 explains the pending reservation and points to that operation's status
- **AND** the app does not replace total balance with zero or submit a conflicting payment

#### Scenario: Explicit logout clears local records without cancelling transactions
- **WHEN** a player acknowledges their backup and requests logout while a withdrawal remains unresolved
- **THEN** logout succeeds after the backup and pending-loss checkboxes and removes player operation journals and reservations; submitted transactions are not cancelled

#### Scenario: Refresh unavailable
- **WHEN** terminal resolution is durable but the fresh balance service is unavailable
- **THEN** the verified outcome remains recorded and balances are reported unavailable rather than fabricated or reset to zero

#### Scenario: Terminal persistence fails
- **WHEN** terminal evidence cannot be saved durably
- **THEN** input reservations remain protected and the app does not advertise them as released

### Requirement: Preparation-aware reservation continuity
All wallet mutation paths SHALL honor preparation input reservations and the dedicated withdrawal output reservation. Releasing completed preparation inputs SHALL require durable, verified output handoff. Available change SHALL refresh the shared balance, assets, Activity and B1 views for the owning account, without creating a payment or changing an unrelated account.

#### Scenario: Payment races preparation completion
- **WHEN** B1 and preparation completion run in separate cooperating contexts
- **THEN** B1 can select verified change only after the durable handoff and cannot select either the unresolved source input or the dedicated withdrawal output

#### Scenario: Handoff persistence fails
- **WHEN** the verified preparation result cannot be durably saved
- **THEN** the system retains a spending hold and does not advertise change as independently available until reconciliation safely completes the handoff

### Requirement: Onboarding reservation handoff and final spendability
Every wallet mutation path SHALL honor automatic onboarding's frozen input and intermediate-receipt reservations across tabs and ordinary restart. Verified receipt handoff SHALL durably transition the parent's holds before another operation can select its outputs. Final target outputs SHALL become available as soon as account-automatic-onboarding verifies them spendable and persists their release; unconfirmed Bitcoin commitments SHALL NOT impose an additional hold on those outputs or globally disable independently funded payments. Existing unrelated reservations and asset preservation SHALL remain enforced. A failed persistence or unknown input set SHALL retain the affected spending protection with a specific reason.

#### Scenario: Payment during intermediate boarding
- **WHEN** the first-leg receipt is SDK-spendable but reserved for the Bitcoin-return leg
- **THEN** a payment cannot select it, while independent verified unreserved inputs remain usable

#### Scenario: Payment before Bitcoin confirmation
- **WHEN** the final target handoff is durable and its fresh eligible funds cover a normal payment while the Bitcoin return is unconfirmed
- **THEN** the payment can use those final outputs without waiting for that confirmation or logging out

#### Scenario: Handoff write fails
- **WHEN** final receipt evidence cannot be durably saved
- **THEN** the target is not advertised as released and automatic read-only recovery keeps checking the original operation

#### Scenario: Another tab races return registration
- **WHEN** two cooperating contexts attempt to submit the same onboarding return leg
- **THEN** only one can own its reserved inputs and cross the registration boundary

#### Scenario: Intermediate receipt appears before its journal update
- **WHEN** a first-leg output becomes visible to a payment before onboarding persists its exact receipt outpoint
- **THEN** the payment cannot select that output until ancestry classification and durable handoff establish its availability
- **AND** inputs proven independent remain usable; an older quote must revalidate this protection at submission

#### Scenario: Final release is replayed after a crash
- **WHEN** final receipt verification is delivered twice or the app restarts between durable completion and presentation refresh
- **THEN** completion and reservation release resolve from the same durable revision, without a duplicate settlement, premature release or residual onboarding hold on the final target
