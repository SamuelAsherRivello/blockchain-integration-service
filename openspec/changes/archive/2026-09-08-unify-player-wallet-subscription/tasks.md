## 1. Shared observation

- [x] 1.1 Add regression coverage for outgoing/asset changes, one source across navigation, failure/reconnect and account cleanup; run tests to demonstrate missing behavior.
- [x] 1.2 Implement shared observer fan-out and fresh-read requests; verify lifecycle and Activity tests pass.

## 2. Wallet view synchronization

- [x] 2.1 Decouple view invalidation from toasts and route confirmed local operations through it; verify B1 and wallet view tests including superseded reads.
- [x] 2.2 Preserve manual refresh, bounded Activity loading, and notification deduplication; verify existing observer, activity and continuation suites.

## 3. Integration verification

- [x] 3.1 Run TypeScript, build and relevant automated suites; record results and limitations.
- [x] 3.2 Verify automatic wallet updates and single observation through a browser fixture without submitting real payments; record observable results.

## 4. Single visible payment refresh

- [x] 4.1 Reproduce delayed post-payment observation causing a second loading cycle with a failing regression test.
- [x] 4.2 Implement background Balance reconciliation preserving manual loading, cancellation and unavailable states; verify regression and core tests.
- [x] 4.3 Verify one visible cycle in the browser fixture, run build, and record results.
