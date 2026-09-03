## 1. Implementation feasibility gate

- [ ] 1.1 Verify the installed SDK and configured Signet operator can issue one asset with the proposed metadata, return fresh holdings/details, and rediscover it under the restored identity; record actual funding requirements and public evidence in documentation/C1_C4_VERIFICATION.md. Keep credentials outside logs and stop with an explicit blocker if live support or funding is unavailable.

## 2. Public API and wallet integration

- [ ] 2.1 Add JSON-safe public achievement/result types and UI-independent earn/list methods; verify an independent host can call them without mounting BIS UI and that logged-out/invalid-input calls return the specified errors.
- [ ] 2.2 Implement the Signet asset adapter with exact identifier metadata, single-unit non-reissuable issuance, fresh ownership reads, and recognition/filtering; verify focused tests cover unrelated metadata, bigint serialization, insufficient funds, and failed reads versus empty holdings.
- [ ] 2.3 Implement same-origin per-profile serialization and non-secret durable operation records with conservative reconciliation; verify concurrent calls, repeat after reload, unavailable locks/storage, and uncertain submission never cause automatic duplicate issuance.
- [ ] 2.4 Integrate account generation/disposal checks and bounded wallet cleanup without falsely cancelling submitted transactions; verify account switching, logout, reset, timeout, and late completion cannot attribute results or new submissions to the wrong account.

## 3. Admin demonstrations

- [ ] 3.1 Add the non-clickable C1 container with Earn and the C4 View Achievements control using public API calls and the exact agreed achievement string; verify container clicks do nothing, account-flow restrictions remain, and both actions leave Runtime Preview unchanged.
- [ ] 3.2 Add the always-visible Admin Console with labeled pending/results/errors and bounded transient history; verify actual returned lists, empty arrays, already-owned and account-required output, safe text rendering, scrolling, refresh/reset clearing, and suppression of pre-reset late results.

## 4. End-to-end verification and documentation

- [ ] 4.1 Verify in a real browser and a UI-free host: funded earn, list, repeat without another issuance, restored-account listing, no-account errors, query failures, and unchanged preview behavior; record live evidence separately from isolated fixtures and retain any unperformed checks as pending.
- [ ] 4.2 Reconcile C1/C4 diagrams, affected C2/C3 references, design-discussion.md, package/API documentation, and OpenSpec context with the delivered API-only behavior while preserving story/step IDs and unrelated pending verification; verify D/D1 remains a brief documentation-only future issuer idea and B remains deferred.
- [ ] 4.3 Run the repository's existing build and relevant account/achievement tests plus strict OpenSpec validation; record results and verify existing A-story behavior and documentation links still work before reporting completion.
