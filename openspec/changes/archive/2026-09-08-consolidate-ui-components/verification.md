# UI consolidation verification

## Baseline (2026-09-06)

The working tree was clean at apply entry; the user's recovery titles/masking and list heading/copy/empty-scrollbar changes are committed baseline behavior and must remain. No Git mutations are part of apply.

Chromium runner installed only in /tmp/bis-ui-browser; isolated Vite server on 5187. Each fixture runs in a fresh browser context, with external requests blocked and only its isolated Run action selected. No live-account fixture actions or persistent user browser profile are used.

Initial results before consumer refactoring:
- PASS: copy-host, activity-host, send-host.
- Known stale fixtures: recovery-host (old navigation and missing balance double); details-layout (expects Loading... field); restore-host (old Retry flow); balance-host (old menu); addresses-host (old address order); receive-host (old inline failure flow); recovery-report-host (expects report on Transfer); activity-recovery-host (old pending page behavior); transfer-host (old navigation); pending-operation-host (expects removed empty-assets message).
- account-assets-host initially fails the metadata image assertion because external requests are blocked. Use deterministic image responses in the isolated runner to test successful image preparation without fetching remote content.

These are baseline observations, not refactor passes. Touched fixtures will be reconciled with confirmed behavior, retaining useful assertions. Final results follow below.

## Latest user decisions retained

Set Recovery Phrase / Get Recovery Phrase; hidden words and aligned heading controls. Assets and Transactions headings with adjacent copy icons. Empty lists retain space and scrollbars without empty-state text. Their copy controls remain disabled when there is nothing to copy. Existing operation-error handling remains.

## Final results

All accepted consolidation targets are implemented. Shared components remain private, and the newer Assets list-copy action also uses the shared clipboard helper. Core/Arkade sources, package exports, package manifests and lockfile have no changes. Runtime modal policies and the standalone recovery popup are retained. An unrelated untracked `smoke-test-bis-to-game` planning directory appeared during work and was left untouched.

| Check | Result |
| --- | --- |
| copy-host and recovery-host | PASS before and after recovery extraction; Set/Get titles, 280/360px control alignment, normalized copy, masking, new setup/reopen/remount, denial/retry |
| restore-host | PASS; shared controls, editable masking, distribution, checksum, denial, late paste, error/OK and fresh restoration |
| details-layout, addresses-host, balance-host, receive-host | PASS; stable geometry, exact values/copy, blank failed fields, no stale values, error/OK, re-entry and navigation |
| activity-host and account-assets-host | PASS; list headings/copy, empty space/scrollbars, exact exports, manual fallback, selection/focus/scroll, narrow/short hosts; isolated burn confirmation and refresh |
| recovery-report-host | PASS; standalone report component, exact copy, denied/manual copy, A → B → A race, busy and terminal state |
| activity-recovery-host | PASS; popup copy and blocked-popup feedback without wallet mutation |
| send-host and transfer-host | PASS; review values, focus, Max/Back, explicit expiry disabling and fresh-review reset, pending handling, narrow layout and duplicate-send guard |
| pending-operation-host Run + lifecycle | PASS; host-local cover, keyboard containment, Admin usability, bounded retry, cancellation, one burn, continuous refresh; delayed account lifecycle work |
| ui-components-host | PASS; clipboard duplicates, denial/retry, A → B → A, old/new sessions, unmount, disabled actions, quote timing, Admin labels/arrows/selection/callbacks |
| ui-demo-host | PASS; actual demo App with isolated context factory, Set/Get and Restore, Receive, Send/Transfer reviews, asset list/detail, both empty lists at 100%, 50%, 25% |
| Real browser keyboard | PASS; Space and Enter toggle visibility; Enter copies and pastes through native buttons; masked screenshot inspected |
| Node 24.20.0 full suite | PASS: 229 tests, 0 failures |
| npm run typecheck | PASS |
| npm run build | PASS; Vite emits the existing large-chunk advisory |
| git diff --check | PASS |

### Commands and reproduction

- Start Vite from the repository root: `npm run dev --workspace @bis/integration-demo -- --port 5187 --strictPort`.
- Open the named `/tests/<name>.html` fixtures and choose their isolated **Run** action. Do not choose live-account actions. The demo fixture replaces the public context factory with in-memory doubles and never uses the normal wallet factory.
- Automated runs used temporary Playwright/Chromium under `/tmp/bis-ui-browser`; runner scripts `run.mjs` and `keyboard.mjs` created a fresh browser context per fixture, blocked external requests, and supplied a deterministic image for asset metadata image tests. Their outputs are in the same temporary directory. Browser geometry was tested at 280px/360px independent host widths, a 280×360 short host, and demo preview scales including the 1440×1000 keyboard run.
- `/tmp/bis-ui-node/node_modules/node/bin/node --test packages/integration/tests/*.test.mjs packages/integration-demo/tests/*.test.mjs` ran the full suite with the documented Node 24+ requirement. `npm run typecheck`, `npm run build`, and `git diff --check` completed successfully.

The initial Node 22 run reported 33/36 passing test files: the Admin renderer needed its new StoryAction import resolved, documentation tests needed permission to bind a local server, and wallet-scope tests lacked Node 24 Web Locks. The Admin test loader was updated; documentation ran through supported escalation; the full Node 24 rerun passed without wallet-code changes.

### Limits and retained exceptions

This is isolated Chromium verification, not live Signet payment, wallet migration or external-image availability evidence. No live account, real recovery phrase, real transfer, mint, burn, logout or user-storage cleanup was used. Firefox/WebKit and the Windows-side SSH tunnel were not tested. Historical main-spec wording about the recovery copy button and Show checkbox remains documented drift outside this refactor. The existing large build chunks are unchanged in scope.
