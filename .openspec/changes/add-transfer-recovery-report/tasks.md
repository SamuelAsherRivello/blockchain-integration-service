## 1. Report and UI

- [x] 1.1 Add failing formatter tests for pending/unknown/terminal status and exclusion of secrets or malformed values; run and record the failure before implementation.
- [x] 1.2 Implement the pure allowlisted report formatter; pass the same focused tests.
- [x] 1.3 Add a failing isolated browser fixture for recovery details and copy/status behavior; verify it fails before UI implementation.
- [x] 1.4 Implement expandable report, explicit copy/fallback and stale-result handling; pass the browser fixture with unchanged transfer journal and no mutation calls.

## 2. Split and verify

- [x] 2.1 Reconcile D5a/D5b stories and both proposals, keeping cancellation blocked and report acceptance independent; validate both changes and documentation links.
- [x] 2.2 Run integration and relevant demo tests, build, real-browser report verification and scoped privacy review; record commands/results and confirm D5a is complete without claiming cancellation.
