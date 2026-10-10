# Background caching verification

## Implementation

Account activation schedules finite, context-owned preparation after a render opportunity: balance/addresses, missing Transactions, passive Contracts, then demand-eligible Assets. One speculative job runs at a time. Foreground preparation bypasses the queue, promotes matching pending work, and preserves its original retry/deadline budget. Explicit context and LTO operations pause new speculative jobs.

The coordinator keys reads by account, network, lifecycle generation, normalized query coverage, and dependency revisions. Page exit detaches presentation rather than cancelling valid work. Lifecycle/evidence invalidation aborts ownership, rejects late writes, and cannot let old completion delete its replacement. Refresh bypasses matching completed values but joins eligible pending work. Failed foreground preparation cannot receive additional automatic retries from a queued warmer.

Details composes current balance/address entries with their revision vector and oldest timestamp. Each primitive remains independently usable; an address failure cannot hide a valid Send balance or produce complete Details. Transactions readiness resolves on the first account-source snapshot rather than its lifetime. Repeated identical observations preserve timestamps and pending work. Asset presentation shares inventory demand while authoritative listing/selection remains live. Contract filters retain exact coverage and expiry is projected against the current clock; warming never reconciles or submits.

## Automated evidence

| Acceptance area | Evidence |
| --- | --- |
| One owner, simultaneous joins, Refresh eligibility, bounded retries, retained second-attempt deadline, late replacement cleanup | `read-coordinator.test.mjs` |
| Five-minute freshness, complete empty results, incomplete exclusion, dependency isolation, account/network isolation, oldest Details timestamp | `read-coordinator.test.mjs`, `view-cache.test.mjs` |
| Single speculative slot, declared order, pause/resume, cancellation, optional failure continuation, conditional demand, no refill | `background-cache.test.mjs`, `background-context.test.mjs` |
| Activation outside readiness, guest/missing network, navigation/reentry, partial dependencies, silent background failure, replacement isolation | `background-context.test.mjs` |
| Details non-modal placeholders/spinner, completed warm entry without spinner, Receive/Send/Swap modal adoption with exactly one balance and address call | `background-cache-browser.test.mjs` with isolated deferred browser adapters |
| Full history, signed quantities, retained source, first readiness, unavailable versus empty, 75-second attempts, polling fallback | `activity.test.mjs`, `activity-stall.test.mjs`, `wallet-subscription.test.mjs` |
| Assets reentry/demand sharing, visible-only output watch, 30-second attempts, independent public listing and fresh equipment selection | `background-context.test.mjs`, `account-assets.test.mjs`, `asset-observation.test.mjs`, equipment/action suites |
| Filter normalization/full coverage/expiry, passive financial boundary, explicit financial behavior and facade delivery | `background-contracts.test.mjs`, LTO/contract suites, `bis-facade.test.mjs` |
| Send/Swap quotes, confirmation, reservation/recovery integrity and operation refresh | Send, continuation, transfer-resolution, asset action and wallet suites |

Focused coordinator/scheduler/context/contract checks: **21 passed**, including external financial-owner priority and restoring invalidated visible Details. The browser adoption fixture passed using installed Chrome. Production `npm run build` passed, including workspace typechecking and Integration, Admin, Marketplace, and Faucet builds. Existing large-chunk warnings remain warnings. The integration README is approximately 625 words with working relative links. Strict OpenSpec validation passed.

Ignored logs are under `output/reports/background-caching/`: `focused-final.log`, `browser-final.log`, `build-final.log`, `npm-test-final.log`, and `marketplace-recheck.log`. Earlier logs retain sandbox/browser environment failures separately: sandbox loopback access was denied and the default bundled Playwright browser was unavailable. Installed Chrome plus approved unsandboxed local HTTP execution allowed those checks to run; no browser installation or funded account was used.

## Shared-checkout regression note

An earlier complete run passed all 741 tests. The final run, including the added external-owner regression, reports **741 passed / 742 total**, with one unrelated source-text assertion in `BIS/packages/marketplace/tests/client/catalog.test.mjs`: it expects `Loading...`, while the concurrently edited application uses `Loading ...`. The corresponding pending-prompt test was updated by its owner and passes in isolation. These Marketplace application/test edits are preserved, not rewritten as part of background caching. The final full-suite and Marketplace recheck logs retain the failure separately from cache acceptance.

## Live acceptance boundary

These are fixture-backed coordination and UI checks, not new live Signet/Mutinynet acceptance. Existing SDK/network validation and authoritative operation paths remain in place; no live payment, mint, burn, claim, refund, or recovery operation was initiated. A separately authorized live smoke session can confirm real-provider hydration/adoption on each configured network and existing review/confirmation checks. Funded transaction acceptance must not be inferred from these fixtures.

No commit, push, release, storage migration, or change archive was performed. Unrelated shared-checkout edits were preserved.
