## Why

The BIS release verification suite currently reports six failures while 616 tests pass. The failures are concentrated in stale presentation assertions, an under-specified collection test fixture, and lifecycle test seams that no longer model the current cancellation, wallet-role, and LTO behavior. The change will restore a trustworthy all-green regression suite without changing the documented product contract.

## What Changes

- Update the Admin F2 arrow-only assertion to include the current Player Wallet readiness guard while preserving the arrow-only affordance.
- Repair the Assets/Contracts/Transactions collection fixture so `AccountContracts` receives the same complete context contract used by the production collection components.
- Align logged-out account-entry assertions with the current approved `⚡ Create` and `⚡ Restore` labels, or adjust the production labels only if the existing account-entry requirement proves authoritative for the intended wording.
- Stabilize the boarding-recovery storage-abort fixture so intentional IndexedDB-style aborts are represented as the expected durable-storage failure and do not leak an unhandled test rejection.
- Reconcile the public LTO factory test with the current default creation/readiness policy, preserving explicit rollback/recovery coverage and avoiding external network calls.
- Make delayed restoration cancellation assertions observe the documented invalidation boundary for Back, disposal, replacement, and reset, without permitting stale saves or account events.
- Run focused tests, the complete BIS suite, typecheck, and build; require all tests to pass before considering the change complete.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a conformance and test-fixture repair for behavior already covered by the existing account-entry, account-restoration, account-contracts, limited-time-offers, and wallet-operation-availability requirements.

## Impact

- Test files under `BIS/packages/integration/tests/` and `BIS/packages/integration-demo/tests/`.
- Only the corresponding production components under `BIS/packages/integration/src/` or `BIS/packages/integration-demo/src/` if investigation proves an implementation regression rather than a stale test expectation.
- No public API, wallet protocol, dependency, schema, or release-artifact change is intended.
- No recovery phrases, wallet keys, or other secrets are used or added.
