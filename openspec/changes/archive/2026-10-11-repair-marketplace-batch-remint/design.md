# Design

## Context

See proposal.md for the failure. MarketplacePanel passes fixed v3 IDs; mintWalletAsset intentionally returns succeeded journals without reissuing. C.G.3 retains mint records after burning. The current classifier and SDK transport tests accept the old v3 assets' structured metadata. Public Signet details show their supply is zero. Marketplace currently reads the published catalog address rather than the connected Game address.

## Goals / Non-Goals

Goals: restore the mint/burn/remint lifecycle, preserve uncertain-operation recovery, and prove selected-wallet Marketplace visibility with registered disposable test accounts.

Non-goals: clearing journals, changing generic mint idempotency, new metadata schemas, TTL changes, personal browser attachment, broad wallet refactoring, publishing.

## Decisions

1. Add a BIS-owned preparation function taking public profile/network and base mint requests. Read validated scoped mint journals, choose the greatest known generation (legacy base is generation zero), and retain it for partial/pending batches. Only a complete succeeded generation with all nine fresh asset supplies exactly zero advances to the next deterministic suffix. No random per-click IDs or hardcoded v4 bump. No mint or signing happens in preparation.
2. Public supply reads belong to the Arkade layer; generation selection belongs to provider-neutral core. Return prepared requests to Admin; do not expose secret account data or raw storage. Reject corrupt history, incomplete/unreadable supply, and stale account/network results. Record generation through existing per-item mint intents before submission. Concurrent preparation yields identical IDs; existing wallet mutation guards and journal idempotency prevent duplicates.
3. Reconcile existing pending intent first using its exact request, including older generations; no pending operation may be replaced. Never treat a transferred asset or a failed listing as a burned asset. A completed generation with positive supply retains its IDs and ordinary verification behavior. Partial-burn replacement remains blocked.
4. Preserve mint status in diagnostics: already-minted plus failed verification is historical/preflight, not a new submitted transaction. Successful verification still uses live classified ownership, not returned journal assets.
5. Prefer the active Game Wallet session address for Marketplace inventory when eligible; preserve current public guest browsing through the registered address. Do not modify the published catalog. Use existing inventory coordinator and invalidation.

## Risks / Trade-offs

- Missing old local journals cannot identify a historical generation; preserve existing recovery limits and never erase evidence to repair it.
- Supply failures must stop generation advancement; bounded provider reads and explicit unavailable errors prevent false burn claims.
- An interrupted generation may remain incomplete after intentional destruction of only some items; report this instead of automatically replenishing traded or burned partial batches.
- Test-wallet grants are limited to registered owned fixtures; use the encrypted runner without secret output, screenshots during recovery, or personal profiles.

## Migration Plan

Legacy base v3 requests remain generation zero. Future remints append a validated numeric generation suffix. No journal migration/deletion or schema change. Rollback must retain generated requests and journals; old UI cannot resume new generations safely, so restore the fix rather than deleting records. Production release is separate.
