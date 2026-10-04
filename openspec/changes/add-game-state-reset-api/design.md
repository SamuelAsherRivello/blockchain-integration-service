## Context

`BisGameServices` already owns the player context, game wallet, LTO/payment controllers, production UI, and disposal order. Player logout is intentionally interactive and protects pending local records; game-wallet logout is separate. A game-owned Clear All Settings action needs a distinct lifecycle operation that coordinates these owners without exposing Arkade types. See proposal.md and the game-state-reset delta for the externally visible contract.

## Goals / Non-Goals

**Goals:**

- Add one public `BisGameServices.resetForGame()` method returning `Promise<BisGameResetResult>` where the result is provider-neutral and contains only local-cleanup status and a non-secret reset identifier.
- Make the operation forceful and confirmation-free when called by the game host.
- Coordinate player storage cleanup, game-wallet deselection/logout, BIS journals, transient controllers, subscriptions, UI presentation, and same-origin contexts under one serialized reset boundary.
- Make reset safe to retry and prevent pre-reset asynchronous work from restoring state.
- Give the demo and consuming-game smoke harness a concrete Clear All Settings integration.

**Non-Goals:**

- Canceling, reversing, or reconciling remote Arkade/network operations as part of the reset.
- Clearing unrelated browser data or game-owned storage from inside BIS.
- Adding a server endpoint, new wallet provider, or mainnet behavior.
- Replacing normal player-facing Log Out, which retains its backup and pending-loss safeguards.

## Decisions

1. **Expose reset on `BisGameServices`, not on `BisContext` or wallet adapters.** The facade is the existing public lifecycle owner and can coordinate all BIS components. Exposing lower-level methods would let a game create partial cleanup and couple it to internal storage. `resetForGame()` is the recommended public API; the game calls it from its own Clear All Settings handler after clearing game-owned settings.

2. **Use a distinct force-reset path rather than calling interactive logout.** Reusing `confirmLogout()` would either require UI acknowledgements or encourage a bypass of logout’s guards. The force path explicitly means local recovery records may be discarded without confirmation. It still reports failure if local deletion cannot be confirmed and never claims a remote transaction was canceled.

3. **Return a result instead of exposing wallet events or Arkade errors.** The result should distinguish `completed` from `failed`, include a non-secret reset ID for host deduplication/diagnostics, and omit profile IDs, phrases, transaction payloads, and provider objects. Existing account-disconnected/restart signaling can be reused internally, but reset completion must be awaitable by the game.

4. **Serialize at the existing browser mutation boundary and use generation/session invalidation.** Reset must wait for or safely fence BIS-owned local mutations, increment the storage generation, clear local records, invalidate controller tokens, stop listeners, and then publish the empty state. Late work checks the new generation before any save or event delivery.

5. **Reset all BIS-owned local journals, including records associated with saved wallets.** The user asked for “any other state” to be cleaned up. The reset therefore includes player/game-wallet journals, continuation/equipment/session state, local demo preferences owned by BIS, and UI/transient state. Remote funds and immutable network history remain outside the cleanup boundary.

6. **Keep host state explicit.** The game owns its settings and gameplay persistence. The integration demo may provide a representative host callback, but BIS SHALL not accept a generic storage-clear callback or enumerate unrelated keys.

## Risks / Trade-offs

- [Risk] A force reset discards local recovery material and journal evidence while a remote operation may still settle → document this in the public API and return local-cleanup status only; do not promise cancellation.
- [Risk] A controller may be mid-SDK call when reset begins → abort/invalidate local observers, fence writes by generation, and preserve enough internal recovery behavior to avoid duplicate network submission.
- [Risk] Multiple live tabs can race to restore or reset state → reuse same-origin coordination and publish one reset identity; every affected context reconciles absence before exposing empty state.
- [Risk] A game may forget to clear its own settings → keep the BIS method narrowly scoped and add a smoke test that asserts the host clears both game-owned and BIS-owned state.
- [Risk] Calling reset after service disposal could hide a lifecycle bug → define it as a rejected provider-neutral failure rather than silently recreating a service.
