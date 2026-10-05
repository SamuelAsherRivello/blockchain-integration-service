# Proposal

## Why

`make-robust-assets` is complete and already hardens LTO readiness, transient operation state, legacy wallet-network comparisons, and G2 session behavior. A follow-up audit found a narrower remaining gap: contract recovery and reservation persistence still use Signet-named or network-unscoped browser state, so the implementation does not fully satisfy the existing requirement that contract records, reservations, and recovery remain isolated by active network.

## What Changes

- Make encrypted contract recovery storage explicitly network-scoped, including its IndexedDB namespace and reset/recovery boundary.
- Make durable contract reservations explicitly network-scoped in both their storage key and serialized record shape.
- Preserve unresolved records and reservations during migration; never reinterpret a Signet record as Mutinynet or vice versa.
- Scope contract-related browser mutation and coordination locks by active network so independent networks do not block one another unnecessarily.
- Update logout/reset and recovery inspection paths to read, validate, and clear the correct network-scoped contract state without erasing another network's unresolved work.
- Add focused Signet/Mutinynet regression coverage for recovery, reservations, concurrent coordination, migration, reset, and unresolved-contract preservation.
- Do not repeat the completed `make-robust-assets` work, and do not change equipment, continuation, or general non-contract client-state namespaces in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `limited-time-offers`: require contract recovery, reservations, and contract cleanup to remain isolated by account, network, operator, and game scope across reload and restart.
- `wallet-operation-availability`: ensure durable contract reservations and recovery state from another network cannot block, release, or be reused by the active network.

## Impact

- Affected code: `BIS/packages/integration/src/core/contract-storage.ts`, `contract-reservations.ts`, `lto-service.ts`, contract-related lock helpers, and the corresponding logout/reset/recovery integration points.
- Affected tests: contract storage, reservation, LTO service, wallet-operation availability, logout/reset, and network-selection regressions.
- APIs: no intended breaking public API changes; legacy persisted Signet state requires a safe compatibility/migration policy.
- Dependencies: none.
