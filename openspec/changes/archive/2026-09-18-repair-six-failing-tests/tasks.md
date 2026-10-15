## 1. Reproduce and classify the failures

- [x] 1.1 Run the six affected test files independently and record the current assertion, fixture state, and relevant production contract for each failure; verify the baseline remains exactly six failures.
- [x] 1.2 Confirm the existing account-entry, account-contracts, account-restoration, limited-time-offers, and wallet-operation-availability requirements are the authority; verify no implementation change is made solely to satisfy an obsolete assertion.

## 2. Repair presentation and collection coverage

- [x] 2.1 Update `BIS/packages/integration-demo/tests/admin-assets.test.mjs` or the F2 implementation only as classification requires, preserving the arrow-only `↗` control and current Player Wallet readiness guard; verify `admin-assets.test.mjs` passes.
- [x] 2.2 Give the `AccountContracts` fixture in `BIS/packages/integration/tests/account-collection.test.mjs` the minimal valid context state required by the component, then verify Assets, Contracts, and Transactions retain identical collection geometry and the focused test passes.
- [x] 2.3 Reconcile the logged-out account labels with the existing account-entry requirement, changing production copy to `⚡ Create Account` and `⚡ Restore Account` if the requirement remains authoritative; verify `account-profiles-ui.test.mjs` and related account-entry tests pass.

## 3. Repair lifecycle test seams without weakening guards

- [x] 3.1 Make the boarding-recovery IndexedDB double model abort/error completion deterministically and preserve unresolved identity/journal assertions; verify the focused `boarding-recovery.test.mjs` passes.
- [x] 3.2 Repair the public LTO factory fixture or option propagation so default creation, claim, refund, and explicit `creationEnabled: false` rollback are each exercised through injected boundaries; verify `lto-public-factory.test.mjs` passes without external fetches.
- [x] 3.3 Align delayed restoration test timing and invalidation assertions with the production cancellation boundary; verify Back, disposal, replacement, and reset produce no stale save, activation, or account-connected event while the guarded saving case still succeeds.

## 4. Full verification

- [x] 4.1 Run all six focused test files together and verify zero failures.
- [x] 4.2 Run `npm test` and verify the complete BIS suite is green with no cancellations or skipped tests.
- [x] 4.3 Run `npm run typecheck` and `npm run build`; verify both complete successfully and inspect the final diff for scoped changes only.
