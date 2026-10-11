# Proposal

## Why

BIS repeatedly constructs SDK wallets for the same Player and Game identities, paying initialization and ownership-discovery costs that the retained-wallet onboarding prototype avoids on warm reads. Retaining role-scoped wallets should remove that avoidable work without confusing a reusable wallet object with fresh balances, current ownership, or permission to transact.

## What Changes

- Add one private, app-session wallet owner with one Player slot and one optional Game slot. Lazily initialize each eligible role once, share concurrent initialization, and reuse its SDK wallet for reads, observations, and explicitly authorized operations.
- Remove temporary SDK wallet construction from production app-session balance, asset, address, history, funding, sending, boarding, onboarding, and asset-operation paths. Account creation/restoration uses the appropriate role slot rather than an extra verification wallet.
- Keep role identity, network/operator, and session-generation isolation. Navigation, ordinary refresh, and unchanged context notifications must not rebuild wallets or create additional observers.
- Preserve authoritative live reads, bounded retries, cancellation, complete-result validation, current loading/cache policy, and unavailable states. Reusing an SDK object must not turn its internal cached snapshot into evidence of a successful live read.
- Preserve operation locks, reservations, exact input checks, confirmation/consent boundaries, transaction checkpoints, and submitted-operation recovery. Disable SDK automatic settlement; retaining a signer does not authorize background transactions.
- Preserve deliberate local logout: risk checkboxes record understanding, unresolved transactions do not require a settlement wait, and logout does not cancel or complete a network transaction. Existing explicitly requested local cleanup remains distinct from ordinary resource retirement.
- Measure cold initialization separately from warm forced-live reads, cache hits, metadata hydration, and provider waits. Target sub-second healthy warm balance and small asset-list reads, but do not claim a provider-independent latency guarantee or that the reported 3–20 seconds has already been traced end to end.

## Capabilities

### New Capabilities

- `app-wallet-session`: Bounded Player/Game SDK wallet ownership, reuse, lifecycle isolation, freshness evidence, safe operation borrowing, and verifiable elimination of warm-read wallet reconstruction.

### Modified Capabilities

None. Existing balance/asset presentation, ephemeral-cache, observation, network-selection, and transaction requirements remain in force; this change adds a shared resource-lifetime contract rather than redesigning those features.

## Impact

Primary implementation areas are integration's private Arkade adapters, context dependency composition, `BisService` lifecycle, Player/Game controllers, observation ownership, and transaction adapters. Admin and Marketplace must consume the same app-owned dependencies without gaining raw SDK access. Public-address Marketplace reads remain provider-only and do not require another wallet or Game signer. The standalone onboarding prototype remains a comparison baseline, not a replacement architecture.

The test-wallet foundation was committed as `864badf2`. Preserve its direct adapter callers for account creation, live observations, funding receipts, and Swap verification; its separate Node verification lifetime is not an extra wallet inside the browser app. Use protected registered fixtures for verification without copying browser storage, exposing recovery material, or restarting pending onboarding.

No new backend, service worker, SDK upgrade, browser-persisted wallet snapshot, UI redesign, release, or external game-package import is included. Existing network support and encrypted identity storage remain unchanged. Parallel metadata and loading/cache changes must be preserved and reconciled before implementation; their UI/cache-policy differences are not resolved by this proposal.

## Current versus proposed: pros and cons

| State | Pros | Cons |
| --- | --- | --- |
| Current: temporary per-operation SDK wallets | Short-lived signer/resource lifetime; isolated per-call failure flags and hooks; simple final cleanup; live-read safeguards already implemented. | Repeated provider setup and contract discovery; separate read/observer wallet objects; duplicated Player/Game work; cold costs can dominate warm UI actions; no shared lifecycle-level construction budget. |
| Proposed: one retained wallet per active role | Amortized initialization; shared contract knowledge and observation; concurrent consumers share acquisition; no Game initialization for Player-only activity; clearer ownership and measurable warm-read overhead. | Longer in-memory signer/resource lifetime; more careful invalidation and teardown; per-attempt failure tracking required; shared transaction hooks must be isolated; SDK cleanup and unknown submitted outcomes need explicit handling. |

The benefit is less repeated work, not permission to serve stale ownership. Healthy warm reads should approach the prototype's read-only path; first initialization, provider stalls, retries, metadata fan-out, and deliberate settlement may still take longer than one second.
