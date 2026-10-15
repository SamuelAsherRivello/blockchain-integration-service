# B2 verification — 2026-09-07

Implemented across BIS and `babylon-lite-stealth-grid`. Payment checks in this change use isolated adapters over the real public BIS controller and rendered UI. No new live Signet payment was submitted for these checks; existing B1 live evidence remains separate.

## Player recreation regression

The original implementation retained the defeated actor and restored its health and transform. Lite derives an existing sprite's visibility from its previous rendered width/height, so dimensions reduced to zero by death can remain hidden even after `_savedSize` returns to its normal value. The earlier browser assertion inspected saved dimensions and was insufficient.

The replacement uses `spawnPlayer(row, column, options)` for both initial population and paid Continue. The old actor is disposed before creation, removing its input, animation, renderer, overhead and perception registrations. The owning spawner replaces the record without resetting its timer or unrelated actors. Exact world position and loadout are preserved; new combat starts at 100 health. The ordinary spawn animation reveals the fresh sprite. Nearby enemy cleanup precedes loss-pause release.

Regression command, run from the game root before and after the implementation:

```powershell
node --test --test-isolation=none STEALTH_STEEL/src/test/gameplay/paid-revival.test.js
```

Before: failed `dead render/input record must be replaced`. After: all three tests pass, including shared factory use, full health, exact position/loadout, old-record disposal, all nine cells, distant entities and guarded transitions. The spawner suite also passes all 18 tests.

## Browser evidence

Final icon follow-up: confirmed-payment toasts use `icon: 'lightning'`. Both browser scripts verify that the visible bolt's right edge is to the left of the message, and the updated game screenshot was inspected. Both scripts pass after refreshing the game's Vite dependency cache. BIS/game production builds and the six toast plus six continuation tests pass with the new package.

Ran `BIS/scripts/smoke-game-continue.mjs` against the actual game at `http://127.0.0.1:5185/` in Chrome. Only browser responses and payment adapters are instrumented; production game files contain no fixture hooks. Passed:

- Logged-out Pay disabled, BIS-owned 1000-sat price, lightning icon and ordered actions.
- Both choices lock while pending; a read error leaves them locked without resubmission; definitive failure permits a new attempt.
- Confirmed success gives one exact toast and one fresh player record, retaining full health, position and equipped loadout.
- Checks actual sprite instance dimensions and opacity after spawn animation, rather than saved dimensions. The screenshot was inspected and the player is visible.
- Cardinal and diagonal neighboring enemies are removed; other actors and independent pause reasons remain intact.
- The recreated player responds to movement. A second death/payment creates another fresh player and exactly one additional success toast.
- Reload starts a new session, 360×640 labels fit, and no page errors occur.

Ran `BIS/scripts/smoke-admin-continue.mjs` against `http://127.0.0.1:5186/tests/continue-host.html`: exact quoted B1 label `"Pay 1000 Sats To Coninue"`, one pending request with repeat-click protection, and one confirmed toast inside Runtime Preview all pass.

Screenshots are in the BIS checkout's ignored `output/playwright/`: `b2-success.png`, `b2-mobile.png`, `b2-logged-out.png`, and `b1-admin-toast.png`.

## Builds and broader checks

- BIS `npm run build`: passed typecheck and both builds.
- Game `npm run build`: passed. Existing bundle-size advisories remain.
- BIS suites: 257 tests across 41 files passed using sequential per-file runs with `--test-force-exit --test-timeout=30000 --test-isolation=none`; the combined runner left a documentation/Vite worker open. Output: `output/playwright/b2-bis-sequential-tests.log`. The six continuation and two Admin tests also passed again after final edits.
- Game `npm test`: 925/926 passed in the final full run. The remaining failure is `Level01 matches the authored scrolling layout and color-three global ids` in `tiled-level.test.js:129`: concurrent Level01 tile edits differ from that test's fixed content hash. This change does not edit the map or relax that assertion. Output: game `output/b2-tests.log`.
- Final game dependency is `bis-integration-0.13.0-b2-icon-688297fb0af6.tgz`, built from the combined BIS source including C6 and the payment-toast lightning logo. Installed and source `core/game-continue.ts` SHA256 both equal `CD791E18CFE71EE23502BB40F627311AEA6FD0C0E8CFAC83B87916A51217C54B`. Concurrent trophy APIs remain included.
- `openspec validate add-b2-game-pay-to-continue --strict`: passed. BIS and scoped game implementation whitespace checks pass. The broader game diff reports existing/concurrent trailing whitespace in `Level01.tmj` and a final blank line in `level-complete-ui.test.js`; these were not changed by the respawn fix. No commits, pushes or archival are part of this implementation.

The unrelated map checksum failure remains a broader-suite limitation. B2's gameplay, controller, UI, browser and production-build checks pass.
