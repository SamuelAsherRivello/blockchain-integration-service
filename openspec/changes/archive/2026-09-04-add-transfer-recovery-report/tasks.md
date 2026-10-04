## 1. Report and UI

- [x] 1.1 Add failing formatter tests for pending/unknown/terminal status and exclusion of secrets or malformed values; run and record the failure before implementation.
- [x] 1.2 Implement the pure allowlisted report formatter; pass the same focused tests.
- [x] 1.3 Add a failing isolated browser fixture for recovery details and copy/status behavior; verify it fails before UI implementation.
- [x] 1.4 Implement expandable report, explicit copy/fallback and stale-result handling; pass the browser fixture with unchanged transfer journal and no mutation calls.

## 2. Split and verify

- [x] 2.1 Reconcile D5a/D5b stories and both proposals, keeping cancellation blocked and report acceptance independent; validate both changes and documentation links.
- [x] 2.2 Run integration and relevant demo tests, build, real-browser report verification and scoped privacy review; record commands/results and confirm D5a is complete without claiming cancellation.

## 3. Account Activity recovery placement

- [x] 3.1 Keep one pending-transfer sentence on Account Transfer; retain submission guards.
- [x] 3.2 Project public recovery metadata into same-account local and deduplicated SDK activity rows; open details on one click.
- [x] 3.3 Place read-only Check Status and expanded copyable recovery details in the selected pending transaction; reject changed-operation responses and offer no unsupported undo.
- [x] 3.4 Verify unit tests, build and isolated browser placement, clipboard, lifecycle and narrow-layout checks.
