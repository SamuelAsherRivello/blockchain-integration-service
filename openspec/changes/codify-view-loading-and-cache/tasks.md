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
