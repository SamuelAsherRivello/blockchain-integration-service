## 1. Implementation prerequisite: verify fresh SDK reads

- [x] 1.1 Trace the installed SDK 0.4.67 balance/synchronization path and record required sources, available/total semantics, and error propagation in the A4 verification notes; demonstrate that fresh reads can be obtained without persistent caches or wallet mutations before proceeding. Report incompatibility rather than changing dependencies or accepting stale fallback.

## 2. Adapter and core implementation

- [x] 2.1 Add the private bounded Signet balance adapter using temporary in-memory wallet repositories; verify direct available/total mapping, true zero, invalid/partial data rejection, source failure, timeout, and cleanup after late wallet acquisition with focused tests.
- [x] 2.2 Add provider-neutral ephemeral balance state and refreshBalance() to the public context; verify Account Details entry/manual refresh, cleared amounts during loading and failure, disabled duplicate requests, and no polling or balance storage writes.
- [x] 2.3 Bind balance work to account and presentation generations; verify Back, logout confirmation/cancellation, account replacement, cross-instance invalidation, reset, and disposal prevent late publication and preserve existing account-access semantics.

## 3. Production UI and demo integration

- [x] 3.1 Provide the Account menu and Account Details dialog with the shared logged-in/ID/Signet information block. Verify menu actions are bolt-prefixed Account Details and Log Out, plus Back; Details has balances, bolt-prefixed Refresh and Back only, equal action spacing, and navigation remains usable during pending/failed reads.
- [x] 3.2 Add Account / Account Balance to Admin through production APIs only; verify a real active account opens the menu and Account Details opens the balance dialog, no account opens the chooser, story navigation locks appropriately, and no placeholder features or simulated balances appear.

## 4. Integrated verification and documentation

- [x] 4.1 Run npm run build and relevant account/balance regression checks; verify existing creation, restoration, shortened ID formatting, and logout confirmation behavior remain intact, with results recorded.
- [x] 4.2 Verify the actual browser demo and a plain production host, including 9:16 layout, keyboard access, loading, success, failure after success, Retry through Refresh, reopen/reload, and no balance persistence; record observed outcomes without exposing secrets or treating test fixtures as live data.
- [ ] 4.3 Verify real read-only Signet balance requests for zero and an available funded account, comparing displayed amounts with fresh SDK results; record nonzero coverage separately and leave it pending if no funded account is available. Do not fund, send, settle, or otherwise mutate wallets as part of this task.
- [x] 4.4 Update User Story Diagrams.md, design-discussion.md, affected current package documentation, and OpenSpec context to describe delivered A4 scope and the deferred A5/C4/receiving features; verify stable story/step IDs and preserve unrelated pending A2/A6 verification notes. Record A4 evidence in .openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md and report completion only to the extent verified.

## 5. Planning-to-delivery consistency

- [x] 5.1 Validate the implemented change against all three delta specs and run openspec validate add-a4-account-balance --strict; verify every task's evidence is present or explicitly pending before claiming implementation complete. Keep archive/spec synchronization as a separate requested workflow.

Archive decision (2026-09-03): user approved sync, archive, commit and push with task 4.3 explicitly pending. Archiving does not mark funded-wallet verification complete.
