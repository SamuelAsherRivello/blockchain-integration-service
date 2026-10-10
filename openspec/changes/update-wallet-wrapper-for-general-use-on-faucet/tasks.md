# Tasks

## 1. Define the shared service boundary

- [x] 1.1 Add consumer-neutral types for wallet scope, public reads, onboarding plans, operation stages, safe failure categories, and reconciliation results; verify the integration package type-checks without exposing Arkade SDK types through game-facing APIs.
- [x] 1.2 Add injected interfaces for persistence, exclusive mutation ownership, cancellation, and lifecycle cleanup; verify browser adapters can satisfy the interfaces without importing server-only dependencies.
- [x] 1.3 Add unit tests for scope validation, network/operator mismatch, secret redaction, and operation identity; verify the new tests pass with `npm test` or the repository's focused integration test command.

## 2. Move BIS onboarding behavior behind the boundary

- [x] 2.1 Adapt the existing onboarding implementation to the shared service while preserving confirmed-input selection, reservations, policy checks, exact outputs, bounded deadlines, and attributable event handling; verify existing automatic-onboarding and boarding-settlement tests remain green.
- [x] 2.2 Preserve browser-specific records, `navigator.locks`, cancellation, account replacement checks, and cleanup in the browser adapter; verify reload, account replacement, and ambiguous-submission recovery tests pass.
- [x] 2.3 Export the minimal shared integration entry point needed by downstream consumers; verify package build succeeds and exported declarations contain no Arkade-specific types in game-facing interfaces.

## 3. Adapt the faucet

- [x] 3.1 Replace the faucet's direct SDK ramps mutation with the shared service and supply a server-safe wallet scope, persistence implementation, process exclusivity, and cleanup; verify faucet unit tests cover address, balance, history, and onboarding reads.
- [x] 3.2 Add durable faucet operation status and reconciliation so restart or lost responses cannot trigger duplicate settlement; verify an ambiguous submission remains pending and is reconciled before retry.
- [x] 3.3 Normalize faucet responses for prepared, pending, complete, operator-unavailable, policy-unsupported, rejected, and outcome-unknown states; verify `fee-estimation-unavailable` is shown as operator unavailability and never as spendable balance.
- [x] 3.4 Ensure faucet logs, HTTP responses, and persisted records contain no mnemonic or recovery material; verify secret-redaction tests and repository secret scans pass.

## 4. Align downstream consumers and documentation

- [x] 4.1 Route remaining Marketplace/BIS onboarding or settlement entry points through the shared public integration boundary; verify Marketplace tests still enforce active-wallet, network, and pending-operation scoping.
- [x] 4.2 Document the shared service boundary, consumer adapters, operator prerequisite, and truthful unavailable behavior in the relevant package README(s); verify all documented commands and links resolve.

## 5. Verify real faucet readiness

- [ ] 5.1 Add integration coverage using an approved healthy real operator or controlled live test environment to prove exact settlement creates real commitment/Arkade evidence and updates available balance; verify no simulated transaction IDs are used.
- [x] 5.2 Run the faucet against the configured Signet operator and record whether fee estimation and commitment construction are available; verify the result is captured under `output/reports/update-wallet-wrapper-for-general-use-on-faucet/` without secrets.
- [ ] 5.3 Use Playwright to verify the faucet onboarding action, status transitions, transaction evidence, balance refresh, and positive available Arkade balance when the operator is healthy; verify the browser-visible balance is the actual wallet balance.
- [x] 5.4 Use Playwright to verify the unavailable-operator path when `fee-estimation-unavailable` persists; verify the faucet remains truthful, offers safe retry/reconciliation, and is not reported as fixed until a healthy run reaches spendable balance.
