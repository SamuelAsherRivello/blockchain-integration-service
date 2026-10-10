# Design

## Context

See [proposal.md](proposal.md) for motivation and proposed scheduling defaults. This is a cross-cutting change across core reads, observation, and page subscriptions, so an explicit design is required.

Observed in the current checkout:

- `state-layer-core/view-cache.ts` holds completed values only. Its default TTL is five minutes; its key contains data type, profile ID, and network.
- `context.ts` gates balance/address reads on `balanceVisible`, and request validity includes page visibility. `update()` cancels these reads on page transitions. Its public `refreshBalance()` also invalidates completed values and is currently called by automatic entry wiring.
- Account Details caches a complete balance/address pair and also stores the individual dependencies. Send reads `getCachedArkBalance()` and otherwise calls `refreshBalance()` through a component-owned retry/subscription path. Swap entry now uses balance and local pending records; operation status and eligibility checks belong to its review/check flow.
- `asset-view-lifecycle.ts` has a separate completed cache and a `read` promise, but it only loads while Assets is visible and resets that work on exit. Public `listAssets()` is independent and also serves equipment and Marketplace.
- Production composition supplies the same `watchActivity` dependency for payment and activity observation. `createSharedWalletObserver` already shares one source and replays its snapshot, but exposes no timestamped one-shot readiness contract. `refreshActivity()` remains pending for the observation lifetime after its first snapshot.
- `walletChanged()` currently invalidates several cached types even for repeated identical snapshots. A warmer must distinguish new evidence from repeated healthy publication to avoid starving its own requests.
- Contracts have multiple projections and filter-dependent caches. The Account list requests `{includeResolved: true, includeOtherNetworks: true}`, while host projections may use narrower filters. `queryAccountContracts` and the controller's query are passive; explicit reconciliation is a separate operation.
- `itemSupportAvailable` means an active account plus Web Locks support. It is a capability check, not proof that inventory is being consumed.

The [archived caching design](../archive/2026-10-10-update-caching/design.md) established the completed cache and loading policies. [Deferred LTO reconciliation](../defer-lto-reconciliation-and-toast-noise/design.md) separates passive projection from explicit provider-backed reconciliation; this change must preserve that boundary.

The existing balance, address, asset, and history adapters use real SDK calls with network validation. Planning has inspected these seams rather than performed new live Signet or Mutinynet acceptance. This design adds scheduling and sharing around existing capabilities; it makes no new claim about provider performance or financial support.

## Goals / Non-Goals

**Goals:**

- Give each compatible provider read one owner, deadline, retry sequence, and result, independently of its page subscribers.
- Share dependencies as well as complete snapshots, so Details preparation also serves Receive, Send, and Swap without forcing all consumers to wait for all fields.
- Make priority changes observable through normal page loading and request-count tests.
- Keep passive warming finite, memory-only, and responsive to foreground demand.

**Non-Goals:**

- Sharing SDK wallet instances, secrets, or requests across contexts, tabs, origins, or networks.
- Caching mutation authorization, broad changes to financial workflows, or changing Marketplace's persisted inventory-cache contract.
- New public game commands, a service worker, speculative navigation, preloading every image, or new background polling.

## Decisions

### 1. Own shared work in a context-level read coordinator

Extend the completed-cache boundary with an internal coordinator, preferably a small `state-layer-core/read-coordinator.ts` module. It owns pending request records containing a normalized key, account generation, per-dependency evidence revisions, abort controller, start/deadline information, retry state, promise, and attached consumers. The pending record is installed before invoking its loader so simultaneous requests deduplicate even when loaders resolve synchronously.

Entry requests use a fresh complete value first, then an eligible pending read, then start a read. A foreground join promotes priority and subscribes to completion; it does not recreate the promise or retry wrapper. Settlement removes only the matching pending record, so an obsolete completion cannot remove its replacement. Failed records are removed and are never successful cached values.

Page consumers carry their own presentation-session guard. Detaching a consumer stops its UI updates without aborting valid context-owned work. Actual account disposal or evidence invalidation aborts affected work and rejects its late cache writes even if a provider ignores cancellation. All listeners and pending records have bounded cleanup.

Alternative: storing a prefetch promise in each React component. It loses ownership on remount and cannot deduplicate work across Details, Send, and Receive. A module-global request map also risks cross-context leakage; ownership stays with each context.

### 2. Share primitive dependencies and compose Details

Use explicit presentation read types for balance, addresses, raw asset holdings, history, and passive contract queries. Keys include profile, selected network, generation, normalized query shape, and the relevant evidence revisions. Contract filter normalization includes resolved records, other-network inclusion, and all existing selection fields; different query coverage is not assumed interchangeable. Begin with exact normalized query matching rather than a general query-superset engine.

Details ensures balance and addresses concurrently. Receive waits for addresses alone; Send and Swap entry wait for the balance snapshot alone. Missing dependencies are added independently, so a balance-only request can be reused without pretending it includes addresses. Completed Details contains the dependency revision vector and uses the oldest successful dependency timestamp for freshness. Joining, projecting, or composing cannot reset TTL. Failed address preparation leaves an independently complete balance usable but does not produce a complete Details entry.

Contract projection freshness and eligibility remain distinct: preserve evidence timestamps and recompute time-based presentation such as expiry from the current clock. A cached `canClaim` or balance never authorizes an action.

Alternative: key only by destination page. That duplicates the same balance read across several pages and makes partial Details preparation hard to reuse safely.

### 3. Keep automatic entry, explicit Refresh, and authoritative operations distinct

Separate automatic entry consumption from the current public refresh methods. Entry must not invalidate a warm value or cancel its pending source. `AccountSend.tsx` should consume a bounded readiness result directly instead of adding another retry sequence and waiting on a potentially missed context notification.

Refresh removes affected completed values, then joins a live request only if its query, generation, and evidence revisions remain eligible. Removing a completed value is not itself new wallet evidence and need not invalidate a still-current live request. If evidence or lifecycle has changed, supersede the old request and start or join the replacement. Review, quote, submission, ownership selection, and financial reconciliation continue through their existing authoritative operation paths rather than a presentation-cache mode.

Each underlying read owns the existing data-specific bounded retry policy. Promotion retains original elapsed time and consumed attempts. Preserve the current foreground policy when extracting a loader, including Transactions' 75-second attempt limit and Assets' 30-second attempt limit; avoid stacking component and coordinator retry wrappers. Consumers may stop waiting or detach without resetting or aborting the shared budget.

Alternative: every Refresh force-aborts any read. That duplicates still-current provider work and breaks adoption when navigation invokes the same method. Always accepting any pending request would instead accept obsolete evidence; eligibility decides.

### 4. Warm once per active lifecycle with foreground priority

Schedule warm-up after successful activation and the initial host render opportunity, outside `readyAsync()`. The scheduler has one speculative job slot; the balance/address pair is one job whose independent dependencies may run concurrently. Use the browser's idle scheduling facility for later jobs with a cancellable nonblocking fallback. Existing mandatory payment/onboarding observers and foreground commands do not wait for this slot.

| Order | Work | Reuse and eligibility |
|---|---|---|
| 1 | Details dependencies | Ensure complete balance and addresses for the active profile; also serves Receive, Send, and Swap entry. |
| 2 | Transactions readiness | Adopt the existing account history source/snapshot; use a bounded one-shot fallback only where composition provides no compatible source. |
| 3 | Passive Contracts | Adopt a matching complete projection or query the account list with its actual coverage; never reconcile. |
| 4 | Assets | Join an existing ownership consumer or schedule a one-shot read after Assets interest in the current session. |

A request for queued data promotes it immediately to foreground work. Pause new speculative provider jobs while explicit wallet work is active or a foreground preparation needs priority. Already-running compatible reads remain adoptable and keep their deadlines; this does not promise that a browser can reprioritize an HTTP request already sent. Skip a failed optional job and proceed to the next. TTL expiry alone schedules nothing. Clear session interest and scheduled callbacks on account generation/network replacement, logout, reset, and disposal.

Existing item or inventory consumption is the Assets signal, not `hasItemSupport()`. Equipment already requests ownership via `listAssets()`; adopt compatible in-flight work through an internal presentation path while preserving live ownership checks for selection. Marketplace remains an external owner of its role-specific inventory cache, and no new Marketplace inventory job is added.

Alternative: start all provider reads during construction or refill them every five minutes. That competes with initial gameplay and performs work with no demonstrated consumer.

### 5. Reuse observers without waiting for their lifetime to end

Give the shared history source timestamped snapshot/readiness access internally. Readiness resolves at the first complete normalized snapshot, while the observer retains its existing account-lifetime owner. Transactions attaches as another consumer; leaving Transactions removes only its foreground subscription. Do not await the source's long-running promise as the completion of an idle scheduler job.

Merge the existing saved send, mint, and boarding journals through the same normalization path used by Transactions. A repeated identical healthy publication must not restart a balance warmer or reset successful-read timestamps merely by replaying a cached source value. New evidence invalidates dependent requests; a newly verified history snapshot can then populate its current revision. Subscription failure retains existing bounded read/polling behavior, without adding a second always-on observer.

Alternative: a separate history prefetch subscription alongside the payment observer. It duplicates provider work and can produce inconsistent row sets.

### 6. Preserve each view's loading and operation boundary

Background-only jobs do not publish page loading flags or open dialogs/toasts. Attaching a visible consumer creates the same pending UI state as a foreground-started request. Completion updates only the currently attached session. Modal entries use the existing first-frame construction gate and brief cached-entry presentation; explicit actions remain immediate. Account Details uses dash placeholders and a disabled spinning Refresh control while pending and applies a completed warm snapshot without a spinner.

| View or flow | Data used | Warming decision |
|---|---|---|
| Account button, chooser, menu, network selector | Existing account/session state | No additional data job. |
| Account Details | Complete balance and addresses | First job; non-modal while pending. |
| Receive | Arkade and Bitcoin addresses | Share address dependency; do not create an invoice. |
| Send | Entry balance | Share balance; recipient, fee, review, and confirm checks stay live. |
| Swap | Entry balance and local pending records | Share balance; eligibility, quote, status checks, and submission retain operation ownership. |
| Transactions list | Full normalized history and local journals | Reuse account source, then bounded preparation if missing. |
| Transaction Detail / Recovery Info | Selected row and matching sanitized records | Derive on demand from the list; no speculative recovery actions. |
| Assets list | All raw positive holdings and metadata | Conditional one-shot ownership preparation. |
| Asset Detail | Selected holding, metadata, provenance | Reuse list data; image/fallback readiness stays in the existing view. |
| Contracts list | Complete account-relevant passive projection | Reuse or prepare matching coverage; no reconciliation. |
| Contract Detail | Selected record, current expiry, evidence | Derive on demand; Check Status and actions remain explicit. |
| Onboarding | Durable progress, live readiness, addresses | Keep its existing worker; reuse compatible presentation inputs without caching completion as authority. |
| Developer | Capability projection | Compute from existing state. |
| Game Wallet Login | Existing wallet state | Keep its owner; create/restore/select remain explicit. |
| Create, Restore, Set Recovery Phrase | User input and private account lifecycle | No speculative job. |
| Get Recovery Phrase | Private recovery read | Explicit only; never pre-read or cache the secret. |
| Logout / Reset | Current local guards and acknowledgements | Explicit only; invalidate shared account work at the existing lifecycle boundary. |
| Marketplace / item detail | Catalog, role-specific inventories, selected item | Marketplace retains its own preparation and cache. |
| Admin panels and preview workflows | Existing host projections and explicit operations | Reuse runtime presentation data where compatible; no speculative mint, reward, payment, or LTO. |
| Prototype Onboarding / Faucet, Integration README | Separate experiment/document lifecycles | Outside the account warmer. |

Alternative: a global startup spinner or using page navigation to execute prefetch. Both couple speculative work to presentation and change the current UX contract.

## Risks / Trade-offs

- [Risk] The old automatic `refreshBalance()` path discards newly warmed data. -> Introduce an explicit entry-consumption path and test provider counts across Details, Receive, Send, and Swap.
- [Risk] A read survives page exit but leaks listeners or affects the wrong account. -> Separate presentation guards from request revisions, bound every read, and test providers that resolve after abort.
- [Risk] Contracts with narrower filters hide records, or cached expiry enables stale actions. -> Match normalized query coverage, retain evidence freshness, derive time-based display again, and preserve authoritative action checks.
- [Risk] A healthy history observer continually invalidates pending warm-up. -> Compare evidence changes, order invalidation before current snapshot publication, and test identical emissions during a deferred read.
- [Risk] Background work competes with onboarding, game readiness, or a financial operation. -> Use one speculative slot, start outside readiness, and pause queued provider jobs around foreground demand.
- [Risk] Adapter overrides provide separate payment/history sources. -> Share only compatible sources and use a bounded readiness read when needed; do not assert production wiring for injected compositions.
- [Risk] The pending queue is mistaken for completed preparation. -> Distinguish queued, pending, ready, and unavailable states internally and test foreground promotion from each state.

## Migration Plan

1. Add the internal coordinator around existing read-only adapter seams and meaningful deferred-promise tests before enabling startup jobs.
2. Move balance/address preparation and page consumers to the coordinator, retaining the completed cache and all live operation boundaries.
3. Connect history readiness, passive contract queries, and conditional raw asset reads; preserve existing observer owners and public live-read semantics.
4. Enable the finite startup scheduler after account activation. Add browser coverage for adoption, normal loading, late results, and explicit Refresh.
5. Run focused suites, workspace typecheck, integration/Admin/Marketplace builds, and the project suite. Record pre-existing or environment failures separately from acceptance evidence.

Rollback removes startup scheduling and routes entry back through its direct read path. No storage migration, wallet cleanup, or change to remote transactions is required.

