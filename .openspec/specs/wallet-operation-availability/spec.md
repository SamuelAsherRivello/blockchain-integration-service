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

### Requirement: Actionable recovery view
Account SHALL expose all its pending operations with amount, known status, last verification, reserved value and action availability. Check Status and Copy Recovery Details SHALL remain read-only and secret-free. Discard SHALL apply only to drafts proven never submitted under the mutation lock. Network cancellation SHALL obey account-transfer-cancellation requirements; unavailable cancellation SHALL explain its reason. No Undo or force-clear action SHALL falsely release submitted work. Log Out and Reset SHALL remain protected while any unresolved operation exists.

#### Scenario: Registered transfer cannot be cancelled safely
- **WHEN** cancellation finality is unverified
- **THEN** recovery shows Check Status and Copy Recovery Details, explains cancellation unavailability and shows independent spending availability separately

#### Scenario: Proven unsent draft
- **WHEN** the user discards a prepared draft whose registration gate is closed and which never reached submission
- **THEN** it is retained as not-submitted and its reservations are released without a network request

#### Scenario: Completed transaction
- **WHEN** completion is verified
- **THEN** the UI shows completed, offers no undo, and any reverse transfer requires a new review and confirmation

### Requirement: Evidence-based delivery report
Delivery SHALL report supported and unavailable actions separately, including SDK input-control limits, whole-input reservations, cancellation feasibility and outstanding live evidence. Independent spending/recovery delivery SHALL NOT depend on cancellation feasibility or claim that the original transfer was resolved.

#### Scenario: Cancellation remains blocked
- **WHEN** independent spending and recovery pass verification but cancellation guarantees remain unproven
- **THEN** those features are reported delivered with their evidence, cancellation remains explicitly undelivered, and the current account's actual eligible funds determine whether it can spend
