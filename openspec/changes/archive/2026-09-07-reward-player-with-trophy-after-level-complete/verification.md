# C6 verification — 2026-09-07

Implemented across BIS and `babylon-lite-stealth-grid`. All eight implementation tasks are complete. X1 remains separate. No commit, deployment or live Signet issuance was performed.

## Automated checks

- BIS `npm run typecheck`: passed.
- BIS `npm run build`: library and Admin production builds passed.
- BIS `node --test BIS/packages/integration/tests/asset*.test.mjs BIS/packages/integration/tests/toast*.test.mjs BIS/packages/integration/tests/game-continue.test.mjs BIS/packages/integration-demo/tests/admin-assets.test.mjs`: 70 passed, 0 failed.
- BIS `node --test --test-force-exit BIS/packages/integration-demo/tests/documentation.test.mjs`: 2 passed, 0 failed. The regular run passed its assertions but retained Vite worker handles; Node's test-force-exit option completed cleanup for the verification rerun.
- Game `npm test`: 922 passed, 0 failed, including progression, Level02 authoring, completion UI, reward flow, paid revival, and existing gameplay tests.
- Game `npm run build`: passed with the two-level catalog and public BIS export.
- `openspec validate reward-player-with-trophy-after-level-complete --strict`: passed.
- Scoped `git diff --check` in both repositories: passed. Existing large-bundle build warnings remain.

## Package provenance

The game consumes `STEALTH_STEEL/vendor/bis-integration-0.13.0-c6-6d3916e0961c.tgz`, produced with `npm pack --workspace @bis/integration --pack-destination .cache --cache .cache/npm --json` after the BIS build. Its SHA-256 is `6d3916e0961c48c48c97fb7fb7318df9d7aec3ebe7bc97748d899e0dafcf267a`. The game manifest and lockfile reference this artifact, which exports `createBisAssetCollection` alongside the existing paid-continue and image-toast APIs. Previous vendor archives were preserved.

## Browser acceptance

Chromium through Playwright CLI, local BIS at `http://127.0.0.1:5174/` and game at `http://127.0.0.1:5175/`. Both development servers returned HTTP 200. Tests used an isolated browser profile and synthetic wallet boundary. The actual menus, shared collection controller, public package integration and toast rendering ran in-browser.

- Admin `/tests/completion-host.html?mode=guest|owned|success|uncertain|error`: all five scenarios passed. Guest/owned collection disabled; pending actions locked; confirmed image toast appeared above the retained menu; uncertain check reused the request; error acknowledgment restored the choices; Continue showed final 2/2 completion and Restart closed the simulation. Production Admin C6 guest entry also passed. Screenshots inspected at 100% preview scale after fixing card bounds and toast stacking.
- Game `/src/test/browser/completion-host.html?mode=guest|owned|success|uncertain|error`: all five scenarios passed through the installed public BIS API, including the Tiny Swords menu, image toast, retained menu, pending locks, acknowledgment and navigation callbacks. The fixture substitutes wallet calls and image delivery only; it does not spend funds. Narrow 390×844 presentation was inspected.
- Actual game Level 1 → Level 2 → Game Completed → Restart passed, with HUD/body parity, final 2/2 fraction, no final Continue, fullscreen entry/exit and mobile layout. For this progression test only, the network response relocated each exit to the player spawn. Authored Level01 was not modified by this task.
- Separately, **unmodified authored Level02** was loaded and played with normal W movement from its player spawn, through all three gold pickups, to the exit. The final menu and HUD both showed `03/03`, and Restart returned to Level 1. No exit relocation or runtime teleport was used for this playability check.

Local evidence is in BIS `.cache`: `c6-demo-success.png`, `c6-demo-guest.png`, `c6-game-success.png`, `c6-game-menu-mobile.png`, `c6-game-level.png`, `c6-game-final-mobile.png`, `c6-level2-playable.png`, and `c6-level2-walk-completed.png`. Browser scripts are `c6-demo-browser.js`, `c6-game-menu-browser.js`, `c6-game-browser.js`, and `c6-walk-level2.js` in the same directory. These are local verification artifacts, not shipped game entries.

## Scope and limitations

Level02 map authoring was explicitly approved after discovering the old template lacked player/goal objects. It reuses terrain and the existing spawner palette, with three gold pickups on a clear route. No new assets or enemies were introduced.

Live wallet issuance, provider response timing and paid network fees were not exercised. Mint success and recovery were verified using synthetic boundaries plus existing wallet API regressions. Ownership matching by exact name/ticker/decimals is the approved demo rule and does not establish trusted issuer provenance. Concurrent unrelated work in both checkouts was preserved.
