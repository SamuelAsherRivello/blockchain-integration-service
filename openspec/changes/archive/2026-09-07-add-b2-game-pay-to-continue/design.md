## Context

See proposal.md. B1 exposes `requestContinue` and `getContinueStatus`; its durable journal and adapter already distinguish confirmed failures from uncertainty. D7 exposes `showToast`. The game currently reloads from its loss dialog and removes dead player records. Its Account-only BIS root is hidden outside modal visits. Both repositories contain unrelated WIP edits to preserve.

## Goals / Non-Goals

Use public BIS APIs only. Rebuild the player through the shared spawn path while preserving position and loadout; clear only nearby enemy records on success. No private SDK types in the game, new storage schema, pending cancel action, or game-state persistence.

## Decisions

- The continuation controller supplies `icon: 'lightning'` to the shared toast API. The toast renders the same lightning symbol used by payment controls before the text, without an external image request; other notifications retain their current presentation.
- Add a public `getContinuePriceSats()` returning 1000 and a disposable `createBisContinue` controller over the existing B1 methods. Each controller represents one loss in one browser session, allocates fresh operation IDs only for deliberate attempts after definitive failure, and exposes immutable state/subscriptions plus a success callback. Retain B1's general numeric request API for compatibility.
- The controller synchronously marks busy before awaiting submission. Reconcile pending status with a bounded-delay timer, never overlapping requests or resubmitting. Read failures keep pending. Deduplicate success before invoking the toast and callback. Disposal cancels presentation/reconciliation callbacks, not submitted payments. Account identity and original context must match before gameplay delivery.
- Keep one shared BIS context and UI mounted for Account and toast presentation. Outside Account, its host is transparent and pointer-pass-through; Account still owns modal input/focus and pause reasons. Load without blocking game startup. The game reads price from the loaded BIS public API; unavailable/loading services leave Pay disabled without inventing a game-side price.
- Use a dedicated two-button loss menu while retaining the existing win menu. Pending text stays in the loss screen; confirmed failure is accessible there and restores actions. No additional confirmation gesture. The first button uses exact user wording and the BIS amount.
- Keep the defeated player hidden and non-colliding until a confirmed payment. Then dispose its renderer, animation, input, overhead and perception registrations and replace it in its owning spawner. Both level initialization and replacement call `spawnPlayer(row, column, options)`, which builds a fresh full-health actor through the same attachment and spawn-animation path. Options preserve the exact fractional world position and equipped loadout. Reusing the dead sprite is unsafe: Lite infers sprite visibility from its previous rendered dimensions, which the death animation reduces to zero. A guarded state-machine transition returns LEVEL_LOST to LEVEL_PLAYING. Remove enemy records through their owning spawners for full renderer/perception/AI cleanup, selecting cells with absolute row/column differences at most one. Use existing logical cell coordinates, including diagonals, regardless of intervening walls. Sheep, world objects, projectiles, counters, distant enemies and spawner timers remain unchanged.
- Release only the loss pause after cleanup and revival, preserving independent Settings/Account pauses. Every death gets a new opaque context. Reload generates a new session and never enumerates old payments to grant gameplay effects. BIS's normal journal recovery remains available.
- Centralize coordination here, as in smoke-test-bis-to-game; update the game main specs during implementation with a pointer to this change. No unrelated C### change is repurposed.

## Risks / Trade-offs

- Indefinite unknown payment keeps both actions disabled: explicitly chosen by the user. No timeout-to-failure or refund promise.
- Close/reload loses the run and continuation benefit: explicitly accepted. An old payment must never grant a new-run revival.
- Existing in-flight projectiles and normal future spawns can harm the revived player: preserve them under the explicit no-other-state-reset rule; no invulnerability or spawn suppression is added.
- D7 and game artwork/goal work are active: preserve edits and verify the actual packaged combination. Use isolated fixtures for payment edge cases; never imply fixtures are live payment evidence.

## Migration Plan

Add APIs, build and pack BIS, update the game's exact vendor snapshot, and verify both packages. Keep the old package artifact and B1 journal intact. Automated and real-browser fixture checks establish host behavior; record any unperformed live Signet submission separately, without spending an existing wallet just to exercise UI.
