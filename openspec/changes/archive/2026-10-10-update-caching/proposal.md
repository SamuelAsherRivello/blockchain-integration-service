# Proposal

## Why

BIS currently starts a view's data read and its blocking loading dialog in the same render cycle. That can briefly show a newly selected page underneath an overlay before the page has painted, producing an abrupt visual transition. The Send view exposed this first, and the same entry pattern applies to other data-backed account views.

The earlier loading/cache direction needs one refinement before implementation: reads must remain immediate, but the loading dialog should wait for confirmation that the new view has been constructed and completed its first browser frame. A fixed delay is not desirable because it adds arbitrary latency to fast or genuinely slow operations.

## What Changes

- Add a shared view-entry loading gate that starts data reads immediately and reveals a loading dialog only after the new view has mounted and completed its first frame.
- Do not use a fixed 100 ms timer for view-entry loading.
- For modal entry views, show the same construction-gated loading presentation whether the result comes from a fresh read or a valid cache hit; reveal a cached result after that presentation frame without delaying the cache lookup or provider read.
- Apply the entry gate to Receive, Send, Swap, Assets, Contracts, Transactions, and Get Recovery Phrase initial reads.
- Keep Account Details non-modal, preserve nonblocking Onboarding, and leave static views and operations inside already-visible views immediate.
- Add the previously planned short-lived in-memory cache for complete successful view data, scoped by account, network, and data type.
- Use a five-minute freshness window for reusable view snapshots unless a data type declares a stricter safety window.
- Define cache consumers explicitly: entry rendering may use fresh snapshots, while send/transfer/contract actions must revalidate at review or submission boundaries.
- Make explicit Refresh bypass the cache and start its read immediately with the existing loading behavior.
- Invalidate cached data on account, network, logout, reset, disposal, relevant wallet evidence, operation initiation or observation, failed or partial reads, explicit Refresh, and view lifecycle invalidation.
- Treat player balance, receive addresses, assets, contracts, and transactions as separate cache types so an event invalidates only the affected data and dependent summaries.
- Keep cached wallet data in memory only; never persist it to browser storage.
- Preserve shared Pending Operation Dialog error, retry, abort, accessibility, and reduced-motion behavior.
- Give every data-backed view an explicit automatic/modal/cache policy, including Account Details' non-modal placeholder path and the existing modal collection views.
- Keep refresh controls visibly greyed out and spinning while their associated read is active, with reduced-motion support and no change to their accessible labels or disabled semantics.
- Treat complete cached results as presentation data only: review, quote, confirmation, submission, and other spending boundaries must perform live validation.
- Keep non-modal Account Details cache hits immediately usable; the cached-entry presentation rule applies to views whose policy uses modal coverage.
- Cache the complete Account Details balance-and-address snapshot as one entry so reopening Details can render immediately without showing the refresh spinner; explicit Refresh still bypasses it.

## Capabilities

### New Capabilities

- `view-loading-policy`: Shared construction-gated entry loading and ephemeral cache policy for data-backed BIS views.

### Modified Capabilities

- `pending-operation-dialog`: Allow entry loading to be construction-gated without delaying user-triggered operations or violating covered-control semantics.

## Impact

- Affected loading orchestration in `BIS/packages/integration/src/client/ui-layer-react`.
- Affected ephemeral data lifecycle and invalidation in `BIS/packages/integration/src/client/state-layer-core`.
- Affected view-loading, cache, Pending Operation Dialog, and browser fixture tests.
- Affected refresh-icon styling and Account Details placeholder/interaction tests.
- No public wallet-operation API, provider boundary, or persisted storage schema change.
- The Arkade SDK remains the source of fresh data; caching only suppresses redundant foreground reads during the configured freshness window.
