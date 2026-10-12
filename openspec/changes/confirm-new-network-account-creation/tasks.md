# Tasks

## 1. Restoration decision state

- [ ] 1.1 Extend the player restoration state machine to retain a verified, pending identity and enter a first-local-profile confirmation only after the selected operator and network-scoped local-profile lookup succeed; verify focused context tests cover no save, activation, or `accountConnected` before confirmation.
- [ ] 1.2 Route confirmation through the existing role-conflict, encrypted save, reconciliation, and activation boundaries; verify tests cover Confirm, Cancel, a same-network saved profile, and a same phrase on separate network-scoped stores without copied state.

## 2. Production confirmation UI

- [ ] 2.1 Render the recovery-flow confirmation with the exact title `Create New Account?`, the selected network label, Cancel, and Create Account actions; verify the focused React/UI tests assert the prompt text and action behavior without exposing recovery words.
- [ ] 2.2 Preserve recovery-flow Back, error, pending-operation, focus, and cleanup behavior while the confirmation is visible; verify cancellation clears transient recovery input and restores the logged-out Account dialog.

## 3. Verification

- [ ] 3.1 Add regression coverage for operator mismatch/unavailability, local profile lookup scope, role conflict, and stale/disposed confirmation callbacks; verify the relevant integration test files pass.
- [ ] 3.2 Run `npm run typecheck`, `npm run test --workspace @bis/integration`, and `npm run build --workspace @bis/integration`; verify all commands succeed.
- [ ] 3.3 Run the project preview and Playwright coverage to verify a valid first-time restore displays the confirmation, Cancel saves nothing, Create Account activates it, and an existing same-network profile restores without a confirmation; retain only privacy-safe test evidence under `output/`.
