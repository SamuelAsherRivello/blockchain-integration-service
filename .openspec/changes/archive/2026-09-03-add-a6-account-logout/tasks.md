## 1. Core contract and guarded clearing

- [x] 1.1 Add logout state, acknowledgement, confirmation/cancellation methods, and public disconnection event types; verify type checking and storage-double tests for unchecked rejection, cancellation, and fresh-opening reset.
- [x] 1.2 Add account-generation-bound clearing without changing Admin reset semantics; verify with isolated doubles and code inspection that stale confirmations cannot clear replacement accounts and stale saves cannot resurrect cleared identities. Do not execute real database deletion.
- [x] 1.3 Implement serialized logout, read-back reconciliation, and Retry for failed or ambiguous completion; verify failure-before-commit, failure-after-commit, duplicate submission, and replacement-account cases using storage doubles.
- [x] 1.4 Reconcile storage notifications and emit one non-secret disconnection per active-to-absent transition; verify two-context, initial-empty, reset-during-logout, and disposal races without real storage deletion.

## 2. Production UI

- [x] 2.1 Enable the active Account Log Out action and render backup confirmation using existing production styling; verify warning, checkbox toggling, keyboard labeling, disabled submission, Back, and absence of recovery access through component tests.
- [x] 2.2 Render working and error/Retry states and preserve the Account destination after success; verify with controlled storage doubles that success is never shown prematurely, Restore stays disabled, and Back restores the original host presentation.

## 3. Demo and documentation

- [x] 3.1 Add Account / Log Out through the production API, preserving empty initial preview and selection after logout; verify active-account and no-account entry without fabricated profiles or automatic creation.
- [x] 3.2 Synchronize user-story diagrams, confirmed design notes, API/package documentation, and stale A6 references with the implemented behavior; verify stable A6 step IDs, error/Retry, recovery exclusion, payment deferral, and accurate pending/completed status.

## 4. Integration verification

- [x] 4.1 Run the repository's relevant test, type-check, and build commands after inspecting their scripts for destructive operations; record results and verify A1/A2 entry, creation, and disposal regressions are covered without executing real database deletion.
- [x] 4.2 Verify production confirmation visually in Runtime Preview and an independent host, including existing preview scales, keyboard interaction, and cancellation; record browser evidence with no recovery material in screenshots.
- [ ] 4.3 Deliver a manual disposable-Signet-account checklist for real logout, reload, offline logout, two-tab reconciliation, unrelated-data preservation, and continued host usability; leave this task pending until the user performs the deletion-based checks and supplies results, as required by repository database rules.
- [ ] 4.4 Validate the OpenSpec change and review evidence against every requirement; report A6 complete only when all applicable automated and manual checks have passed, keeping unrelated future feature decisions explicitly deferred.
