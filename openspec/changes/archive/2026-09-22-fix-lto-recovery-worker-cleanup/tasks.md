# Tasks

## 1. Reproduce and specify recovery ordering

- [x] 1.1 Add a deterministic regression fixture for disposing an LTO service while an unresolved contract exists, and verify the test currently reproduces the missed refund cleanup.
- [x] 1.2 Add coverage for delayed reconciliation, repeated disposal, and a replacement worker, verifying that the contract remains durable and refund submission occurs at most once.

## 2. Implement scoped disposal recovery

- [x] 2.1 Capture the disposed player, game wallet, network, and operator scope and persist end-session markers for matching unresolved records, verifying unrelated records remain unchanged.
- [x] 2.2 Coordinate disposal with any active reconciliation pass so a follow-up pass is guaranteed, verifying the disposed contract reaches a verified terminal refund or remains explicitly unresolved for later recovery.
- [x] 2.3 Keep recovery polling and storage subscriptions alive until the scoped unresolved set is terminal, then verify timers and storage resources are released exactly once.

## 3. Verify the complete LTO recovery contract

- [x] 3.1 Run the focused LTO and contract-recovery tests, verifying disposal, restart, expiry, session replacement, Claim, and Refund behavior.
- [x] 3.2 Run typecheck, production builds, and OpenSpec validation, verifying no public Start/Claim API regression and that the change artifacts are complete.
