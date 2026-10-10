# Design

## Context

Marketplace maintains independent Player Wallet and Game Wallet inventory records. The Player Wallet path is also used by the shared BIS Account UI, but Marketplace can currently retain an empty classified result while Account → Assets has just completed a positive ownership read. The existing inventory cache is role-, wallet-, and network-scoped, so invalidation must preserve isolation and must not clear unrelated Game Wallet data.

## Goals / Non-Goals

**Goals:**

- Make a fresh Player Wallet asset observation visible in Marketplace after the Account Assets flow.
- Ensure empty cached results cannot mask newer positive ownership evidence.
- Preserve independent Game Wallet state and the selected-wallet loading/error behavior.
- Keep the existing public, credential-free Game Wallet lookup and three-second UI loading target.

**Non-Goals:**

- Changing wallet roles, checkout semantics, asset metadata classification rules, or public catalog contents.
- Sharing wallet credentials or raw SDK payloads between UI surfaces.
- Adding a server-side inventory service.

## Decisions

1. **Treat fresh Player Wallet ownership as an invalidation signal.** The shared Player context will expose or emit a safe public freshness signal when Account Assets completes or when the account/network changes. Marketplace will use that signal to bypass the Player Wallet cache and start a new read. This is preferred over clearing all Marketplace storage because Game Wallet data and other wallet identities must remain intact.

2. **Keep cache entries role- and identity-scoped.** The coordinator will invalidate only the Player Wallet entry matching the active profile and network. Game Wallet cache entries remain available and continue to refresh independently.

3. **Do not convert unavailable reads into empty results.** A failed or superseded refresh remains unavailable/loading, while a successful zero-item read remains empty. This preserves the existing truthful-state contract and prevents the reported bug from being hidden as a normal empty inventory.

4. **Use the same classified public item projection in both surfaces.** Marketplace will continue to render only verified marketplace equipment, while the invalidation signal comes from the raw fresh asset read. This separates ownership freshness from loadout-selection persistence.

## Risks / Trade-offs

- [Risk] Account Assets can refresh while Marketplace is unmounted. → Keep invalidation local to the active Marketplace context and rely on wallet/network-scoped cache keys on later mounts.
- [Risk] Multiple account and provider events can trigger duplicate Player reads. → Coalesce or sequence refreshes in the existing coordinator and retain the latest request guard.
- [Risk] A fresh raw asset read may contain generic assets rather than marketplace equipment. → Continue applying the existing strict classifier; only verified equipment appears in Marketplace.
- [Risk] A provider read may exceed the three-second presentation target. → Keep the selected-wallet prompt bounded while retaining an explicit unavailable state and retry path; do not fabricate items.

## Migration Plan

No data migration is required. The implementation will invalidate or bypass affected Player Wallet cache entries using their existing role/profile/network keys. Existing cached Game Wallet entries remain compatible; stale empty Player entries may be ignored on the first refresh after deployment.
