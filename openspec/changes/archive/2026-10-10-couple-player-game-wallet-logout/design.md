# Design

## Context

The Player context and Game Wallet controller use separate browser storage and lifecycle objects. Player logout currently resets the Player account but does not deselect the Game Wallet, while Marketplace can derive an inventory address from the registered catalog address when a Player is present but no Game Wallet session is active. This allows a retained Game Wallet to reappear after a later Player-only login and allows public catalog configuration to look like authentication.

## Goals / Non-Goals

**Goals:**

- Make Player logout synchronously invalidate and completely clear the active game-facing Game Wallet session.
- Remove encrypted Game Wallet identities and all Game Wallet-owned browser records so no old wallet can be restored or associated with a later Player login.
- Make Marketplace wallet display, inventory reads, cached items, and game actions depend on both active wallet roles.
- Preserve public catalog browsing and require a fresh explicit Game Wallet import after either wallet logs out.

**Non-Goals:**

- Changing wallet encryption or the published catalog contract.
- Removing the published catalog Game Wallet address from catalog metadata.
- Changing the independent Game Wallet logout control or Admin wallet import flow beyond the shared Player logout boundary.

## Decisions

1. **Purge rather than deselect on Game Wallet logout.** The Game Wallet storage logout operation clears the selected pointer and every retained encrypted identity in the network-scoped IndexedDB. It also clears Game Wallet-owned local/session storage records, marketplace checkout recovery records, and Game Wallet inventory caches. This prevents a future refresh from rehydrating an old wallet.

2. **Use the Player logout transaction boundary.** The Player context invokes the Game Wallet cleanup callback before committing Player removal and treats failure as logout failure. The successful Player disconnection event is emitted only after both local wallet cleanups are confirmed. The service keeps the event bridge idempotent for cross-context reconciliation.

3. **Separate active session address from catalog address.** Marketplace may keep the catalog address for public metadata and browse configuration, but its active Game Wallet address must come only from the Game Wallet controller state and only when both wallet roles are active. The catalog address must not be used as the authenticated inventory source or wallet-strip value.

4. **Scope cached results by both identities.** Inventory source keys and visible-item derivation must require the current Player identity and Game Wallet identity. On either logout, prior Game Wallet items and in-flight reads become non-current; Player Wallet inventory remains independently usable.

5. **Test both controller and browser boundaries.** Integration tests will verify complete purge, Player-only isolation for Game logout, and no restoration after reload. Marketplace tests will verify the Player-only state, source construction, cache invalidation, and pending-checkout cleanup. Playwright will exercise the Account logout flow, reload, and Player-only login sequence against the running Marketplace.

## Risks / Trade-offs

- [Risk] A Game Wallet logout failure could leave the old selected identity available. → Mitigation: purge storage before publishing success, make Player logout fail visibly until the purge is confirmed, and cover retry behavior in focused tests.
- [Risk] Existing Admin flows rely on retained identities. → Mitigation: make the new behavior explicit: logout is a destructive local-session boundary and later Admin use requires a fresh import.
- [Risk] A late inventory response could repopulate stale items. → Mitigation: abort or invalidate reads and require both current wallet identities in source keys and render guards.
