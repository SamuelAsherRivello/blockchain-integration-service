## 1. Reproduce and characterize the failure

- [ ] 1.1 Add a focused burn regression fixture that reproduces each pre-submit `Burn unavailable` source (shared-lock contention, active-account read failure, fresh asset/provider failure, durable burn-record failure, unsupported coordination, and network mismatch), and verify each case fails for the intended reason before implementation.
- [ ] 1.2 Trace and document the burn submission boundary and provider calls with sanitized test diagnostics only; verify no recovery phrase, private key, provider secret, or raw sensitive error is emitted.

## 2. Fix guarded burn execution

- [ ] 2.1 Thread the active verified account/network through the burn provider and wallet construction; verify selected-network tests reject mismatched operator information before any submission.
- [ ] 2.2 Implement bounded pre-submit mutation-lock coordination for Burn, rechecking account generation, pending reservations, and fresh holdings on every retry; verify a short-lived competing operation allows the burn to execute exactly once and persistent contention returns a specific safe result.
- [ ] 2.3 Preserve and harden the durable burn journal boundary around exact selected inputs, automatic settlement disablement, other-asset change, timeout, abort, and provider acknowledgement; verify no pre-submit failure records a false success and no post-submit uncertainty is retried.
- [ ] 2.4 Refine the context and public result mapping so typed unavailable, busy, account-changed, invalid-input, outcome-unknown, unsupported-environment, and unexpected SDK failures remain safe and actionable; verify private provider details are sanitized.

## 3. Regression coverage and UI integration

- [ ] 3.1 Extend integration burn tests for lock races, network routing, transient provider/indexer failure, durable-write failure, exact holding revalidation, input reservations, duplicate operation IDs, and late acknowledgements; verify the focused suite passes after the fix.
- [ ] 3.2 Extend Account Assets browser-host coverage for confirmation, one submission, temporary busy/retry feedback, successful refresh, pre-submit failure acknowledgement, and unknown-outcome protection; verify no duplicate burn occurs.
- [ ] 3.3 Extend Admin H2 marketplace burn-batch coverage so one temporary or unknown item result does not cause unsafe resubmission and other eligible disjoint items still execute; verify deterministic operation IDs and honest partial results.

## 4. Verification and handoff

- [ ] 4.1 Run the focused integration/demo burn tests, typecheck, and production builds; verify `git diff --check` and OpenSpec strict validation pass.
- [ ] 4.2 Run a real browser burn against a deliberately selected owned Signet asset only when a user-provided test wallet and asset are available; record public transaction evidence and fresh post-burn ownership without recording recovery material, and leave live verification unchecked if unavailable.
- [ ] 4.3 Review the final error copy and recovery behavior in the Account Assets and Admin flows; verify a valid burn executes, a genuinely unavailable burn explains why, and no uncertain operation is silently retried.
