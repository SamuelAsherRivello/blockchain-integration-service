# Design

## Context

See proposal.md for the motivation. BIS already has provider-neutral account lifecycle events and a stable logout restart identifier. The game currently creates its start prompt once and routes logout to a partial progress restart, so account-dependent menu controls can become stale.

## Goals / Non-Goals

**Goals:**

- Preserve the existing `IBisGame.onBisEvent` channel and safe event payloads.
- Make the game's menu lifecycle respond to the current BIS snapshot after login/logout.
- Keep browser refresh ownership in the game, with a refresh only when the game is not already at a safe main-menu boundary.
- Keep logout restart delivery idempotent.

**Non-Goals:**

- No Arkade-specific types or new wallet operations.
- No BIS-owned browser refresh.
- No change to account persistence, logout cleanup, game progress storage, or financial workflows.

## Decisions

1. **Keep the existing event vocabulary.** `accountConnected` and `accountDisconnected` already provide safe login/logout signals, while `restartRequested` remains the authoritative logout completion/restart signal. Adding a second browser messaging channel would create competing sources of truth.

2. **Reconcile from a snapshot, not event payload alone.** The game will use the event as an invalidation signal and read the latest BIS snapshot to determine Items support and player profile state. This avoids treating an event ordering detail as the complete account state.

3. **Rebuild the main-menu prompt through a game-owned lifecycle seam.** The prompt's Items visibility is created-time configuration, so the game will dispose/recreate that prompt when an account event arrives at the main menu. During active gameplay, the game will request a browser refresh so all startup-owned composition is rebuilt consistently.

4. **BIS remains refresh-neutral.** BIS only emits typed notifications. The game decides whether the current location is the main menu and whether a full browser refresh is necessary.

## Risks / Trade-offs

- [Risk] An event may arrive while the game's menu is transitioning → Mitigation: deduplicate restart IDs and coalesce menu rebuilds through the existing game lifecycle.
- [Risk] A full refresh can interrupt gameplay → Mitigation: refresh only outside the main-menu boundary, as required for stale startup composition; main-menu events rebuild in place.
- [Risk] A host callback can fail → Mitigation: retain BIS's existing exception isolation and keep financial/account state independent of notification delivery.

## Migration Plan

1. Add or adjust focused BIS contract assertions without changing event payload compatibility.
2. Update the game adapter and main-menu ownership, then run game unit and browser tests.
3. Verify no BIS source calls browser reload and verify login/logout behavior through Playwright.

