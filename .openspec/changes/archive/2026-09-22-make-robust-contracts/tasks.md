# Tasks

## 1. Regression coverage and migration contract

- [x] 1.1 Add Signet and Mutinynet contract-storage tests proving each network has an independent encrypted recovery namespace, revision stream, load, save, and reset boundary.
- [x] 1.2 Add reservation tests proving new records include network/operator scope, cross-network reservations remain isolated, and legacy Signet reservations remain conservatively readable without becoming Mutinynet reservations.
- [x] 1.3 Add migration/reload tests for unresolved contract recovery and reservations, verifying a crash or restart does not discard, duplicate, or reassign recovery to another network.
- [x] 1.4 Add logout and Admin Reset tests proving active-network cleanup cannot erase unresolved contract recovery or reservations belonging to another network.

## 2. Network-scoped contract persistence

- [x] 2.1 Add a network-scoped contract storage boundary and verify the selected network determines its encrypted database namespace and backend lifecycle.
- [x] 2.2 Preserve explicit record validation for network and operator, normalize only approved legacy metadata, and verify mismatched records fail before signing or submission.
- [x] 2.3 Version contract reservation persistence with network/operator fields and a safe Signet compatibility path; verify incomplete or corrupt legacy state remains a spending hold.
- [x] 2.4 Bind LTO funding, claim, refund, reconciliation, contract queries, and reservation publication to the active network-scoped storage and verify existing Game Wallet network behavior remains unchanged.

## 3. Coordination and cleanup boundaries

- [x] 3.1 Qualify contract-specific mutation/recovery coordination names with network and verify same-network tabs serialize while independent networks do not block each other.
- [x] 3.2 Update contract logout/reset/recovery inspection to enumerate only the applicable network scope and verify separate game-owned unresolved refund recovery remains protected.
- [x] 3.3 Verify stale network changes cannot clear, publish, or reconcile another network's contract document, reservation set, or cleanup marker.

## 4. Validation and scope control

- [x] 4.1 Run focused contract storage, reservation, LTO, wallet-operation availability, logout/reset, and network-selection tests and record unrelated failures separately.
- [x] 4.2 Run `npm.cmd run typecheck` and `npm.cmd run build` and verify all workspaces compile with the migration boundary.
- [x] 4.3 Run `openspec validate make-robust-contracts --strict` and verify every delta requirement has complete scenarios.
- [x] 4.4 Inspect `git diff -- .openspec/changes/make-robust-contracts BIS/packages/integration BIS/packages/integration-demo` and verify implementation remains limited to contract-state isolation, with completed `make-robust-assets` work and unrelated dirty changes preserved.
