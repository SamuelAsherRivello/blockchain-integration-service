# Smoke test implementation evidence

## Baseline — 2026-09-06

Task 1.1 is complete. No runtime source or game files were changed during this baseline inspection.

| Item | Observed baseline |
| --- | --- |
| BIS | `c7a33f05de97dbe80444f2dd8ec5b0cbabcfce6e`; clean before this evidence file and task update |
| Game | `/home/srive/Codex/babylon-lite-stealth-grid`, `20600c5b189bae1ed88353625084f009592cbb52`; clean |
| Default runtime | Node `v22.22.2`, npm `10.9.7` |
| Test runtime | `/tmp/bis-ui-node/node_modules/node/bin/node`, `v24.20.0`; existing local installation, no host runtime changes |
| Package | `@bis/integration` `0.11.0`, React/React DOM peers `^19.2.8`, SDK `0.4.67` |
| Public host API | `createBisContext`, `createBisUi`; context readiness, state subscription, Account navigation, event subscription and disposal; UI mount/unmount |
| Current events | `accountConnected`, `accountDisconnected`; no restart request event |
| Current logout | Storage resets persisted data then directly reloads the browser; same-origin logout broadcasts also reload |
| Game Settings/pause | Settings has Music, SFX, FullScreen and Developer Settings; no Account action. Pause controller is a single boolean. |

Inspected production Account labels in `packages/integration/src/ui/client.tsx`: guest `⚡ Create Account` and `⚡ Restore Account`; active `Accounts Details`, `⚡ Send`, `⚡ Receive`, `⚡ Swap`, `Log Out` and `Back`; details submenu `Balance`, `Transactions`, `Assets`; Balance exposes `Get Recovery Phrase`; creation uses `Set Recovery Phrase` and explicit `⚡ Continue`. Recovery values remain private. Source inspection does not constitute browser acceptance.

Baseline drift from design: BIS advanced from `cbdaf2b` / package `0.10.0` to the revision and version above; the game baseline is unchanged. The UI consolidation has landed. The proposal/design specify host-owned restart after logout, but the delta spec and tasks still require the earlier reload contract. The design explicitly says not to apply those older tasks as written. The broad project brief remains an early-slice description; current Account source and later confirmed decisions provide the behavior baseline.

## Commands and results

| Command | Result | Scope |
| --- | --- | --- |
| `npm run build` | PASS, exit 0 | Typecheck, integration library and demo production builds; existing large-chunk warning, no build failure; default Node 22 runtime |
| `/tmp/bis-ui-node/node_modules/node/bin/node --test packages/integration/tests/context.test.mjs packages/integration/tests/recovery-access.test.mjs packages/integration/tests/restoration.test.mjs packages/integration/tests/balance.test.mjs packages/integration/tests/activity.test.mjs packages/integration/tests/logout.test.mjs packages/integration/tests/logout-cleanup.test.mjs` | PASS, exit 0; seven test files passed, zero failed | Isolated existing Account context/creation, recovery, restoration, balance, activity and logout tests under Node 24.20.0 |

At the initial baseline, task 1.2 remained incomplete because the BIS browser navigation baseline had not yet been performed. The later integration evidence below supersedes this baseline status. No historical browser fixture failure has been retested or resolved here. At that point no package snapshot had been produced or installed in the game, and game tests and live/manual Windows acceptance had not run. No live account creation, logout, restoration, wallet storage inspection or financial operations were performed.

## Previous implementation pause (resolved)

Before the user authorized finishing the integration, the invoked apply skill required pausing when implementation extends beyond the current spec/tasks. Before runtime edits, reconcile those artifacts with design decision 5: confirmed cleanup and memory invalidation before `restartRequested`, logout identity and duplicate/stale same-origin handling, explicit game/demo restart handlers, failure isolation, and a non-reloading host fixture. No implementation task is complete merely because planning files exist or CLI state is `ready`.


## Integration implementation — 2026-09-06

The user authorized finishing the integration smoke test. Planning artifacts were reconciled with host-owned restart and the confirmed Windows ports. Both repositories now contain implementation edits; no Git staging, commit, remote interaction or policy relaxation occurred.

### Implemented behavior

- BIS emits `restartRequested` only after confirmed absence and context invalidation, following `accountDisconnected`. Events carry a non-secret logout ID. The library has no browser reload fallback; the demo and game implement their own restart handlers.
- Storage retains only a generation/receipt after logout, removes the receipt on save, and reconciles other tabs under a queued browser lock. A receiving-tab session cleanup failure suppresses restart until successful retry. Stale notifications cannot clear a replacement profile. Unrelated web storage is preserved.
- Game Settings has ⚡ Account, using an asynchronous public-package adapter and public CSS. Guest startup is independent. Loading failures/timeouts retain Back. Initialization is cached; disposed work cannot mount; root Back returns focus to Settings, while nested Back stays within BIS.
- Settings and Account have independent pause reasons. Start/loss legacy pauses remain intact. The host makes inactive controls inert, contains focus, stops gameplay keyboard/pointer propagation, and deduplicates restart IDs.
- Game Vite uses automatic JSX for TSX development exports and dependency optimization. The first actual consumer check exposed `React is not defined`; this was fixed and development/production navigation were then verified.

### Automated evidence

| Check | Observed result | Attribution |
| --- | --- | --- |
| BIS `npm run build` | PASS, typecheck + both production builds; large-chunk warning only | Final restart implementation |
| Node 24 Account suites | PASS: context, recovery-access, restoration, balance, activity, logout, logout-cleanup, restart (8 test files) | Isolated tests; no live financial evidence |
| Game `npm test` | PASS: 799 tests, zero failures | Includes adapter disposal/failure/deduplication and owned pause tests |
| Game `npm run test:publish` | PASS: 7 tests | Publishing regression only; nothing published |
| Game `npm run build` | PASS; large-chunk warning only | Public built JS/CSS export |
| Clean consumer `npm ci` | PASS from copied game manifest, lockfile and vendor only; one React/React DOM 19.2.8 instance | No dependency on BIS sibling checkout |
| Development game browser | PASS: Start, Settings/Account, Create/Restore entry, nested Back, root Back to Settings with Account focus, narrow layout, no page errors | Fresh headless Chromium profile; no account creation |
| Production game browser | PASS: same navigation plus unchanged coordinates under gameplay keys, Tab containment, fullscreen and 360×400 Back | Fresh headless Chromium with software WebGPU/Vulkan |
| Production import failure and slow import | PASS: guest startup, bounded unavailable state, Back and close to gameplay, no late reopen | Induced isolated package failures |
| Real IndexedDB/BroadcastChannel | PASS: confirmed absence, invalidation before restart, matching IDs, duplicate/stale protection, fresh context, unrelated storage | Synthetic identity in fresh browser; no SDK wallet creation |
| Receiving-tab cleanup failure | PASS: no restart while session cleanup fails; retry confirms cleanup then emits disconnect/restart once | Synthetic identity; isolated prototype fault injection |
| BIS browser fixtures | PASS: recovery, restoration, balance, activity/detail/copy, activity recovery, assets, logout, addresses, Send, Receive, Transfer, pending operations | Existing isolated fixtures, including populated/error data; no live submission |

Initial headless-shell attempts could not render WebGPU textures. Full Chromium with software Vulkan/WebGPU started the simulation and displayed the DOM UI, enabling the interaction checks above; its screenshots do not establish terrain/character rendering (see the follow-up audit below). these test-process flags do not change the game or Windows graphics. Windows visual/gameplay acceptance remains separate. One old game source assertion expected no-argument Settings pause calls; it was updated for named ownership and covered by a new behavioral test. No known baseline fixture failure remains in the suites exercised here.

### Acceptance matrix

| Case | Expected result | Current evidence / status |
| --- | --- | --- |
| A1 guest entry | Settings opens real Create/Restore without automatic account work | PASS automated dev/production; Windows after integration pending |
| A2 create + Continue | User privately backs up a disposable Signet profile and explicitly persists it | NOT RUN live; existing isolated creation/recovery tests pass |
| A2 reload persistence | Same game origin reload retains the public profile | NOT RUN live |
| A3 restore | User privately restores the same disposable profile | NOT RUN live; isolated restoration fixture passes |
| A4 Balance/Refresh | Truthful values/zero/unavailable and refreshing behavior | PASS populated/zero/error fixtures; live game profile not yet created |
| A5 Transactions/detail/copy | Truthful list/empty/error and complete detail/copy | PASS populated/empty/error fixtures; live game read pending |
| A6 confirmed logout | Cleanup → restartRequested → game-owned restart; guest play afterward | PASS core/storage/adapter fixtures; live Windows loop pending |
| Recovery masking/copy | Default masking; user-managed private backup/copy | PASS isolated UI fixtures; live user interaction pending |
| Assets | Existing list/detail/Back remains available | PASS isolated populated UI fixture; live navigation pending |
| Send | Existing entry/review/Back and guards retained | PASS isolated fixture; no live send |
| Receive | Existing addresses/copy/Back retained | PASS isolated fixture; no live receiving/funding |
| Swap/Account Transfer | Existing entry/Back and guards retained | PASS isolated fixture; no live swap/transfer |
| Package dev/production | Exact snapshot resolves public code/CSS and one React | PASS automated; exact artifact in package-provenance.json and game vendor/BIS_PROVENANCE.md |
| Guest independence | Game starts without account/package readiness | PASS real guest browser and induced package failures |
| Pause/input/focus | Modal owns input, no movement or intermediate resume; focus restored | PASS unit + headless browser; Windows keyboard/mouse visual confirmation pending |
| Narrow/fullscreen | Controls and Back remain reachable | PASS headless 360×640, 360×400 and fullscreen; Windows confirmation pending |
| Duplicate open/disposal | One session; no late reopening or leaked subscriptions | PASS adapter tests and repeated browser navigation |
| Stale/duplicate logout | No replacement-profile clearing or duplicate host restart | PASS real-storage synthetic browser + core/adapter tests |
| Server/tunnel availability | Correct HTML and reachable Windows URLs | Both Windows URLs confirmed before integration; updated Windows Account flow pending |
| Full live A2 → reload → A6 → A3 | Same disposable public profile and playable game throughout | NOT RUN; mandatory before reporting all group A smoke acceptance complete |

### Remaining user-assisted acceptance

Use Windows game http://127.0.0.1:15175/ with the existing tunnel. Confirm Start → Settings → ⚡ Account → Back → close Settings and playable rendering/input, including narrow/fullscreen, and record browser name/version. Then complete the disposable Signet create/Continue/reload/logout/restore loop with recovery words handled privately. Do not send recovery words or screenshots containing them. Record only public profile equality and observed success/empty/unavailable outcomes. No funded balance/history, payments, revival or achievement gameplay is claimed.


### Final snapshot and review

Final game artifact: `bis-integration-0.11.0-653348b4f705.tgz`, SHA-256 `653348b4f70592e4d64652676316fa546feaa66850843aa9c44315bf063057d8`. Archive source/build bytes were compared to the current BIS files; package-provenance.json records every archive file hash. The final snapshot passed a fresh `/tmp/bis-smoke-final-consumer` install and repeated real game development/production browser checks using the checked-in game smoke script.

Both dev servers (5174/5175) and production previews (4174/4175) returned HTTP 200 and the appropriate Demo/Game HTML title after the final build. Windows uses 15174/15175. Server availability does not replace updated Windows interaction confirmation.

Strict OpenSpec validation and both repository whitespace checks passed. Changes remain uncommitted. Game regression source is in `test/ui/bis-account.test.js` and `test/ui/pause-controller.test.js`; browser scripts are in game `scripts/smoke-game-browser.mjs` and `scripts/smoke-game-failures.mjs`. BIS real-storage scripts are `scripts/smoke-restart-storage.mjs` and `scripts/smoke-session-cleanup.mjs`. Node 24 test runtime remains `/tmp/bis-ui-node/node_modules/node/bin/node`. Test browser: Google Chrome for Testing 153.0.8010.12 from the Playwright cache, using process-local software WebGPU/Vulkan for game rendering. Windows browser/version remains unreported.

Headless guest screenshots: [desktop Account](screenshots/game-guest-account.png), [narrow Account](screenshots/game-guest-account-narrow.png). These contain no live account or recovery material. BIS production guest Account → Restore → Back also passed with no page errors.


### Follow-up acceptance audit — guest movement and rendering

The prior goal turn made implementation and verification progress. This audit found that the retained navigation check observed stationary coordinates under Account but did not assert movement before/after the menu. Added game `scripts/smoke-game-movement.mjs` and ran the equivalent browser check against the development game in a fresh profile:

- PASS: initial public position `(224,224)` changed to `(301,224)` under ArrowRight before opening menus.
- PASS: a key held while opening Settings/Account produced no movement during the pause.
- PASS: releasing the key during Account and closing both menus did not replay held input.
- PASS: fresh movement input changed position after closing Settings. No browser console errors were observed.

Visual limitation: the headless software WebGPU screenshot shows a black game canvas behind the DOM HUD. An isolated response-only diagnostic omitted the Account factory/hookup, its CSS import and its pagehide cleanup without changing served source files. The same black canvas remained and movement still reached `(301,224)`. This does not establish an Account regression, but it also does not prove Windows terrain/character rendering. Task 3.3 therefore remains incomplete pending Windows observation. No game rendering implementation was changed to accommodate the headless environment.

The remaining five tasks still require Windows visual/input observations and/or the user-managed disposable live account lifecycle. No such results have been received, and the full smoke goal remains unproven. The additional tests do not substitute for the A2 → reload → A6 → A3 live loop.


## Follow-up account UI checkpoint (2026-09-06)

- User evidence: the game is visible and Account opens; logout refresh is observed and accepted. This does not complete the full create/reload/logout/restore live loop.
- Current package: `bis-integration-0.11.0-a7fe627a3e89.tgz`, SHA-256 `a7fe627a3e8985896a78dfa717b777b403b7b918c80172df06d47e0a00490313`. It supersedes the earlier snapshot for preview testing. Exact 62-file inventory is in package-provenance.json. Both public development source and production output are included.
- UI: one-line seed warning; Account ID/full copy only on Accounts Details; prominent game-owned BIS-styled Account button; body/fullscreen host above controls; 55% black full-screen backdrop; no initial loading placeholder. Existing logout refresh preserved.
- Temporary game embed is 80%; permanent global CSS sizing remains unapproved. Warning-only measurements showed restore overflow at 360 × 640 and 393 × 700. At 80%, setup, saved recovery, restore and Account fit at 743 × 1321, 360 × 640 and 393 × 700 in synthetic fixtures. Account ID copy matches the complete synthetic public ID and is absent from Balance and other tested screens.
- `scripts/smoke-ui-feedback.mjs`: PASS for those sizes and ID checks. Uses a private test seam with synthetic identity and no live wallet creation.
- `scripts/smoke-game-ui-feedback.mjs`: production PASS at 743 × 1321, 1000 × 900, 360 × 640 and 393 × 700 for full-viewport backdrop geometry, elementFromPoint ownership above virtual controls/viewport edges, restore fit and no page/dialog scrolling. Delayed first import exposes no loading status. Fullscreen entry/exit reparents the host correctly. No page errors. Screenshot `screenshots/ui-feedback-restore.png` contains empty word fields only.
- Existing game browser navigation: development PASS for Settings/Account/Back, keyboard pause, focus trap/return, nested Back and fullscreen; no page errors.
- BIS browser regressions: recovery-host, restore-host, balance-host, activity-host, account-assets-host and receive-host PASS. Balance and Activity assertions were updated for the intentional Account ID relocation; their prior expectations no longer applied.
- BIS typecheck and complete build PASS. Game build PASS (existing bundle-size advisory only). Game `npm test` PASS: 107 test files, zero failures in this runner.
- Remaining: user review of the 80% trial; full all-screen/error-state fit and elimination of long transaction/manual-copy report scrolling; actual Windows/Android acceptance and Android software-keyboard policy. Transactions and Assets list scrolling remains intact. Tasks 6.1, 6.2 and 6.5 intentionally stay open where they require those checks.
- Separate `make-bis-handle-multiple-game-titles` proposal saved as draft only with unresolved questions; no multi-game code or Intents integration added.


## v0.12.0 native-size release candidate

The user approved the 80% preview and requested permanent CSS sizing, release and game update. Native 100% UI now replaces the temporary embed. Six synthetic screens (setup, saved recovery, restore, Account, Accounts Details, Balance) were compared at 743 × 1321, 360 × 640 and 393 × 700; maximum measured geometry difference is 3.97px. The fixture no longer injects a scale transform. SVG icons, pending/confirmation dialogs and text fitting use native compact values too.

BIS complete build and eight focused Node 24 account/lifecycle test files pass. Ten affected browser fixtures pass, including confirmation, pending/error states, Send and Transfer. The Transactions test now asserts the new native 384px card height. Game build and 107 test files pass against `bis-integration-0.12.0-1bb8fa852c24.tgz`; full SHA-256 `1bb8fa852c24d1fd54872448c00097401fb4b93e7db94e56d7e9c50d8dc4854d`. Production game fit, backdrop and top-layer checks pass at four viewports; the fullscreen test now awaits fullscreenchange after exit before checking parent placement, avoiding a browser event timing race.

This release does not complete the entire smoke test: long transaction/manual-copy reports still scroll, the full user-assisted create/reload/logout/restore loop is not recorded, and actual Android/keyboard acceptance remains open. Multi-game support stays an unstarted draft. Intents is outside this release.


## Published v0.12.0 delivery

- Release commit: `2fd181d81507a14202e0a311e18604903db18c4f`, pushed to BIS main using the approved Samuel Asher Rivello identity.
- Published release: https://github.com/SamuelAsherRivello/blockchain-integration-service/releases/tag/v0.12.0 with the integration archive and SHA256SUMS attached.
- GitHub Pages deployment for that commit: successful run https://github.com/SamuelAsherRivello/blockchain-integration-service/actions/runs/34031559847.
- Downloaded the published release archive, checked SHA256SUMS and confirmed byte-for-byte equality with the tested candidate before copying it into game vendor. Installed game dependency is 0.12.0. All 62 package files match the release source/build inventory.
- Production browser checks fully pass, including native transform:none, four viewport sizes, silent first opening, input-blocking backdrop, topmost control ownership, fullscreen and no page errors. The fullscreen exit assertion waits for its asynchronous browser event.
- The user-facing game preview remains http://127.0.0.1:15175/ (remote 5175); BIS remains http://127.0.0.1:15174/ (remote 5174). GitHub release publication does not publish or commit the sibling game repository; its tested dependency and host changes are present locally.

Assessment: release delivery and approved compact sizing are complete. Do not archive the smoke test yet. Remaining acceptance is the complete game-origin create/persist/logout/restore loop, actual Android/keyboard behavior, and eliminating the remaining long-report scrolling. Intents and multi-game support are not smoke-test gates.

Final development-preview check initially detected Vite serving the previous 320px stylesheet from memory despite the installed package containing the new 256px card. Touching the existing game vite.config.js triggered Vite's supported restart without changing configuration contents. The stylesheet then returned HTTP 200 with native v0.12.0 values; all four development viewport checks, silent initialization, native transform:none and fullscreen transitions passed. Current layout screenshot: `screenshots/game-native-size.png` (empty restore fields; no wallet secrets). This headless image verifies Account layout, not terrain rendering; the user has separately confirmed visible gameplay.
