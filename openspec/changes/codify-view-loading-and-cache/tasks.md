# Tasks

## 1. Shared Loading Policy and Cache

- [ ] 1.1 Define the provider-neutral `ViewLoadingPolicy` defaults and per-view declarations; verify every data-backed runtime view has an explicit automatic, modal, and cached policy.
- [ ] 1.2 Add the in-memory cache with the 15-second TTL, account/network/data-kind keys, complete-success-only writes, and explicit Refresh bypass; verify unit tests cover hit, expiry, failed-read exclusion, and cross-account/network isolation.
- [ ] 1.3 Connect account, network, logout, reset, disposal, wallet-evidence, and presentation invalidation to the cache and existing abort/version guards; verify late-result tests cannot publish or cache obsolete data.

## 2. View Loading Integration

- [ ] 2.1 Update Account Details balance entry and refresh to use non-modal placeholders, cache reuse, dash values, and the shared policy; verify Account Details remains interactive during automatic and manual reads.
- [ ] 2.2 Integrate the policy and cache with Transactions, Assets, Receive, and Contracts while preserving each view's existing modal/error behavior; verify each view reuses a fresh result and reloads after expiry.
- [ ] 2.3 Preserve nonblocking onboarding/background observation and modal mutation safeguards while routing foreground reads through the policy; verify no background observer opens a loading dialog or enters an incompatible cache.

## 3. Loading Presentation

- [ ] 3.1 Drive refresh-icon disabled state from the active read status and apply the grey spinning affordance for automatic and manual reads; verify animation stops on success, failure, cancellation, and view exit.
- [ ] 3.2 Preserve reduced-motion behavior and accessibility semantics for disabled refresh controls and modal coverage; verify the relevant UI and CSS tests pass.

## 4. Acceptance and Documentation

- [ ] 4.1 Update Account Details, collection-view, pending-dialog, and loading-policy browser fixtures to cover cache hits, expiry, invalidation, modal/non-modal behavior, dash placeholders, and refresh animation; verify the focused browser checks pass.
- [ ] 4.2 Update durable user-story or loading documentation where the old every-entry-fresh or universal-modal wording remains; verify links and terminology remain consistent.
- [ ] 4.3 Run `npm run typecheck`, the focused loading tests, and the full applicable test command; record any environment-only failures separately from implementation failures.

## 5. Marketplace Dual-Wallet Inventory Loading

- [x] 5.1 Extend the provider-neutral BIS asset preparation/cache lifecycle to expose compatible public inventory preparation for both Player Wallet and Game Wallet, keyed by wallet role, profile identity, network, and data type; preserve complete-success-only caching, invalidation, and in-flight joining. Keep `listAssets()` as the live/mutation-safe operation.
- [x] 5.2 Make Marketplace request both eligible inventories through BIS preparation APIs concurrently, while keeping separate terminal states and results; remove direct provider/indexer reads and Marketplace-owned browser-storage inventory caching.
- [x] 5.3 Remove Marketplace's fixed initial inventory timeout and unconditional tab-change retry. Selected-wallet loading SHALL remain visible until that wallet is ready, empty, or unavailable; tab changes SHALL reuse BIS pending or cached work and SHALL NOT duplicate reads.
- [x] 5.4 Preserve valid displayed inventory while an explicit refresh is pending, and show selected-wallet errors instead of a false empty state when a BIS preparation read fails.
- [ ] 5.5 Add focused BIS/Marketplace tests and Edge Playwright acceptance coverage for Account Assets-to-Marketplace cache reuse, default Game Wallet arrival, Game Wallet completion before Player Wallet, pending Player Wallet tab selection, cached tab switching, duplicate-read prevention, and the verified two-item Player Wallet result.
