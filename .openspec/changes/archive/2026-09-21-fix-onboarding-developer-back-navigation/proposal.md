# Proposal

## Why

When onboarding is opened from the production Developer menu, selecting Back is expected to return to that same Developer menu. The current transition can leave the account view in the wrong route because it combines the context-level account navigation update with local Developer-menu state, so the return path is not reliably restored. This blocks the intended Developer → Onboarding → Back workflow and needs a focused regression fix.

## What Changes

- Make the Back action from onboarding opened by the Developer menu restore the Developer menu deterministically.
- Preserve the existing Back behavior for onboarding opened from Account Details: it must continue returning to Account Details/Balance.
- Keep the account context and Developer-menu state synchronized so no stale onboarding or details route remains visible after returning.
- Add or strengthen a UI regression scenario covering Developer → Onboarding → Back → Developer, followed by Developer → Back → Account Details.

## Capabilities

### New Capabilities

<!-- None. This is a correction to an existing navigation contract. -->

### Modified Capabilities

- `account-entry`: Clarify and enforce nested Developer-menu onboarding navigation and its Back destination.

## Impact

- `BIS/packages/integration/src/ui/client.tsx`: onboarding/Developer view state and Back routing.
- `BIS/packages/integration-demo/tests/onboarding-host.tsx` and/or the closest existing UI harness: regression coverage for both onboarding entry points and Back destinations.
- `.openspec/changes/fix-onboarding-developer-back-navigation/specs/account-entry/spec.md`: delta requirements for the corrected navigation contract.
- No public API, dependency, storage, wallet, or transaction behavior changes are intended.
