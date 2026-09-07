# BIS → game Account smoke test

The game opens the public BIS Account UI from **Settings → ⚡ Account**. Back at the Account root returns to Settings; nested Back stays inside BIS. Guest gameplay does not require an account or a wallet connection. Settings and Account own independent pauses. The game owns browser restart after confirmed logout.

## Windows-local preview

When both checkouts run on Windows, use the same startup commands below and open
[BIS](http://127.0.0.1:5174/) and [game](http://127.0.0.1:5175/) directly. No SSH tunnel
is needed. Production game preview is [port 4175](http://127.0.0.1:4175/).
These local origins are different from the remote tunnel origins 15174/15175; do not
expect an existing account to move between them.

## Remote preview

| Project | Server URL | Windows browser URL |
| --- | --- | --- |
| BIS | http://127.0.0.1:5174/ | http://127.0.0.1:15174/ |
| Game | http://127.0.0.1:5175/ | http://127.0.0.1:15175/ |

Both Windows URLs were confirmed accessible before integration. Port 5173 belongs to an unrelated project; Windows refused a local bind to 5174. Keep the confirmed mapping and hostname consistent. Each browser origin has separate Account storage. Do not copy wallet storage between them.

From the BIS repository root:

```sh
npm run dev --workspace @bis/integration-demo -- --port 5174 --strictPort
```

From the game repository root:

```sh
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Verify each server returns HTTP 200 and the correct HTML title before sharing it:

```sh
curl --fail http://127.0.0.1:5174/
curl --fail http://127.0.0.1:5175/
```

Windows PowerShell: paste each entire command as one line, press Enter, and leave each terminal open. Reuse existing working tunnels.

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:15174:127.0.0.1:5174 contabo-srive
```

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:15175:127.0.0.1:5175 contabo-srive
```

A server HTTP check does not verify the Windows tunnel or rendered game. The game requires WebGPU. Record Windows browser name/version, keyboard/mouse, short portrait and fullscreen observations.

## Build, package and refresh

Use Node 24+ for BIS test suites. Record `node --version`, `npm --version`, `git rev-parse HEAD` and `git status --short` in both repositories. These Git commands are read-only; no commit, push or remote interaction is part of this runbook.

In BIS:

```sh
npm run build
node --test BIS/packages/integration/tests/context.test.mjs BIS/packages/integration/tests/recovery-access.test.mjs BIS/packages/integration/tests/restoration.test.mjs BIS/packages/integration/tests/balance.test.mjs BIS/packages/integration/tests/activity.test.mjs BIS/packages/integration/tests/logout.test.mjs BIS/packages/integration/tests/logout-cleanup.test.mjs BIS/packages/integration/tests/restart.test.mjs
npm pack --workspace @bis/integration --pack-destination /tmp --cache /tmp/bis-smoke-npm-cache --json
```

Inspect the emitted archive file list and confirm `src/index.ts`, `src/ui/overlay.css`, `dist/integration.js` and `dist/integration.css` exist. Inspect only the package's source/build/metadata; never include wallet data. Compute SHA-256 with `sha256sum /tmp/bis-integration-0.12.0.tgz`. Copy it to game `STEALTH_STEEL/vendor/bis-integration-<version>-<first-12-hash-characters>.tgz`, set `@bis/integration` to the relative `file:STEALTH_STEEL/vendor/...` path and install with exact tested React and React DOM 19.2.8 peers. Record the full hash and source changes in the acceptance record. Repack after any BIS source fix; do not claim a newer source was tested against an older snapshot.

In the game, after updating its manifest:

```sh
npm install --no-audit --no-fund
npm ci --no-audit --no-fund
npm ls react react-dom @bis/integration
npm test
npm run test:publish
npm run build
```

The installed artifact must resolve independently of the BIS checkout. Development consumes its public source export; production consumes its built export. Both use the public stylesheet. The game configures automatic JSX in both Vite `esbuild` and `optimizeDeps.esbuildOptions`, required by the development TSX export. There must be one compatible React instance. Library chunks are large; current builds warn but succeed.

## Restart contract

The package now emits `{type:'restartRequested', reason:'logout', logoutId}` after persistent absence and local state invalidation, following `accountDisconnected`. The ID contains no recovery material. Hosts register before enabling actions, deduplicate IDs, and choose their own restart routine. The game injects `restartGame`; the demo supplies its own reload handler. No library fallback reload exists. Normal Back, admin reset, initial empty hydration, cancelled/failed cleanup and disposal do not request restart. A host that omits or throws from its handler remains logged out.

v0.12.0 changes host responsibilities from v0.11.0. Handle restartRequested as documented and mount at 100%: the approved compact size is now native CSS, with no 80% host transform. The user explicitly authorized committing, pushing and releasing BIS v0.12.0 on 2026-09-06.

## Acceptance sequence

1. Run BIS checks and isolated browser navigation fixtures first. Record synthetic results as fixtures.
2. In the game, start guest play, open Settings → Account, enter Restore and Back, then Back to Settings. Confirm focus returns to Account, and closing Settings resumes play without held input or a time jump.
3. Use a **disposable Signet profile on the game origin**. The user privately handles recovery words. Explicitly create, inspect default masking, back up privately, press Continue, reload the same origin and verify the same public profile. Never put words in logs, reports or screenshots.
4. Open Accounts Details → Balance, Refresh and Transactions. Record zero/empty/unavailable truthfully. Use isolated populated fixtures to check detail/copy behavior unavailable in the fresh profile; they do not prove funded history.
5. Visit Assets, Send, Receive and Swap, then Back. Stop before any financial submission. No funding is needed for this smoke test.
6. With no pending transactions, the user confirms production Log Out, observes the game-owned restart and guest gameplay, then restores the same disposable profile privately. Record public profile equality, not recovery words. Do not claim group A complete without this real create → reload → logout → restore loop.
7. Check repeated open/close, keyboard focus, held input, short portrait, fullscreen and teardown. Induced offline/slow failures belong in isolated browser sessions and must retain a Back path.

## Production preview

Build first, then in separate terminals run BIS and game respectively:

```sh
npm run preview --workspace @bis/integration-demo -- --port 4174 --strictPort
```

```sh
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
```

Use a separate PowerShell terminal for these forwards if needed:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:14174:127.0.0.1:4174 -L 127.0.0.1:14175:127.0.0.1:4175 contabo-srive
```

Open http://127.0.0.1:14174/ and http://127.0.0.1:14175/. These are fresh origins; production navigation does not require moving the development wallet. Repeat guest Settings/Account/Back and verify CSS/assets and lack of startup/React errors.

See [acceptance evidence](../../.openspec/changes/smoke-test-bis-to-game/verification.md). Pay-to-continue, revival, achievements and live financial mutations are outside this change.

## Repeat automated browser checks

The game includes `STEALTH_STEEL/src/test/browser/smoke-game-browser.mjs` and `STEALTH_STEEL/src/test/browser/smoke-game-failures.mjs`; BIS includes `BIS/scripts/smoke-restart-storage.mjs`. Install Playwright in a separate test-tools directory and set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path (or use a resolvable local Playwright installation). Set `PLAYWRIGHT_BROWSERS_PATH` to its browser cache. On a Linux headless server, set `SMOKE_CHROMIUM_EXECUTABLE` to full Chromium; these game scripts enable software WebGPU/Vulkan for the test process only. They do not change host graphics settings or game rendering.

From the game root:

```sh
node STEALTH_STEEL/src/test/browser/smoke-game-browser.mjs http://127.0.0.1:5175/
node STEALTH_STEEL/src/test/browser/smoke-game-movement.mjs http://127.0.0.1:5175/
node STEALTH_STEEL/src/test/browser/smoke-game-browser.mjs http://127.0.0.1:4175/
node STEALTH_STEEL/src/test/browser/smoke-game-failures.mjs http://127.0.0.1:4175/
```

From the BIS root:

```sh
node BIS/scripts/smoke-restart-storage.mjs http://127.0.0.1:5174/
node BIS/scripts/smoke-session-cleanup.mjs http://127.0.0.1:5174/
```

Every script opens a fresh browser profile. The storage test uses an explicitly synthetic identity and real IndexedDB/BroadcastChannel; it does not call the wallet SDK or handle real recovery words. Game scripts exercise guest navigation only. Game screenshots go to its ignored `output/playwright/` directory. On Windows, set `SMOKE_CHROMIUM_EXECUTABLE` to the installed full Chrome executable (for example `C:/Program Files/Google/Chrome/Application/chrome.exe`); the bundled headless shell did not start this WebGPU game in the current run. Linux-only software Vulkan flags are conditional on the platform.

### Refreshing a package during an active Vite preview

Vite can retain a previous dependency stylesheet in memory after a local archive install. After updating the game dependency, restart that game's Vite preview (or touch its existing `vite.config.js` to trigger Vite's config restart), then refresh the browser. Confirm the served stylesheet matches the installed package before judging sizing. Keep the same port 5175 / Windows 15175 and existing SSH tunnel.


## Current snapshot and repeatable checks

The game currently consumes `bis-integration-0.12.0-9f8af4c84099.tgz`, not the earlier
published v0.12.0 archive. Its 64-file inventory and SHA-256 are checked by:

```sh
node STEALTH_STEEL/tools/verify-bis-package.mjs
```

Run that command from the game root. Its provenance file is
`STEALTH_STEEL/vendor/BIS_PROVENANCE.md`. The snapshot contains report pagination and
viewport changes absent from BIS baseline `4c5de4e`; do not equate the two builds.
See `current-package-provenance.json` in the coordinating change for the exact differences.

From BIS, run all selected existing synthetic UI fixtures offline:

```sh
node BIS/scripts/smoke-account-fixtures.mjs http://127.0.0.1:5174/
node BIS/scripts/smoke-ui-feedback.mjs
node BIS/scripts/smoke-game-ui-feedback.mjs http://127.0.0.1:5175/
node BIS/scripts/smoke-game-ui-feedback.mjs http://127.0.0.1:4175/
```

The fixture runner serves its metadata icon from the checked-in public asset and blocks
external requests. It exercises recovery, restoration, balance, transactions, assets,
addresses, receive, send, transfer, logout and pending-operation UI using test doubles.
Passing these checks does not substitute for the private live lifecycle or Android test.


### v0.13.0 release update

The source discrepancy recorded above is historical: v0.13.0 reconciles the report
pagination and visible-viewport source, fixes the clipped network header, and guards
pagination against unchanged ResizeObserver notifications. The game release uses the
published 0.13.0 archive, checked by its vendor inventory. Header regression command:
`node BIS/scripts/smoke-account-header.mjs` (synthetic profile only).
