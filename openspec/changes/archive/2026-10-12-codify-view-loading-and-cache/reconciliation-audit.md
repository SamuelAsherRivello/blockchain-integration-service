# Requirement reconciliation audit — 2026-10-11

Audit-only scope assigned by Coordinate active channel tasks. No production
files or task checkboxes changed. Current progress remains 4/16 checked.

## Later decisions and source evidence

The 15-second freshness and immediate/no-modal-cache-hit presentation in this
open change are superseded by the archived `2026-10-10-update-caching` proposal,
design, tasks, and deltas, committed in `60dbb766`. That change explicitly
requires five-minute freshness, first-frame construction-gated modal entry,
and live validation at spending boundaries. Its task 5.4 explicitly reconciles
the stopped `codify-view-loading-and-cache` acceptance cases; all 20 tasks are
checked. Current `openspec/specs/view-loading-policy/spec.md` requires five
minutes too. Thus `view-cache.ts`'s `5 * 60_000` is consistent with the later
tracked decision, not evidence that production should revert to 15 seconds.

The archived `2026-10-10-background-caching` change further changes presentation
exit into detaching from account-owned shared work, adds finite warming and
read coordination, and preserves five-minute complete-result caching. Its
checked tasks cover compatible reads, late-result guards, timestamp preservation,
foreground adoption, and silent background failures. It supersedes older
blanket wording that every view exit must cancel all underlying shared work.

Read `c fix items` (`01a126a8-bca7-71d1-a42f-d457e5fb23a8`) before relying on its
handoff. It finalized metadata/loading repair in `726e176a`, with 34 focused
checks, build/typecheck, and main-spec validation reported passing. Its repair
addresses required-field navigation and explicit forced inventory refresh;
it does not itself establish all older live acceptance scenarios.

## Task-by-task map

| Old task | Current evidence / remaining reconciliation |
| --- | --- |
| 1.1 Policy declarations | `ui-layer-react/view-loading.ts` defines defaults and explicit per-view policies; update-caching 1.3 is checked; focused policy test passes. Reconcile older proposal wording rather than implement another policy. |
| 1.2 Cache/15s TTL | Five-minute later decision above; `view-cache.ts` and focused tests cover identity/network/type keys, expiry, complete-only writes and invalidation. Original literal 15s cannot be checked as delivered. |
| 1.3 Invalidation/late results | `read-coordinator.ts`, view cache, and archived background-caching sections1–4 cover generation/dependency invalidation, abort, late-result and replacement ownership. Focused coordinator tests pass. Exact lifecycle semantics changed to shared ownership; update old wording first. |
| 2.1 Details | update-caching 2.4,4.4,5.6 and background-caching section2 cover combined balance/address snapshot, dashes, usable nonmodal Details and explicit Refresh. Current guest browser verification is not a funded Details test; reuse exact archived/browser evidence in a separate finalization step. |
| 2.2 Collections/Receive | update-caching section3 and background-caching sections2–4 cover these consumers. Five-minute caching and modal cache-hit entry supersede original 15s/no-dialog assertions. |
| 2.3 Background/mutations | background-caching sections4–5 and loading policy preserve background-only errors, finite scheduling, explicit mutation validation and modal safeguards. No new implementation identified by this audit. |
| 3.1 Refresh animation | update-caching4.3 and shared CSS policy tests cover muted disabled animation and stopping on terminal/cancellation paths; archived acceptance must be linked during reconciliation. |
| 3.2 Accessibility/reduced motion | view-loading policy tests and shared overlay CSS preserve reduced motion and modal coverage. Browser/keyboard evidence should be reused only for matching scenarios. |
| 4.1 Browser fixtures | update-caching5.1,5.4–5.6 and background-caching6.1 explicitly cover these old cases with revised semantics. No duplicate browser/full suite started during release. |
| 4.2 Documentation | update-caching5.2 and background-caching documentation tasks are checked; current policy main spec is five-minute. Older open deltas and some Marketplace main-spec text still contradict the implementation; do not sync stale deltas verbatim. |
| 4.3 Verification | Fresh audit command: view-cache, view-loading, read-coordinator, Marketplace inventory-cache suites: 18/18 pass. Release21 root full test/build commands exited0; current ongoing runner work needs its own final integrated gate. |
| 5.1 BIS preparation (already checked) | Player uses `prepareAssetInventory`; shared raw asset lifecycle exists. Game/public-address lane needs the boundary audit below; existing checkbox is not conclusive evidence of full contract delivery. |
| 5.2 Marketplace APIs (already checked) | Current `App.tsx` imports `readPublicInventory`; its public-address Game lane uses this directly, and `inventory-layer/inventory.ts` imports `RestIndexerProvider`/`ArkAddress` from the SDK. This does not meet the literal no-direct-provider requirement. Do not remove guest/public browsing while relocating that boundary without an approved design. |
| 5.3 Independent loading (already checked) | Per-role coordinator and selected-owner computation exist; focused independent-results tests pass. Current bounded read becomes unavailable, not falsely empty. Existing one-second loading affordance settling timer must be distinguished from the prohibited empty-result timeout. |
| 5.4 Retain/error state (already checked) | Coordinator preserves prior items on explicit refresh, distinct terminal states and force semantics; focused tests pass. |
| 5.5 Edge/live acceptance | Unchecked. Requires exact cross-surface cache reuse, both completion orders, pending tab selection, duplicate counts and verified two-item Player result. Guest browser checks and synthetic coordinator tests do not satisfy all of this live requirement. Coordinate with current wallet/Marketplace owners. |

## Actual uncovered decisions and owner boundaries

1. Reconcile this stopped plan against the later five-minute/construction-gated
   and background-sharing decisions before changing tasks/deltas or archiving.
   No product TTL change is warranted from the old plan alone.
2. Resolve the public-address Game inventory API boundary. Player preparation
   already delegates to BIS; the public Game lane remains Marketplace-owned SDK
   work. New `Fix marketplace loading and wallet` chat owns Marketplace changes;
   coordinator must assign any BIS public API implementation separately.
3. Reconcile main `marketplace-inventory-cache` spec's older thirty-second
   `localStorage` requirement with its later BIS-owned memory requirements and
   actual in-memory coordinator. Do not introduce another persisted cache to
   satisfy the stale paragraph. The orphan top-level change directories with
   `spec.md` also need planning-home provenance review.
4. Obtain matching exact browser/live evidence for 5.5 from current owners;
   do not replace a two-item live ownership result with guest or mocked output.

## Verification

`node --test BIS/packages/integration/tests/client/view-cache.test.mjs
BIS/packages/integration/tests/client/view-loading.test.mjs
BIS/packages/integration/tests/client/read-coordinator.test.mjs
BIS/packages/marketplace/tests/client/inventory-cache.test.mjs`

Result: 18 tests passed, zero failures. Log:
`output/reports/openspec-backlog/cache-tests.log`.

No financial action, wallet-state change, new server, full-suite duplication,
provider-support claim, or task closure resulted from this audit.
