## Context

See proposal.md for motivation. The completed Marketplace/BIS change has already published a package-facing, Arkade-free equipment contract, profile-scoped selections, and chain-provided icon URLs. The separate Stealth & Steel repository vendors that package and must remain playable if the account surface, network, or equipment read is unavailable.

## Goals / Non-Goals

**Goals:**

- Consume only the packaged BIS equipment contract in the game.
- Keep selection/ownership reads asynchronous and snapshot their effective values once per player life.
- Verify the package boundary, live browser behavior, and truthful Marketplace gate without treating a fixture or a server check as a completed Signet/browser run.

**Non-Goals:**

- Add Arkade, wallet recovery data, Marketplace internals, a bundled item-art mapping, or an alternate trade settlement path to the game.
- Change any gameplay mechanic beyond the three approved item effects and their main-menu Items/HUD surfaces.

## Decisions

### Snapshot a public effective loadout at spawn

The game shall obtain only the effective public loadout when spawning a player, convert it into plain movement, outgoing-damage, and incoming-damage modifiers, and retain that snapshot for the life. This avoids a delayed ownership refresh changing a live player's rules. Continuously mutating a spawned actor in response to wallet state is rejected because it conflicts with the required next-spawn boundary.

### Render chain URLs directly with honest fallback

The main-menu Items window and HUD shall use each selected item's supplied icon URL at runtime. A failed image may use an honest unavailable state but shall not substitute catalog-keyed bundled art, ensuring the game renders the same verified identity as BIS and Marketplace.

### Place Items at the main-menu boundary

The game shall remove the Items affordance from Settings and place the existing `Items` label, prefixed by its lightning bolt, directly below Start in the main menu. The menu shall derive its enabled state from the active public player-profile state, without adding player-facing explanation or a separate account prompt. This keeps account-free guest play intact while giving a connected player a clear equipment entry point before starting a run.

### Use a fixed, reference-matched 3-by-3 equipment grid

The Items window shall retain only its existing title and item content plus the exact required body instruction. It shall allocate a fixed three-column by three-row tile region instead of letting the list determine dialog height or scroll. Each occupied tile will be square and reproduce the supplied reference hierarchy: large icon, name and sats price, then Speed, Offense, and Defense values. A selected tile will use a conspicuous high-contrast surface, strong outline, and non-text indicator, rather than adding a textual selected label. This was chosen over a subtle color-only treatment because the current state is too easy to miss, and over new helper copy because no new visible text is permitted.

### Treat verification as cross-project acceptance

Focused tests establish each calculation and UI state; package and browser checks prove the consumer has no private source alias or duplicate React runtime. Signet checks document observed outcomes separately from unavailable or skipped financial actions. A host HTTP response alone is not browser evidence.

## Risks / Trade-offs

- **Wallet or package loading is unavailable** → preserve guest baseline behavior and provide a non-blocking unavailable state.
- **Selected ownership changes during a life** → retain the spawn snapshot until the next spawn, then re-read effective ownership.
- **A chain icon URL fails** → show an honest missing-image state without a bundled fallback.
- **Cross-repository package drift** → record the packed version, hash, consumer lockfile result, and each build/test baseline before browser verification.

## Migration Plan

1. Update the vendored package through the established package workflow and verify a single compatible React runtime.
2. Add the player-gated main-menu Items window, spawn snapshot effects, and HUD slots with focused game tests.
3. Run BIS, Marketplace, package-consumer, and game verification; then collect non-secret browser and Signet evidence.
4. Roll back by reverting the consumer package/artifact and game changes; do not alter saved wallet/profile state or chain assets.
