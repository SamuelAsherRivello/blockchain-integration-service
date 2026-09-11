## Context

See proposal.md for motivation. `context.ts` owns Player Wallet creation, restoration, persistence, profile selection, and activation. `game-wallet.ts` owns an independently encrypted Game Wallet and already compares incoming Game Wallet profile IDs against the current Player Wallet. The public composition order creates the Player context before the Game Wallet, so it cannot yet enforce the reverse comparison or serialize cross-role activation.

Both roles are origin-local Signet accounts. Profile IDs are safe public identifiers; recovery phrases and Arkade account objects must remain within their current private boundaries.

## Goals / Non-Goals

**Goals:**

- Make cross-role profile-ID equality impossible at every accepted Player or Game Wallet activation boundary.
- Preserve the accepted role and persisted selections when the competing login fails.
- Prevent concurrent tabs or asynchronous completions from passing independent preflight checks and committing the same identity to both roles.

**Non-Goals:**

- Do not merge Player and Game Wallet storage, transfer funds, remove retained identities, or automatically repair historical persisted conflicts.
- Do not expose recovery phrases, private keys, Arkade account types, or a new cross-origin/server coordination API.
- Do not change ordinary login, logout, or gameplay behavior for different identities.

## Decisions

### Coordinate through public profile IDs and a single role-selection critical section

Add a private role-separation helper that serializes a compare-and-commit operation for both controllers using an origin-scoped browser lock. Inside the critical section, the candidate profile ID is compared with the other role's current selected profile ID immediately before its durable selection/activation. The helper returns a stable, non-secret conflict result; unavailable coordination fails closed with a safe error rather than accepting a potentially duplicated role.

This uses the browser's existing lock-based coordination model, rather than exchanging account secrets or adding a server. A simple preflight-only comparison was rejected because asynchronous restore, storage, and cross-tab work can change the other role between comparison and persistence.

### Give the Player context a profile-ID-only Game Wallet provider

Extend the internal/public context options with a getter for the currently selected Game Wallet profile ID. Compose it with the existing closure pattern used for the game recipient: `BisGameServices` and the integration demo create the context first, then expose the subsequently created Game Wallet's current public profile ID through the getter. Tests can provide a deterministic provider without Arkade dependencies.

The Player context revalidates this provider in every path that makes a Player identity active: Continue after create, restore before save/activation, saved-profile selection, and hydration/reconciliation. The Game Wallet controller continues to read the active Player profile ID and revalidates it immediately before selecting a restored, created, or externally selected Game Wallet, and again after awaited work before publishing success.

### Reject conflicts without changing either role

On a conflict, the attempted role retains its transient recovery entry/candidate where the existing flow permits it, shows a clear role-specific error, and does not persist, select, activate, or emit a connected event for that identity. The already accepted role remains active. A Game Wallet storage refresh that discovers a legacy conflicting selection reports it as unavailable and performs no deletion or automatic reassignment.

This is safer than logging out or overwriting the other role, and preserves encrypted identity records for an explicit later user choice.

### Test core invariants before UI feedback

Add isolated controller tests covering both ordering directions, role changes while restore/create awaits, saved-profile activation, no connected event or storage write on rejection, and acceptance of distinct IDs. Add the existing browser-host style checks to assert the immediate visible error and unchanged configured state in Player-first and Game-Wallet-first flows.

## Risks / Trade-offs

- [The two controllers are composed in a circular order] → use late-bound profile-ID getters only; do not pass controllers or account objects across the boundary.
- [A storage or restore callback completes after the other role changes] → hold/reacquire the role-selection lock at the durable boundary and verify the same request/selection generation before publishing.
- [Older browser storage already contains the same selected identity in both roles] → surface a safe conflict/unavailable state without deletion; future accepted logins remain protected.
- [Browser locking is unavailable or fails] → fail the attempted role activation with a safe coordination-unavailable error rather than accept duplicate roles.

## Migration Plan

1. Implement the private coordinator and profile-ID-only composition seam with focused unit coverage.
2. Apply guards to Player creation, restoration, saved-profile activation, hydration/reconciliation, and Game Wallet create/import/select/refresh boundaries.
3. Add browser-host coverage and run the relevant integration tests and production build.
4. Deploy as a compatible client-only change. Rollback restores prior login behavior; no schema migration or identity deletion is performed.
