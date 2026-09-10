## Context

See proposal.md for motivation. The completed Marketplace/BIS change has already published a package-facing, Arkade-free equipment contract, profile-scoped selections, and chain-provided icon URLs. The separate Stealth & Steel repository vendors that package and must remain playable if the account surface, network, or equipment read is unavailable.

## Goals / Non-Goals

**Goals:**

- Consume only the packaged BIS equipment contract in the game.
- Keep selection/ownership reads asynchronous and snapshot their effective values once per player life.
- Verify the package boundary, live browser behavior, and truthful Marketplace gate without treating a fixture or a server check as a completed Signet/browser run.

**Non-Goals:**

- Add Arkade, wallet recovery data, Marketplace internals, a bundled item-art mapping, or an alternate trade settlement path to the game.
- Change any gameplay mechanic beyond the three approved item effects and their Settings/HUD surfaces.

## Decisions

### Snapshot a public effective loadout at spawn

The game shall obtain only the effective public loadout when spawning a player, convert it into plain movement, outgoing-damage, and incoming-damage modifiers, and retain that snapshot for the life. This avoids a delayed ownership refresh changing a live player's rules. Continuously mutating a spawned actor in response to wallet state is rejected because it conflicts with the required next-spawn boundary.

### Render chain URLs directly with honest fallback

Settings and the HUD shall use each selected item's supplied icon URL at runtime. A failed image may use an honest unavailable state but shall not substitute catalog-keyed bundled art, ensuring the game renders the same verified identity as BIS and Marketplace.

### Treat verification as cross-project acceptance

Focused tests establish each calculation and UI state; package and browser checks prove the consumer has no private source alias or duplicate React runtime. Signet checks document observed outcomes separately from unavailable or skipped financial actions. A host HTTP response alone is not browser evidence.

## Risks / Trade-offs

- **Wallet or package loading is unavailable** → preserve guest baseline behavior and provide a non-blocking unavailable state.
- **Selected ownership changes during a life** → retain the spawn snapshot until the next spawn, then re-read effective ownership.
- **A chain icon URL fails** → show an honest missing-image state without a bundled fallback.
- **Cross-repository package drift** → record the packed version, hash, consumer lockfile result, and each build/test baseline before browser verification.

## Migration Plan

1. Update the vendored package through the established package workflow and verify a single compatible React runtime.
2. Add Settings Items, spawn snapshot effects, and HUD slots with focused game tests.
3. Run BIS, Marketplace, package-consumer, and game verification; then collect non-secret browser and Signet evidence.
4. Roll back by reverting the consumer package/artifact and game changes; do not alter saved wallet/profile state or chain assets.
