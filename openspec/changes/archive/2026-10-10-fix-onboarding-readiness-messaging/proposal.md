# Proposal

## Why

The onboarding page currently tells users to fund the account even after the account has completed Bitcoin-to-Arkade setup, which contradicts the readiness state already established by the system. It also surfaces a generic balance-load error during a temporary background read failure, distracting from the onboarding progress that remains available and then disappearing when the next read succeeds.

## What Changes

- Show a completion-specific onboarding message when the account is already funded and ready to use.
- Replace the incomplete onboarding copy with two cosmetic lines:
  - `You must fund the account per step 2.`
  - `Then wait for onboarding to finish.`
- Keep the completion message as `Your account is already funded and ready to use.`
- Prevent a transient shared balance-read failure from appearing as the generic “Balances could not be loaded” error while the onboarding page is open.
- Preserve the existing background onboarding observation, verified readiness rules, and retry behavior for actual onboarding failures.
- Add regression coverage for incomplete, complete, and temporarily unavailable balance states.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-automatic-onboarding`: clarify the user-facing readiness message and ensure compact onboarding presentation does not expose an unrelated transient balance-loading error.

## Impact

- React onboarding presentation in `BIS/packages/integration/src/client/ui-layer-react/AccountOnboarding.tsx`.
- Shared account-page loading/error presentation in `BIS/packages/integration/src/client/ui-layer-react/client.tsx` or the smallest appropriate view-specific boundary.
- Existing onboarding and UI host tests under `BIS/packages/integration/tests/client/` and `BIS/packages/integration-admin/tests/client/`.
- No public API, persistence format, wallet operation, or network protocol changes.
