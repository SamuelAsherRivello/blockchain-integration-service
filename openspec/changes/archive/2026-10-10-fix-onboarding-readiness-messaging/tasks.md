# Tasks

## 1. Onboarding readiness copy

- [x] 1.1 Update the onboarding introductory message to derive from the existing readiness projection, rendering the incomplete copy as two lines (`You must fund the account per step 2.` / `Then wait for onboarding to finish.`) and the complete copy as `Your account is already funded and ready to use.`; verify the component preserves stage-5 completion for both completed records and fresh positive Arkade balance evidence.
- [x] 1.2 Add or update focused onboarding UI assertions for the exact incomplete and complete messages, including the explicit line break; verify the relevant onboarding host test passes without changing stage labels or transaction evidence.

## 2. Onboarding-specific loading behavior

- [x] 2.1 Adjust the shared account notice boundary so a temporary unavailable balance read does not emit the generic `Balances could not be loaded` message while onboarding is open, while Account Details, Swap, and other balance-consuming views retain their existing error behavior; verify the normal non-onboarding error path remains covered.
- [x] 2.2 Add a regression fixture that renders onboarding with current onboarding state and an unavailable balance, then verify the onboarding content remains visible and the generic balance error is absent until the balance read recovers.

## 3. Verification

- [x] 3.1 Run the focused integration and integration-admin onboarding/UI tests and verify the new message, complete-state, and transient-error scenarios pass.
- [x] 3.2 Run the applicable package typecheck/build checks and verify no public API or persistence files change as a result of the presentation fix.
