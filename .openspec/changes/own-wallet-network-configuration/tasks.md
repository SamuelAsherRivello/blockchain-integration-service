# Tasks

## 1. Shared Policy Foundation

- [ ] 1.1 Add shared wallet-network policy types and fee normalization utilities, and verify unit tests cover empty string, `0`, `0.0`, nonzero decimals, malformed values, and missing values
- [ ] 1.2 Add an active-network operator policy reader that validates reported network identity and returns sanitized reason codes, and verify network mismatch fails before any signing/submission fixture is reached
- [ ] 1.3 Add canonical policy serialization for quote/review binding, and verify equivalent zero encodings produce stable supported policy while unsupported policy changes invalidate stale reviews

## 2. Adapter Integration

- [ ] 2.1 Update Account Transfer quote and submit paths to consume shared policy, and verify Mutinynet decimal-zero fees allow Review Transfer while true nonzero fees block before submission
- [ ] 2.2 Update automatic onboarding assessment and leg submission checks to consume shared policy, and verify unsupported policy pauses without registering a first leg or replaying a submitted leg
- [ ] 2.3 Update Direct Send to source policy from the shared layer while preserving complete-policy quote binding, and verify direct send remains available when transfer-only terms are unsupported but send terms are safe
- [ ] 2.4 Update contract and other zero-fee wallet mutation guards that parse operator fees locally, and verify decimal-zero terms do not trigger user-facing fee-schedule errors

## 3. Availability and Presentation

- [ ] 3.1 Thread shared policy reason codes into wallet-operation availability, and verify UI/API availability distinguishes unsupported policy, unavailable policy, network mismatch, reservations, and insufficient funds
- [ ] 3.2 Update Account Transfer and related UI error mapping so predictable unsupported policy appears as an actionable availability/review reason, and verify no modal shows the legacy fee-schedule error for decimal-zero policy
- [ ] 3.3 Ensure diagnostics persist and display only allowlisted reason codes and public network/operator context, and verify raw provider payloads are not retained in recovery or activity reports

## 4. Regression Verification

- [ ] 4.1 Add focused regression tests for the screenshot failure class using Mutinynet `0.0` intent fees, and verify Account Transfer review succeeds with no network mutation
- [ ] 4.2 Add stale-policy confirmation tests for transfer, send, and onboarding boundaries, and verify each rejects without submission and requires fresh review or safe continuation
- [ ] 4.3 Run the focused wallet policy, transfer, send, onboarding, availability, and contract test suites and record the passing commands
- [ ] 4.4 Run `npm run typecheck` and `npm run build` from the repository root and verify both pass
