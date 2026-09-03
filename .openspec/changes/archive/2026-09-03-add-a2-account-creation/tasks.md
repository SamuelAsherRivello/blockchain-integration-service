## 1. Feasibility checkpoint before implementation

- [x] 1.1 Verify the installed SDK against current official Signet/browser documentation for creation, recovery format, reconstruction, network enforcement, and cleanup; record versioned source evidence in design.md and stop for revised planning if the required real flow is unsupported.
- [x] 1.2 Validate the proposed transient-until-Continue and encrypted origin-storage approach, including SDK persistence side effects and Web Crypto/IndexedDB support; deliver a reviewed storage/lifecycle contract and confirm that it can meet reload and reset requirements without a plaintext phrase or unlock UX.

## 2. Production account lifecycle

- [x] 2.1 Introduce the private Arkade adapter for real Signet creation and compatible identity reconstruction; verify network rejection and safe failure handling with isolated adapter tests, without a simulated-wallet demo mode.
- [x] 2.2 Implement versioned account persistence and hydration; verify same-profile reconstruction, no writes before Continue, unsupported/corrupt records, storage failures, and separation from unrelated origin data.
- [x] 2.3 Extend core/public state with readiness and safe account lifecycle operations; verify commit-before-activation, one activation event per completed creation, duplicate actions, retry using the same identity, and absence of secrets/SDK types from public output.
- [x] 2.4 Implement cancellation/disposal and reset generation coordination; verify late async results and stale instances cannot save or activate abandoned accounts and ordinary disposal preserves completed accounts.

## 3. Production UI and story boundaries

- [x] 3.1 Enable logged-out Create Account, keep Restore disabled, and add the lightning loader plus recovery screen at A2.06; verify keyboard operation, warning text, private rendering, and proposed optional-backup Continue behavior at A2.09.
- [x] 3.2 Implement A2.10 and returning-account routing using the Account title, updated status, disabled Log Out, and Back; verify Create/Restore are hidden, Back restores the prior presentation, and active entry no longer throws.
- [x] 3.3 Add sanitized creation/save/hydration failure presentation; verify explicit retry and Back behavior without false activation, overwritten accounts, or leaked secret-bearing error payloads.

- [x] 3.4 Add Copy to Clipboard above Continue; verify exact space-separated phrase format, success/failure feedback, and that copying neither activates the account nor blocks Continue.

## 4. Demo integration and first-run reset

- [x] 4.1 Add Account / Create Account using the production public API; verify it opens the chooser or minimal active dialogue without automatically creating an account, and refresh clears selection while retaining the committed account.
- [x] 4.2 Implement scoped asynchronous Reset Client and its saved-account-aware enabled state; verify reset error reporting, released handles, empty preview, and first-run routing using permitted non-destructive test doubles. Any destructive real-database reset check must be performed manually by the user under the repository safety rule; record the result without running that operation as the agent.

## 5. Documentation and end-to-end verification

- [x] 5.1 Synchronize story diagrams, design-discussion, package boundary notes, relevant READMEs, and stale OpenSpec context descriptions with the implemented scope; verify stable step IDs, accurate completion statuses, disabled A6 logout, and no implied numeric implementation order.
- [x] 5.2 Run the repository build, relevant lifecycle tests, and strict OpenSpec validation; record commands/results and resolve failures before claiming completion.
- [x] 5.3 Exercise real Signet creation, Continue, refresh/browser restart, returning A2, Back, preview scaling, and refresh before Continue in a real browser; verify the production-host/demo behavior agrees and record only safe results, never recovery text, secret-bearing DOM snapshots, screenshots, or traces.
- [ ] 5.4 Obtain the permitted manual reset verification result for committed and interrupted creation, including stale-instance behavior; verify first-run state and unrelated data preservation, and provide the running demo URL for the user to try.

## Verification handoff

Automated/browser results: real Signet creation, 12-word recovery presence without capturing words, immediately available Continue, interrupted-creation refresh, committed reload, browser restart with retained profile, plain-host parity, disabled Log Out, Back, and preview scale passed. Context tests cover duplicate requests, failed saves, corrupt-load handling, stale results, reset errors, and cross-instance reset notifications.

Manual task 5.4 (do not report A2 complete until recorded):
1. With a completed account, click Admin Reset Client. Expect empty viewport; select A2 and expect the logged-out chooser. Refresh and confirm it stays logged out.
2. Begin another creation and use Reset Client while creating or showing recovery. Wait for any old request to finish; reopen A2 and verify no account appeared.
3. Open the same origin in another tab before reset. Reset in one tab; the other must forget the old account and must not reactivate it. Unrelated host data must remain untouched.

The agent did not execute live database deletion. This handoff is required by the repository database-safety rule, not a missing implementation permission. Dev URL: http://127.0.0.1:5175/.

Final automated verification: npm run build passed (Vite bundle-size warning); all 11 context tests passed; openspec validate add-a2-account-creation --strict passed.

Clipboard verification: browser test with an intercepted clipboard writer confirmed all 12 displayed words match plain single-space-separated output, successful feedback, denied-write feedback/retry, and Continue remaining enabled. No recovery words were logged or placed on the system clipboard by this test. Build and strict spec validation passed.

## Archive disposition

Archived at the user's explicit request on 2026-09-03 with task 5.4 still unchecked. Manual real-storage reset verification has not been reported as passed. The implementation and other recorded checks are retained; archive status does not assert that this outstanding verification was completed.
