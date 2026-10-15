# Design

## Context

See `proposal.md` for the motivation and scope. The current React runtime registers Pending Operation Dialog notices from layout effects, so a newly mounted data-backed page can register its initial loading state during the same commit that constructs the page. `ViewTransition` already owns the navigable BIS surface, while individual views own their read lifecycles and `usePendingNotice` calls.

The design must keep reads immediate, preserve provider-neutral state boundaries, maintain existing abort/version guards, and avoid persisting balances, addresses, assets, contracts, or activity.

## Goals / Non-Goals

**Goals:**

- Separate data-read start from entry loading-dialog presentation.
- Use actual view construction/first-frame completion instead of a guessed time delay.
- Keep explicit operations immediate and preserve the current modal/error contracts.
- Add short-lived, identity-safe in-memory reuse for complete successful view data.
- Give every data-backed runtime view an auditable automatic, modal, and cache policy, including views that intentionally use inline placeholders rather than a dialog.
- Keep refresh affordances visibly disabled and spinning during active reads, while preserving reduced-motion and accessibility behavior.
- Make cache invalidation and late-result rejection share existing lifecycle guards.

**Non-Goals:**

- Delaying provider or SDK reads.
- Adding a fixed 100 ms or other arbitrary presentation delay.
- Caching failed, partial, unavailable, or secret-bearing data.
- Persisting live wallet data or changing wallet-operation semantics.
- Gating Marketplace bootstrap or background onboarding observations.

## Decisions

### 1. Use a post-construction presentation gate

Each gated view will maintain a presentation-ready signal that becomes true after the destination component has mounted and completed its first browser frame. The read begins before that signal. For modal entry views, the entry presentation remains pending through that first frame even when a complete cache hit is available; the cached result is revealed immediately after the gate. The Pending Operation Dialog receives the conjunction of entry presentation pending and `presentationReady`; an explicit operation supplies its pending state directly.

This removes the arbitrary timer introduced as a temporary Send-only fix while preserving the first-paint result. A layout effect alone is insufficient because it runs before paint; a post-commit effect coordinated with `requestAnimationFrame` provides the first-frame boundary without imposing a human-visible network or cache delay.

Alternative considered: a fixed 100 ms timeout. Rejected because it delays feedback for slow reads and still does not prove that the destination content has painted.

The brief presentation on a modal cache hit is intentional: it makes cached and uncached entry behavior visually consistent with Contracts, while the underlying cached result and any provider read remain immediate.

Alternative considered: delay the read until the view is ready. Rejected because it increases network latency and makes the loader timing affect data readiness.

### 2. Centralize policy at the shared loading boundary

Introduce a provider-neutral view-loading policy describing whether a view auto-loads, uses modal coverage, and may reuse a fresh result. The policy is consumed by the shared view/loading orchestration, while existing components continue to own domain-specific read and error details.

The entry gate applies only to the initial read for the selected account views. Explicit Refresh and mutation operations bypass the gate. Account Details, Onboarding, Marketplace bootstrap, and static/admin surfaces retain their declared exceptions.

Alternative considered: add independent timers or readiness flags to every component. Rejected because it would recreate the current scattered behavior and make exceptions difficult to audit.

### 3. Keep cache ownership in the shared lifecycle

The cache belongs to the BIS context/presentation lifecycle rather than React component state. Each entry includes data type, account profile identity, selected network, complete provider-neutral result, and successful-read timestamp. The default freshness window is five minutes. A data type may choose a shorter window when its safety or freshness requirements justify it.

Cache lookup occurs only on entry. Explicit Refresh invalidates and bypasses the entry. Cache writes occur only after complete validation and only when the request's account, network, generation, and presentation guards still match.

Alternative considered: component-local cache state. Rejected because remounting a view would lose reusable data and leave identity/invalidation policy fragmented.

### 4. Use explicit data types and dependency-aware invalidation

The shared cache tracks balance, receive addresses, assets, contracts, transactions, and other complete view snapshots as separate types. Wallet lifecycle, account/network changes, send/receive/swap or transfer initiation, incoming provider evidence, asset mint/burn/delivery, contract state changes, and transaction-history observations publish invalidation signals. Signals invalidate the directly affected type and any dependent summary; they do not invalidate unrelated data without a dependency.

Cached snapshots are presentation data only. A send, swap/transfer, contract action, or other mutation must perform its authoritative live validation before review confirmation or submission.

Alternative considered: one global cache generation for every event. Rejected because an unrelated asset event would unnecessarily discard balances, addresses, and contract data and would increase provider load.

### 5. Reuse existing abort and modal accessibility behavior

The construction gate must not weaken the existing inert/aria-busy behavior once the Pending Operation Dialog opens. If the read becomes obsolete before the gate opens, the gate is cancelled with the view lifecycle. If a read remains pending after the gate opens, the existing dialog owns focus and covered controls remain inaccessible.

### 6. Keep exceptions explicit

The policy declarations will make the following intentional behavior visible in code and tests: Account Details uses non-modal placeholders; Onboarding observations remain nonblocking; burn and its follow-up refresh use toast feedback; background reconciliation does not cover prepared pages; Marketplace bootstrap keeps its existing immediate shared prompt; and operations inside an already-visible page remain immediate.

### 7. Preserve Account Details usability and refresh affordances

Account Details remains interactive while its balance read is pending. Each unavailable balance identity/value renders a single dash rather than a stale amount, zero, or a blocking dialog. Its Refresh control is disabled during the active bounded read and uses the same muted spinning affordance as collection-view refresh controls. The animation stops on success, failure, cancellation, or view exit, and reduced-motion users retain the muted disabled state without rotation.

Account Details uses a combined complete snapshot containing the balance and the addresses required by its prepared fields. On re-entry, that snapshot is applied without a read or spinner when it is fresh for the same account and network. Explicit Refresh invalidates the combined snapshot and starts the normal live read immediately; a partial address-only or balance-only result is not sufficient for the Details cache.

## Risks / Trade-offs

- [Risk] A very fast read may complete before the dialog appears, reducing loading feedback. → This is intentional; showing a transient overlay for work the user never observes is worse than revealing the ready page directly.
- [Risk] Browser scheduling differences could make “first frame” timing inconsistent. → Use a post-commit frame signal, test the observable ordering, and keep the read independent from the signal.
- [Risk] Cache invalidation could be incomplete after wallet evidence changes. → Key entries by account/network/data type and route all relevant lifecycle and evidence events through one invalidation path.
- [Risk] A stale cache could hide a newly changed external balance. → Keep the freshness window short, invalidate on relevant evidence, and make explicit Refresh authoritative.
- [Risk] A view may accidentally apply the entry gate to a foreground operation. → Separate entry-read state from operation-pending state and add focused tests for both paths.

## Migration Plan

1. Introduce the shared policy and cache lifecycle behind the existing view state/read guards.
2. Replace the Send-only timer with the shared construction gate.
3. Adopt the gate and policy for Receive, Send, Swap, Assets, Contracts, Transactions, and Get Recovery Phrase.
4. Add focused browser and lifecycle tests for first-frame ordering, fast-read suppression, cache isolation, invalidation, explicit refresh, and immediate mutations.
5. Remove the temporary Send-specific gate implementation after the shared path is verified.
6. Add browser/state coverage for Account Details dashes and interaction, refresh affordance lifecycle, policy declarations, complete-result exclusion, and late-result cache guards.

Rollback consists of disabling the construction-gated policy and cache lookup while retaining the existing direct reads and Pending Operation Dialog behavior; no persisted migration is required.

## Verification note

The focused verification for this change passes: `npm run typecheck` and the cache/loading regression suite pass 4/4 tests. `npm run build` also passes for `@bis/integration`, Admin, Marketplace, and the Faucet package. The complete `npm test` run completed with 712 tests, 688 passing and 24 failing. The failures include two local Vite fetch permission errors, one missing Playwright Chromium executable, and existing balance/wallet-subscription/profile harness failures in the concurrently dirty worktree. These limitations keep final task 5.3 open; they are not treated as evidence that the cache/loading-focused checks failed.
