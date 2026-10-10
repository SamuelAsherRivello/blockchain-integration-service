# Design

## Context

See `proposal.md` for the motivation and behavioral scope. Today, loading is distributed between `BisScreen`, individual collection components, and `usePendingNotice`; the shared state layer clears presentation data when a view is left, so every re-entry generally starts a new read. Account Details has already been made non-modal for balance loading, while Transactions, Receive, Assets, Contracts, and wallet operations retain modal safeguards.

The design must keep provider-neutral state in the integration layer, preserve the existing Arkade adapter boundary, avoid browser persistence for live wallet facts, and prevent late results from crossing account, network, or presentation boundaries.

## Goals / Non-Goals

**Goals:**

- Give every data-backed view a single explicit loading policy.
- Centralize short-lived successful-result reuse without exposing stale or cross-account data.
- Preserve existing modal behavior unless a view explicitly opts out.
- Make automatic and manual reads observable and testable separately.
- Provide a consistent disabled, grey, spinning refresh affordance.

**Non-Goals:**

- Persisting balances, addresses, assets, contracts, or activity in browser storage.
- Adding polling to views that do not already have an independent observer.
- Changing wallet-provider or Arkade SDK semantics.
- Replacing explicit Refresh or mutation safety with cached data.

## Decisions

### 1. Use a provider-neutral view policy

Define a small loading-policy type in the shared UI/state boundary rather than in Arkade adapters:

```ts
type ViewLoadingPolicy = {
  isLoadingAuto: boolean;
  isLoadingModal: boolean;
  isLoadingCached: boolean;
};
```

Defaults are `true`, `false`, and `true`. Route/view declarations may override them. This keeps loading presentation independent from how a provider obtains data and lets the host-facing API remain free of Arkade types.

Alternative considered: continue deriving modal state from scattered `status === 'loading'` checks. Rejected because it cannot express the distinction between a usable Account Details page and a covered Transactions page consistently.

### 2. Keep the cache in the shared state-layer lifecycle

Add an ephemeral cache owned by the BIS context/lifecycle coordinator. Each entry includes the data kind, account profile ID, selected network, complete provider-neutral result, and successful-read timestamp. A single configurable constant provides the initial 15-second TTL.

The cache is consulted only on view entry. A fresh entry is revealed synchronously through state before any new read is scheduled. Explicit Refresh always invalidates and bypasses the entry. Cache writes happen only after the complete read and all existing validation checks succeed.

Alternative considered: put cache state in React components. Rejected because leaving and remounting a component would lose the result, while putting it in browser storage would violate the existing no-persisted-live-balance contract.

### 3. Invalidate by identity, network, and evidence changes

Cache keys include account and network, and lifecycle events invalidate affected kinds on account replacement, network selection, logout, reset, disposal, explicit Refresh, and relevant wallet-observer evidence. Pending reads retain the existing version/generation/abort guards. A late result can neither publish to the view nor enter the cache after its guard is invalid.

### 4. Preserve modal behavior as a view decision

`usePendingNotice` remains the shared modal mechanism, but callers receive the policy result rather than assuming every foreground `loading` state requires coverage. Account Details uses non-modal placeholders; Transactions, Receive, Assets, and Contracts preserve their current modal contract. Background asset/payment/onboarding observations never open the foreground dialog.

### 5. Derive refresh-icon state from the same pending state

All shared refresh-icon buttons continue to disable from their existing pending status. The shared CSS adds a muted disabled color and a rotation animation to `.bis-refresh-image`, with reduced-motion behavior. This covers automatic entry and manual Refresh because both transition the same state status.

### 6. Let BIS own Marketplace inventory preparation

Marketplace inventory is modeled as two independent records keyed by role, wallet profile, network, and data type: Player Wallet and Game Wallet. The page requests those records through BIS-owned preparation APIs. Marketplace maps the provider-neutral returned assets into catalog/equipment cards, but it does not call an Arkade indexer/provider and does not own an inventory cache.

The existing Player Wallet `BisContext.prepareAssetInventory()` remains the shared presentation read used by Account Assets and Marketplace. The Game Wallet BIS object gains an equivalent preparation method backed by the same shared cache/in-flight lifecycle, using its wallet account and public asset-read adapter. `listAssets()` remains the live/mutation-safe operation; preparation is presentation-only and may reuse a complete fresh result.

On Marketplace entry, eligible BIS preparation calls start concurrently. BIS owns the role-scoped `idle`, `loading`, `ready`, `empty`, or `unavailable` lifecycle and joins compatible in-flight work. A source record retains its own timestamp; completion of one source never clears, replaces, or delays the other. The cache is in-memory, identity/network/role/data-type scoped, invalidated by the existing BIS lifecycle, and never duplicated in Marketplace local storage.

The selected Owner tab determines visible loading. If its record is pending, Marketplace shows the loading presentation. If its record is complete, Marketplace renders its items or truthful empty result. If the other wallet is still pending, it does not block the selected tab. Changing tabs only selects the existing record; it does not force a duplicate read or temporarily erase a valid result. Explicit retry remains the only force-refresh path.

The existing two-second Marketplace timeout is removed. A timeout cannot establish that a wallet read is empty. The shared BIS cache is extended to support the Game Wallet's public asset read with the same scoping, freshness, invalidation, and in-flight joining rules used by Player Wallet Assets. The old Marketplace local-storage inventory coordinator is removed or reduced to view state only; it must not cache or fetch wallet inventory independently.

## Risks / Trade-offs

- [Risk] A 15-second cached balance can be briefly stale after an external wallet change. → Explicit Refresh bypasses the cache, and wallet evidence events invalidate affected entries.
- [Risk] A cache key that omits network or account identity could leak facts between contexts. → Require both identity and network in every key and test account/network replacement.
- [Risk] Reusing a cache could skip a view's existing modal error contract. → Cache only complete successes; expired or failed reads follow the view's declared loading and error policy.
- [Risk] Different views may accidentally use different data-kind keys for the same source. → Define shared data-kind constants and test reuse/invalidation at the lifecycle boundary.
- [Risk] Existing specs require fresh reads on every re-entry. → Treat this change's delta specs as authoritative and update affected acceptance tests together.
