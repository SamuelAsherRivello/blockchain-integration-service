## Why

The live BIS Admin reproduces a mismatch: Account Details can show a positive Arkade balance while Onboarding opens at step 2, asking the player to fund the account. This makes the onboarding progress depend on navigation and asynchronous state lifetime rather than the active wallet state.

## What Changes

- Define one deterministic five-stage projection for the active account that gives a verified positive Arkade balance precedence as completed onboarding (stage 5).
- Preserve or refresh the active account's balance when navigating from Account Details or Admin E3 into Onboarding, so the rendered stage derives from the same live wallet state shown in Account Details.
- Keep Bitcoin-only evidence at stage 2, a durable onboarding plan at stage 3, a verified return receipt at stage 4, and a completed onboarding record at stage 5.
- Align the Account Details onboarding entry and the onboarding page so they cannot report conflicting readiness for the same active account.
- Add regression and browser coverage for reopening Onboarding from a positive-Arkade-balance Account Details view.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `account-automatic-onboarding`: make the five-stage presentation deterministically reflect the active account's verified Arkade balance and preserve the ordered evidence rules.
- `account-balance`: require the Account Details readiness entry and Onboarding navigation to share the active account's fresh balance state without stale or cross-account reuse.

## Impact

- Affected code: `BIS/packages/integration/src/core/context.ts`, onboarding state/presentation modules, `BIS/packages/integration/src/ui/AccountOnboarding.tsx`, and the integration-demo Admin flow.
- Affected tests: onboarding stage/context regressions and the browser onboarding host.
- No new dependency, wallet mutation, account persistence, or game-facing API is required.
