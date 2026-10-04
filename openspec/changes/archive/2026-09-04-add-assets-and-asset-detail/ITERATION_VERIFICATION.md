# Assets / Transactions iteration — 2026-09-04

The user's explicit follow-up supersedes the original local-icon, no-burn and separate Copy asset details defaults. Account Activity is now Transactions; rows have a bold sats/direction line, status, and shortened ID without an icon. Assets render HTTPS metadata images with fallback. Detail has a one-line full ID and Details with inline metadata Copy. Burn above Back opens the reusable Confirmation / Are you sure? / OK / Cancel modal.

## Automated checks

`npm.cmd run build` passed typechecking and both workspace builds. The existing large-chunk warning remains. `openspec validate add-assets-and-asset-detail --strict` passed.

Node tests used `node --experimental-strip-types --test --test-isolation=none`, with existing global-fixture suites run in separate invocations. All 73 targeted tests passed:

| Suite | Passed |
| --- | ---: |
| burning.test.mjs | 6 |
| asset-presentation.test.mjs | 3 |
| account-assets.test.mjs | 7 |
| assets.test.mjs | 7 |
| send-context.test.mjs | 4 |
| logout.test.mjs | 13 |
| activity.test.mjs | 8 |
| transaction-detail.test.mjs | 5 |
| boarding-recovery.test.mjs | 20 |

Burn tests run the installed SDK's real AssetManager with controlled wallet/provider transport. They verify exact quantities above JavaScript's safe integer range, preservation of other asset outputs, changed-holding/storage/account rejection before submission, completed idempotency, durable pending intent, lost-response and late-after-abort protection, logout pending counts, and shared wallet locks. No live burn was submitted.

## Browser checks

Chrome `/tests/activity-host.html` passed the renamed heading, three-line rows without icons, fixed sizing/scrolling, selection/Back, detailed copying, clipboard failure and empty/unavailable states.

Chrome `/tests/account-assets-host.html` passed exact amounts, metadata image sources, single-line ID/metadata copying, clipboard races/failure, refresh and metadata fallback states, focus/scroll navigation, narrow layouts, Cancel/Escape with zero burn calls, single submission after repeated OK clicks, disabled busy actions, failure retention and successful list refresh. Wallet calls are synthetic. Public HTTPS image requests are real. The browser test caught initial confirmation focus on OK; the component now explicitly focuses Cancel after opening.

## Read-only live preview

At `http://127.0.0.1:5173/`, the existing account `38a4…e803` returned four holdings during the final check: two Level 1 trophies, Level 2 and Level 3, each quantity 1. This differs from the earlier two-holding snapshot because other work continues in the shared checkout/account; this task did not create or remove holdings.

All four metadata image elements loaded successfully, with their respective hosted level-1/2/3-trophy.png URLs and positive natural image dimensions. The existing `7de59891…948b0000` holding opened with the correct real image, quantity, single-line full ID, Details Copy and metadata. The live Confirmation displayed the exact requested words, centered in the runtime preview, with Cancel focused. Cancel was selected; OK was never selected on a live account. Public screenshots of detail and confirmation were retained in the task conversation.

Live destructive burn acceptance is intentionally untested. Unknown submission remains pending and blocks another spend; automatic burn reconciliation is not implemented. The 480px asset card scrolls its content so Burn and Back remain reachable in small hosts.

The final requested text removal hides the live-history unavailable notice when saved operation rows are present. Empty/unavailable feedback for a list without rows remains. `npm.cmd run typecheck` passed after this edit.
