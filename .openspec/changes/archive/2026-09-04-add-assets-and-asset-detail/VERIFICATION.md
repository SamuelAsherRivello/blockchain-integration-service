# Assets and Asset Detail verification

Verified on 2026-09-04. This change adds runtime asset inspection; it does not implement asset mutations or remote artwork fetching.

## Implementation

- Account includes Assets immediately below Account Activity. The same dialog contains the owned-assets list and structured Asset Detail, with Refresh, full-ID Copy, Copy asset details and Back.
- Quantities preserve decimal-string precision; unknown decimals display base units. Asset identity uses full IDs, so duplicate names remain separate. Neutral local icons preserve the no-remote-icon-request contract.
- Presentation reads have a 30-second deadline, independent cancellation and account/session guards. Loading and errors clear old holdings. Back preserves selection/scroll/focus within the flow, while unmount/reset/account changes clear presentation state. Delayed cleanup cannot close a newly opened session.
- Existing API listing remains UI-independent. No dependencies or storage migrations were added. Existing concurrently edited mint, send, recovery and operation-availability work remains separate.

## Automated verification

Node tests were run with `node --experimental-strip-types --test --test-isolation=none` because this Windows sandbox rejected the test runner's child-process spawn. Each existing test file was run in its own Node invocation to preserve its global fixture isolation.

- integration/tests/assets.test.mjs: 7 passed.
- integration/tests/asset-presentation.test.mjs: 3 passed.
- integration/tests/account-assets.test.mjs: 7 passed.
- integration/tests/balance.test.mjs: 7 passed.
- integration/tests/logout.test.mjs: 13 passed.
- integration/tests/activity.test.mjs: 8 passed.
- integration/tests/transaction-detail.test.mjs: 5 passed.
- integration-demo/tests/admin-assets.test.mjs: 1 passed.

Total: 51 focused tests passed. The new asset tests were rerun after final lifecycle/formatting changes.

`npm.cmd run build` passed, including typecheck and both workspace builds. The final build required the approved normal build command outside the sandbox because Vite's Windows real-path helper was denied child-process creation (EPERM). The existing large-bundle warning remains; no dependency or bundling change was introduced. Output is in build-verification.log.

`openspec validate add-assets-and-asset-detail --strict` passed. Source diffs were reviewed for asset-specific scope; pre-existing edits in this shared checkout were preserved.

## Real-browser fixtures

Chrome at http://127.0.0.1:5173/tests/account-assets-host.html reported PASS for 24 rows, exact amounts, selection/scroll/focus restoration, full ID/report copy, manual-copy fallback, stale clipboard completion, refresh update/removal/error/empty, missing metadata, inert markup, zero icon requests, public API isolation, existing transaction navigation, unmount/remount cleanup, and narrow/short layout.

The first browser run found that the card exceeded a short host's height. An asset-only bounded grid row corrected this; the complete browser suite passed afterward, including 280x360 host checks and long metadata. Keyboard Tab from Asset Detail's heading reached Refresh Asset Detail. Public screenshots of the 9:16 live list and isolated final list/detail were captured and retained in this task conversation.

The existing http://127.0.0.1:5173/tests/asset-console-host.html suite reported PASS for actual App pending/success Console sequence, full holdings, empty arrays, safe/no-account errors, 100-entry retention, scrolling, reset clearing, obsolete-list-result suppression, unchanged Runtime Preview, and UI-free callback parity. That fixture uses page-local in-memory storage and synthetic callbacks; it made no live wallet mutations.

## Live read-only Signet check

The already logged-in account shown as `38a4...e803` was inspected in the production demo at http://127.0.0.1:5173/. Fresh Assets returned two separately selectable `Achievement: Level 1` holdings, each `1 LVL1`, with displayed IDs `1d78a9cc...66460000` and `7de59891...948b0000`.

The second row opened Asset Detail showing `1 LVL1`, Name `Achievement: Level 1`, Ticker `LVL1`, Decimals `0`, and full ID `7de59891e1cdcb9292800aff0597b92e8e01ad95821711fccba6b84744ed948b0000`. Refresh hid the old facts during loading, retained Asset Detail, and successfully returned the same exact holding and metadata.

This task did not mint, transfer, burn, log out, or request/reveal recovery material. The two existing holdings were only read. Live disappearance, provider failure and clipboard failure were covered by isolated fixtures rather than manipulating the live wallet or its providers. Development reloads occurred while other work continued in the shared checkout; the successful live ownership and detail-refresh results above were observed independently of those reloads.
