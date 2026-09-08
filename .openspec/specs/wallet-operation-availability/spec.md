# wallet-operation-availability Specification

## Purpose

Allow independently funded wallet operations while preserving pending-operation recovery and explaining available actions accurately.

## Requirements

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
Max, quotes and submissions SHALL use fresh eligible unreserved inputs including fees, revalidated at confirmation. Mint input control SHALL be proven before independent minting is enabled. The UI SHALL distinguish insufficient independent funds, unavailable verification, unsupported input selection and input conflict. SDK balance alone SHALL NOT override reservations.

#### Scenario: Small request reserves large coin
- **WHEN** a pending 1,000-sat transfer consumes the account's sole 289,715-sat eligible input
- **THEN** no independent spendable funds are advertised and the UI explains that the whole input remains reserved

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
