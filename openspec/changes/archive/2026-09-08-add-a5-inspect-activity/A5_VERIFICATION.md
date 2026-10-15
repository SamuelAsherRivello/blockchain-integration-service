# A5 Account Activity verification

## Current acceptance — 2026-09-08

Status: implementation and documentation verified; task 3.3 complete. Task 3.2 remains open for the same-transaction live pending-to-Bitcoin-confirmed transition. Older dated sections below are historical observations, not the current UI contract or current blocker list.

### Current browser and SDK evidence

- Production Chrome at `http://127.0.0.1:5175/` displayed 25 history rows: 24 offchain outgoing records (including asset mint/transfer deltas) and one 289,715-sat incoming Bitcoin record. The list's Copy Transactions action reported Copied all transactions. Transaction Detail showed Confirmed and its recorded UTC timestamp, while correctly reporting the exact confirmation count unavailable.
- Read-only `tests/activity-sdk.html` independently returned those SDK history records with online/live provider state. The boarding transaction `7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8` had `settled: true` and its commitment reference, while the boarding coin snapshot was empty. Together with the inspected SDK boarding-history semantics (settled marks a spent boarding output), this verifies history retention after the coin leaves current UTXOs. The matching record remained visible in production UI.
- SDK timestamps were descending, matching the displayed order. Asset history included exact signed quantities `1` and `-1`. The verification page initially failed to serialize SDK bigint asset amounts; its JSON replacer now emits their exact decimal strings. The retried real SDK read succeeded.
- The current read registered a subscription but observed no new notification. Earlier dated evidence establishes a real utxo notification and automatic pending-history updates. Neither subscription registration nor isolated fixtures are claimed as a new live confirmation transition.
- Application activity reads remain behind `ReadonlyWallet`, `RestArkProvider`, `RestIndexerProvider` and `EsploraProvider` in `src/arkade/activity.ts`; the current SDK's provider performs the underlying transport. No direct application explorer client was introduced. This is source-boundary inspection, not a captured browser network trace.
- No payment, funding, send, settlement, logout, reset or recovery-phrase display was performed for this verification.

### Current UI and automated checks

- `tests/activity-host.html` passed in Chrome using its isolated 360px production-UI mount. Checks covered all 24 export rows, exact `9007199254740993` asset quantity, clipboard failure with complete selectable fallback and retry, empty-copy disabling, three-line rows, fixed compact height, persistent internal list/detail scrollbars, selection/Back, full detail copying, partial-history failures, reopening and account-menu order. These are fixtures only.
- 44 focused Node tests passed across activity, activity-stall, activity-row, transaction-detail, transfer-activity, context and balance suites. They cover snapshot/notification reconciliation, confirmation mapping and updates, spent/outgoing retention, exact signed asset quantities, ordering, late callbacks, cleanup, full reports and Account navigation.
- `npm run build` passed typecheck and both production builds. Vite retained its large-chunk advisory.
- The unrestricted full `npm test -- --test-reporter=dot` run did not complete after several minutes and was interrupted; it is not reported passed. The initial sandbox run failed to spawn Node workers (`EPERM`), so focused tests and builds used the supported escalation.
- Documentation and delta specs now describe Accounts Details > Transactions, Account ID only on Accounts Details, operation/amount-network-ID rows, full direction/status in exports and detail, native compact 384px dialogs, internal scrolling, empty list space and Copy Transactions. A5.01-A5.06 and unrelated capability evidence remain intact.
- The three A5 delta specs were synced to main specs and compared requirement-by-requirement. Strict A5 validation passed; all 24 main specs passed validation; whitespace checks passed. The final documentation build/typecheck passed. No archive was performed because the live transition acceptance gate remains open.

### Remaining acceptance gate

Observe a real Bitcoin deposit as Pending and then Confirmed for the same transaction through the wallet SDK while production Activity remains open. The current saved account has no pending boarding coin, so this run cannot observe that transition. No transaction may be initiated merely to manufacture evidence. This live gate remains unchecked; deterministic confirmation tests and existing confirmed history do not replace it. Syncing the delivered specification does not mark this gate complete or authorize archiving it as fully verified.

## Apply recheck — 2026-09-05

- Read-only Chrome verification at http://127.0.0.1:5173/ opened Account > Transactions for the existing saved account. Loading completed and exposed Refresh Transactions, transaction rows, and Back.
- Live outgoing history is now observed: the list showed one 1,000-sat Outgoing / Settled offchain row and nine zero-sat Outgoing / Settled offchain rows. It also showed a 289,715-sat Incoming / Confirmed row. These are live UI observations, not fixtures. They do not independently establish spent-output retention or a same-transaction pending-to-confirmed transition.
- No payment, funding, settlement, logout, reset, or recovery-phrase access was performed.
- The earlier zero-byte documentation blocker is stale: documentation/User Story Diagrams.md is populated. Its A5 diagram still describes a proposed educational view and needs reconciliation.
- Reconciliation found a controlling-artifact conflict: this change still requires a single text area and Copy-all, while the current AccountActivity component uses three-line rows opening a selected Transaction Detail with its own Copy. Later design-discussion decisions describe row/detail presentation, but the A5 delta and main account-activity minimal-presentation requirement still require Copy-all. The initial-read deadline and loading presentation also have later superseding decisions (75 seconds per attempt and Pending Operation Dialog).
- Tasks 3.2 and 3.3 remain open. Resolve the intended Copy-all contract before reconciling the remaining artifacts; do not treat its absence as an accepted exception. No specs were synced or archived during this recheck.

## Transactions lockup and asset history — 2026-09-04

- Reproduced stalled notification setup blocking the first history read and unresolved wallet disposal blocking error reporting. Regression tests failed before the fix and passed afterward.
- History now starts independently of notifications; polling continues as fallback. SDK requests are bounded, cleanup is nonblocking, and the Core initial-load deadline restores Refresh after 15 seconds while rejecting late updates.
- SDK asset history now retains asset identifiers, mint/receive/transfer labels, and exact quantities. Saved account mint operations supplement history with explicit pending or recorded status; known transaction references deduplicate SDK rows. Missing sats and confirmation remain unknown.
- Production build and all 95 integration tests passed. Five focused regressions cover both stalls, the Core deadline and late callbacks, exact asset quantities, and local mint reconciliation.
- Chrome isolated production UI checks passed: exact asset quantity `9007199254740993`, all 24 rows, Copy-all, clipboard failure, empty/unavailable/retry, Back, reopening, and 360px layout. Asset examples are fixtures, not claims of a live mint.
- Live saved-account Chrome check: loading ended with Refresh and Copy enabled. SDK history was unavailable; the Transactions field retained the saved 1000-sat Arkade-to-Bitcoin registered operation and explicitly stated that live history was unavailable. This verifies recovery from loading, not completion of that transfer. No financial operation was submitted.

Date: 2026-09-03. SDK: @arkade-os/sdk 0.4.67. Implementation is present; live confirmation and outgoing/spent examples remain pending.

## Implemented behavior

- Account Activity immediately below Account Details, opening Account Activity with Account ID above Transactions / Copy and a single read-only text area.
- All SDK-returned history, including incoming/outgoing and spent records, is normalized without filtering to current UTXOs. SDK wallet history has no pagination argument; no additional completeness is claimed beyond its returned records.
- Dated records sort newest first. Undated pending entries precede dated history; other undated entries follow, retaining SDK order. No invented timestamp or output index.
- Bitcoin confirmation comes from boarding coin status or SDK boarding history's block timestamp; history.settled is not used as proof of Bitcoin confirmation. Offchain records use distinct settlement labels. Unknown status remains unavailable.
- ReadonlyWallet, in-memory repositories, SDK providers and subscriptions only. No payments, settlement, direct explorer fetch, or persistent transaction storage.
- Notifications and a 15-second SDK reconciliation read update the open dialog. Freshness errors clear displayed text. Back, logout/reset, account replacement and disposal invalidate callbacks and stop observation.

## Verified

- Production build/typecheck succeeded. Integration Node tests passed, including normalization, ordering, spent/outgoing preservation, outpoint ambiguity, duplicates, observer failure/disposal, late acquisition, stale callbacks and account lifecycle.
- Chrome on http://127.0.0.1:5173/: A5 opens the production Account flow; exact menu placement, title, Account ID, text area, disabled story navigation and Copy success were observed.
- The SDK default explorer (mempool.signet.arkade.sh) returned empty history/coins for the saved account. Activity explicitly configures the SDK EsploraProvider to use mempool.space/signet/api, matching the supplied link. Both explorers reported the same Signet block tip (height 320557, hash 0000000baeae92838e9f40765f6ca7cb174c07ee87c2e3b0509505837a575412), but their mempool observations differed. The production dialog displayed a pending deposit with a real transaction ID and output index. It changed automatically from 403638 sats to 398325 sats and later 390895 sats, with different SDK-reported identifiers, without Refresh or funding actions. These were observations, not fixtures; no reason for the transaction changes is inferred.
- tests/activity-host.html passed in Chrome: 24 fixture lines, a single text area, exact Copy-all contents, clipboard failure, no horizontal card overflow at 360px, unavailable/empty states, Retry, Back and reopening. The host mounts production UI and uses an isolated Core dependency seam; it does not touch saved accounts.
- Existing Account/Details tests passed. No secret values were printed, copied, or included in evidence.

- The read-only SDK verification page, using the same explicit Esplora configuration, returned pending boarding history plus matching coin status and subsequently displayed SDK notification: utxo. This independently verifies live SDK event delivery, not just the reconciliation timer.

## Still pending

- Observe a real pending-to-Bitcoin-confirmed transition through this wallet's SDK.
- Observe real outgoing and spent history in the current saved account. Their mapping/retention is covered by isolated tests; no transactions were initiated to create evidence.

## Apply recheck — 2026-09-03

- The production Chrome Account Activity dialog freshly loaded `289715 sats | Incoming | Confirmed | 7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8:858` for account `38a4…e803`. Refresh and Copy were enabled after loading. This verifies live confirmed-state rendering against the earlier SDK confirmed coin observation; it does not establish that this same transaction's pending-to-confirmed transition was observed while the dialog was open.
- All six activity tests passed, and strict validation of `add-a5-inspect-activity` passed.
- `documentation/User Story Diagrams.md` is currently zero bytes. Its previous A5 synchronization cannot be verified or shipped in this state, so task 3.3 is reopened pending recovery/reconstruction of the intended document. The empty file was left untouched; no missing draft content was guessed.
- No payments, funding, settlement, logout, or reset were initiated. Live transition evidence remains pending, and outgoing/spent live examples remain unavailable in the observed account. The change has not been synced or archived.


The implemented UI is usable now. These pending live checks prevent reporting the entire OpenSpec verification task complete. Earlier A2/A6 storage and A4 funded-balance verification notes remain unchanged.


Loading/Refresh refinement: Account Details shows Loading... in each loading field (including Network while the detail reads are pending). Account Activity shows Loading... inside Transactions and includes a matching Refresh button immediately above Back, disabled during reads. No More Information field or separate loading paragraph is added. Verified all five Details loading values in Chrome.
# Transactions consolidation — 2026-09-08

The separate Pending Operations button/panel is removed. Pending operation summaries merge into Transactions using existing operation/network references; unmatched records remain explicitly pending or Not submitted. Selected details contain reservation/funds information and Check Status, Copy Recovery Details, and eligible unsent draft discard. Compact recovery controls keep Back visible.

Verification: `activity-operations.test.mjs` covers deduplication, exact reference matching, draft status, missing amounts/timestamps and scoped recovery text. `BIS/scripts/check-transaction-recovery.mjs` passed in Chromium against the isolated fixture on localhost:5191, covering menu removal, shared history, selected detail, status checks, draft discard, unknown outcomes, resolution and 360px layout. The existing A5 browser harness also passed. Screenshot: `output/playwright/transaction-recovery.png`.

`npm run build` passed. The full package test run passed 356 tests with `node --test --test-force-exit` (the documentation fixture otherwise left Vite handles alive). Strict OpenSpec validation passed. During editing, an encoding failure truncated context.ts; the local release source and recorded subsequent task edits were used to recover it, followed by typecheck and full regression verification. Concurrent shared-wallet-subscription work was preserved. No live payment was initiated. Existing task 3.2 remains pending for its separate live confirmation-transition evidence.
