# Proposal

## Why

BIS currently decides loading behavior through scattered component conditions, so users cannot predict whether entering a view will cover it with a modal, show an inline placeholder, or repeat a recently completed read. Account Details exposed this most clearly: a slow but ordinary balance read made the page unusable even though the account identity and actions were already available.

## What Changes

- Introduce a shared per-view loading policy with `isLoadingAuto`, `isLoadingModal`, and `isLoadingCached` settings.
- Make automatic loading on first entry the default, while making modal coverage opt-in and preserving each existing view's intentional modal behavior.
- Keep Account Details non-modal during balance reads, showing its existing placeholders while the read completes.
- Add a global 15-second in-memory freshness window for successful view data by default.
- Reuse a fresh account-, network-, and data-type-scoped result when returning to a view within that window.
- Make explicit Refresh bypass the cache and request fresh data.
- Invalidate cached data on account or network changes, logout/reset, relevant wallet events, failed or partial reads, and other transitions that can change the underlying facts.
- Keep cache data ephemeral and never persist balances, addresses, assets, or activity snapshots to browser storage.
- Make loading icon presentation consistent: disabled refresh icons are visibly muted and spin while their associated read is in progress.

## Capabilities

### New Capabilities

- `view-loading-policy`: Shared loading, modal-coverage, freshness-cache, and invalidation rules for BIS views.

### Modified Capabilities

- `account-balance`: Account Details balance reads become non-modal by default, may reuse a fresh in-memory result, and still bypass the cache on explicit Refresh.
- `account-activity`: Transactions loading retains its existing modal behavior while adopting the shared auto-load and freshness policy.
- `account-assets`: Assets loading retains its existing modal behavior while adopting the shared auto-load and freshness policy.
- `account-address-receiving`: Receive loading retains its existing modal behavior while adopting the shared auto-load and freshness policy.
- `account-contracts`: Contracts loading adopts the shared policy without changing its existing foreground error contract.
- `pending-operation-dialog`: Shared modal coverage becomes an explicit per-view policy rather than an implicit default for every view load.

## Impact

- Affected UI state and loading orchestration in `BIS/packages/integration/src/client/ui-layer-react`.
- Affected balance, activity, asset, address, and contract presentation lifecycles in `BIS/packages/integration/src/client/state-layer-core`.
- Affected refresh-icon styling and loading-state tests.
- No public wallet-operation API or persisted storage schema change is intended.
- The Arkade SDK remains the source of fresh network data; the cache only suppresses redundant reads during the short in-memory freshness window.
