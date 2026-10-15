# Pending Operation Dialog verification

Verified on 2026-09-04 in the existing Windows checkout. All mutations used isolated, in-memory fixtures; no live wallet burn, send, transfer, logout, or reset was performed.

## Automated checks

- `node --test packages/integration/tests/*.test.mjs packages/integration-demo/tests/*.test.mjs`: **203 passed, 0 failed**.
- `npm run build`: TypeScript and both production bundles passed. Vite reports the existing large-chunk advisory; test Vite servers also reported a non-fatal HMR port collision.
- `openspec validate add-pending-operation-dialog --strict`: passed.
- Read tests cover exactly one retry, both failures, per-attempt timeout, parent cancellation, stale callbacks, and account replacement. Activity retains 75 seconds per initial attempt; Assets retains 30 seconds per attempt.

## Browser checks

The demo runs at `http://127.0.0.1:5177/`; the usual development ports were occupied. The following fixtures mount the production integration UI with controlled adapters:

| Page under `/tests/` | Result and evidence |
| --- | --- |
| `pending-operation-host.html` / Run checks | PASS: immediate cover, inert underlying controls, Escape containment, usable adjacent Admin control, single read retry, final error with only OK, source-page closure, first-result Activity readiness, Receive, balances, recovery preparation, late callbacks, and 280-by-360 host bounds. |
| `pending-operation-host.html` / Run lifecycle checks | PASS: delayed hydration, creation, persistence, logout, restoration, restore persistence, and visible Reset remain covered. |
| `account-assets-host.html` | PASS: image readiness/fallback, list/detail rendering, exact quantities, copy behavior, focus, scrolling, narrow host, confirmation cancellation, failed burn dismissal, and refreshed holdings. |
| `send-host.html` | PASS: initial checks, Max/review, review focus, single submission, transaction facts, uncertainty, and fresh-send preparation. |
| `transfer-host.html` | PASS: loading/error coverage, error acknowledgement and reopening, compact direction controls, review, unknown outcome, and parent navigation. |
| `logout-host.html?plain` | PASS: ordinary host presentation, confirmation, failure acknowledgement, reopening, and success. |

Burn-specific assertions prove that submission occurs once, **Burning...** remains through a delayed holdings refresh, and the completed Assets page has no `Asset burned.` message. A separate successful-burn/failed-refresh scenario asserts exactly two read attempts without another burn, then OK returns to a newly prepared Assets parent. Unconfirmed burn results display the explicit outcome message and preserve the existing recovery contract.

Visual inspection confirmed the centered light dialog, orange rotating bolt, dark translucent runtime backdrop, and readable error action. The actual demo's Account entry was also inspected at its saved 50% preview scale. The existing reduced-motion stylesheet disables bolt animation; operation labels use a polite live region. Screen-reader speech and an operating-system reduced-motion preference were not manually exercised.

Background transfer checks do not register foreground notices or refresh balances. Activity can reveal its first usable snapshot while observation continues. The coordinator waits for all current child preparation signals, and component cleanup plus core generation checks prevent obsolete work from controlling the current page. Existing core regression tests cover recovery records and mutation safeguards.

## Scope

OpenSpec proposal, design, presentation deltas, tasks, and runtime documentation are included. No dependency or game-facing public API was added. Existing unrelated checkout changes were retained.

## Transactions regression follow-up

On 2026-09-04, reproduced the reported failure in the user's Chrome preview at `http://127.0.0.1:5173/`. Both history attempts failed inside asset normalization. The installed SDK's history builder computes outgoing asset amounts as change minus spent; these signed deltas were incorrectly rejected by the integration's nonnegative-holdings validation. The adapter now preserves their exact signed bigint quantity while retaining asset ID and integer-type validation.

The command `node --test --test-name-pattern="Transactions loads signed SDK" packages/integration/tests/activity-stall.test.mjs` failed before the fix with `unavailable` instead of `ready`, then passed after the fix. It covers an exact negative quantity beyond Number precision, mixed positive and negative asset deltas, retention of ordinary transactions, and no retry of valid history.

Related verification: `node --test packages/integration/tests/activity*.test.mjs packages/integration/tests/transaction*.test.mjs` passed all 21 tests; `npm run build` passed. The real Transactions page then loaded eight records successfully and dismissed its loading dialog. This was read-only verification against existing history; no wallet transaction was submitted. Temporary diagnostics were removed.
