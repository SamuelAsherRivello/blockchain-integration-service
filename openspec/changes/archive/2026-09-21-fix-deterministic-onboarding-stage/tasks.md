## 1. Deterministic readiness model

- [x] 1.1 Replace the separate onboarding stage and label decisions with one active-profile readiness projection; verify focused unit tests cover Arkade, Bitcoin, incoming transaction, plan, return receipt, completed record, unavailable balance, and positive total without a component balance.
- [x] 1.2 Update the context's Onboarding navigation lifecycle to retain a ready balance only for the same active profile or perform the bounded fresh read; verify context tests reject late profile results and do not persist a balance or mutate onboarding records.

## 2. Account presentation

- [x] 2.1 Update Account Details, the onboarding page, and Admin E3 to consume the shared readiness projection; verify a positive active Arkade balance renders Onboarding: Complete and five Complete stages without submitting or resuming a transfer.
- [x] 2.2 Preserve the existing five-stage layout, disclosure behavior, transaction evidence, and Back route; verify the browser onboarding host covers Account Details-to-Onboarding and direct Admin E3 paths with a positive Arkade balance.

## 3. Verification

- [x] 3.1 Run the focused onboarding/context tests and `npm run typecheck`; verify the production integration build succeeds.
- [x] 3.2 Reproduce the positive-Arkade-balance scenario in the real BIS Admin browser and verify Account Details and Onboarding agree on Complete without a stale/cross-account balance or wallet mutation.
