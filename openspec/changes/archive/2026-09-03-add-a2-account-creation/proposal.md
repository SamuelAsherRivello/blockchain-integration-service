## Why

A1 opens the account dialogue but cannot create an account. A2 will complete real test-account creation and remember the resulting identity across browser restarts, using the same production behavior in the game and Runtime Preview.

## What Changes

- Enable Create Account for a logged-out player; create a genuine in-browser Signet identity through the Arkade SDK, show the recovery phrase immediately, and activate on Continue.
- Persist only completed creation. Closing or refreshing before Continue restarts creation from the beginning; no pending recovery screen is resumed.
- Remember the account on the same browser across refreshes and restarts. The intended lifetime ends at explicit logout, Reset Client, or loss of browser data; working logout remains A6.
- After Continue, return to Account with status "You are now logged in.", disabled lightning-prefixed Log Out, and enabled Back. Hide Create Account and Restore Account. Returning saved accounts use this same minimal dialogue; A4 retains the full menu.
- Add an A2 Create Account demonstration through production APIs. Reload clears admin selection and leaves the viewport empty, while retaining the completed account.
- **BREAKING**: Reset Client now clears integration-owned persisted account state as well as transient state, providing a first-run experience. It must not clear unrelated host data.
- Preserve numbered diagram steps, especially A2.06 (recovery), A2.09 (Continue), and A2.10 (activation). Story IDs do not prescribe implementation order.

## Capabilities

### New Capabilities

- `account-creation`: Real Signet account creation, recovery display, activation, persistence, failure handling, and the minimal saved-account endpoint.

### Modified Capabilities

- `account-entry`: Enable creation and recognize saved accounts without implementing the full A4 menu.
- `story-driven-demo`: Add the A2 demonstration, separate selection from persistence, and redefine Reset Client as first-run reset.

## Impact

- `packages/integration`: core account lifecycle and safe public state; production UI; Arkade adapter and account persistence.
- `packages/integration-demo`: A2 navigation, persisted-state-aware reset, and real production-flow verification.
- Planning/documentation: user-story diagrams and later implementation documentation must distinguish the new planned scope from the existing A1 behavior.
- Use the installed SDK as the starting point. Current Signet support, identity serialization, storage protection, and lifecycle cleanup require a feasibility checkpoint before wallet implementation. No SDK feasibility is claimed by this proposal.
- No restoration, functional logout, full account menu, balance, funding, payments, achievements, or external game repository changes.
- Continue without a mandatory backup check is a proposed default consistent with the existing optional-saving journey; it was not separately confirmed in the interview. Concrete storage/protection mechanisms and failure policies below are engineering proposals for review.
