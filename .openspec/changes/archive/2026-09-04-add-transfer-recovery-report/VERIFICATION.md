# D5a verification — 2026-09-04

## Follow-up: recovery moved into Account Activity

The following supersedes the original placement below: Account Transfer shows one pending notice; one click on the saved pending Activity row opens transaction details with Check Status and expanded Copy recovery details. Same-account metadata is attached to both standalone and deduplicated history rows. A different operation returned by a check requests Refresh Account Activity and is never substituted into the selected report. Unsupported cancellation/undo remains absent and guards remain intact.

- Test-first: the new transfer-activity metadata test failed (missing operationId), then passed after the public projection was added.
- All 122 integration/demo unit and documentation tests passed. Production build and typecheck passed (existing chunk-size/HMR-port advisories).
- Real-browser fixtures passed: activity-recovery-host (one-line placement, one-click details, explicit check/copy, clipboard denial, failed checks, operation isolation, ordinary rows and no mutation); recovery-report-host (stale copy, terminal/remount, 360px no-overflow); activity-host (production navigation/fixed height); transfer-host (review flow and pending guards).
- No live transfer was submitted, cancelled, cleared or claimed resolved. Browser fixtures use isolated doubles.

## Delivered

Pending Account Transfer now has expandable Recovery details, a read-only wrapped report, explicit Copy recovery details, success/failure feedback and manual selection fallback. Failed status checks mark preserved pending information as verification unavailable. The report is an allowlisted projection of public status, not a wallet serialization. No new public API, dependency, storage migration, signing or cancellation was added.

D5a has its own proposal and acceptance, independent of D5b actual cancellation. D5b retains cancel-pending-transfer and its feasibility block. Both stories are listed under the preserved D5 documentation anchor and linked from D4.

## Test-first evidence

- `node --test packages/integration/tests/transfer-recovery-report.test.mjs` initially failed all four tests because the formatter did not exist. The same four tests passed after implementation.
- The real-browser `/tests/recovery-report-host.html` fixture initially reported `FAIL: Pending transfer offers Recovery details`. After implementation it reported PASS for exact copy, denied clipboard fallback, stale clipboard completion, failed status checks, guard presentation, terminal/remount behavior and 360px layout, with no mutation calls or transfer-journal changes. The fixture uses isolated status and clipboard doubles; it does not modify the real clipboard or submit live funds.
- `node --test packages/integration/tests/transfer-recovery-report.test.mjs packages/integration/tests/boarding-recovery.test.mjs packages/integration/tests/account-transfer.test.mjs packages/integration/tests/transfer-activity.test.mjs packages/integration-demo/tests/documentation.test.mjs`: 28/28 passed.
- `npm run typecheck` and `npm run build`: passed. Build retains the existing large-chunk advisory.
- Strict validation passed for add-transfer-recovery-report and cancel-pending-transfer. Documentation TOC/link tests passed. Scoped `git diff --check` passed (Windows line-ending advisories only).

## Broader checkout status

`node --test packages/integration/tests/*.test.mjs packages/integration-demo/tests/*.test.mjs` ran 116 tests: 113 passed, three failed in the concurrently added, unrelated send-context.test.mjs because quoteAccountSend/checkAccountSend were not yet present. Those failures were not caused by or repaired as part of D5a. Some parallel demo test servers also reported an occupied HMR port; the documentation tests still passed. This is not a claim that the whole changing checkout is green.

## Scoped privacy review

The new formatter accepts only public status fields, formats fixed enum labels, validates UUID and transaction-ID syntax and sats, and excludes unknown properties. Tests inject private sentinel strings into extra/malformed fields and verify exclusion. The new UI has no SDK, account-secret, localStorage, network-send or wallet-mutation calls; its only side effect is user-triggered clipboard writing. Clipboard denial does not hide the text. Report changes remount copy state and ignore late completion. Sharing is manual and the UI warns that public IDs reveal transaction-related information.

## Outcome and limits

D5a is complete. In the running demo at `http://127.0.0.1:5173/`, use Account Transfer on an unresolved operation and expand Recovery details. Existing Log Out/Reset and wallet guards remain unchanged. The stuck transfer was not cancelled, retried or cleared. D5b still needs authoritative deployed-operator scope/finality evidence; D5a supplies the handoff questions but does not contact the operator.
