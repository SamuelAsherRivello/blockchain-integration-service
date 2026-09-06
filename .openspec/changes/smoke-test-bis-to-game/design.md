## Context

See proposal.md for the confirmed scope. Discovery baseline on 2026-09-06: BIS `cbdaf2b`, game `20600c5`; both working trees were clean before this change. These are local baselines, not a claim that the game matches its current remote. No fetch is required for planning.

| Repository | Observed integration points |
| --- | --- |
| BIS | `packages/integration/src/index.ts` exports `createBisContext` and `createBisUi`; context exposes `ready`, `getState`, `subscribe`, `openAccountDialog`, `closeAccount`, and `dispose`. UI exposes `mount`/`unmount`; no React host application is required. |
| BIS package | `@bis/integration` 0.10.0 is private, with React/React DOM peers `^19.2.8`; SDK is 0.4.67. Exports select source TS/CSS in development and built JS/CSS otherwise. `files` includes `src` and `dist`. Vite library build externalizes React. |
| Game | JavaScript, Babylon Lite, Vite 7; no BIS or React dependency. `src/main.js` creates Settings and the pause controller and owns pagehide cleanup. `src/bootstrap.js` wraps startup in a preloader. |
| Game UI | `src/ui/settings-ui.js` exposes open/close and pauses/resumes directly. `game-window.js` moves focus and creates modal layers. `pause-controller.js` is a single boolean, with input suppression and frame-time reset callbacks. `gameUi`, `domBody`, and `domScreen` are existing host layers. |
| Game gameplay | Loss currently reloads through `level-complete-ui.js`; no revival transition exists. This change does not touch it. |
| BIS logout | `core/account-storage.ts` directly reloads the browser after local cleanup and on a same-origin logout broadcast. `BisEvent` currently includes only accountConnected/accountDisconnected. These reload calls must become host-owned behavior. |

Existing specs and documents are not uniformly current. BIS's broad brief/config still contains early-slice statements, while the current package implements the full Account menu. Use current A1–A6 implementations and later confirmed decisions as the behavior baseline, including Set/Get Recovery Phrase default masking, Balance, Transactions, Assets, Send/Receive/Swap and Log Out. Preserve pending-operation restrictions. Do not use this host test to close historical funded-balance, spent-history or confirmation-transition evidence gaps.

The game has its own `openspec/` root and permanent C###/C###-T### conventions. This BIS-owned cross-project change is the coordination source; do not copy BIS artifacts into that root or allocate a duplicate change during this proposal. During a future authorized implementation, reconcile the game's existing `game-settings-menu` and `gameplay-pause` requirements for the new Account route; if a game-local change record is necessary, allocate IDs using its existing convention and link it to this change. Current authorization is planning only; implementation in either project requires a new user request, and writes to the sibling game require the environment's supported filesystem escalation.

## Goals / Non-Goals

**Goals:** Exercise the actual public package outside its workspace, preserve one BIS session per game lifetime, prove Account/game modal coexistence and host-owned logout restart, and provide reproducible A1–A6 evidence.

**Non-Goals:** Converting the game to React, duplicating wallet screens, changing financial operations or logout clearing guards, using BIS Admin APIs in the game, cross-origin wallet synchronization, game payment/revival logic, or adding new Signet capabilities. Logout restart ownership is the explicitly approved lifecycle change. No live service feasibility is asserted by this planning scan; existing evidence is historical and live availability is checked during the smoke run.

## Decisions

### 1. Handoff a built package snapshot

The user selected a fixed package snapshot rather than a live sibling link. Complete the restart-contract change below before producing the final smoke-test artifact.

Build BIS first, then `npm pack --workspace @bis/integration --pack-destination <artifact-directory>`. Inspect the packed file list; include only package sources/build output/metadata and no wallet data. Record the source commit, dirty diff if any, package version and tarball SHA-256. Use a version/hash-named tarball under the game's `vendor/` with a relative `file:` dependency, retaining the artifact with the eventual source delivery so `npm ci` does not depend on an absolute server path. The existing private flag prevents publishing; registry publication is not needed.

Install React and React DOM matching the tested BIS versions in the game and update its lockfile. Consume only `@bis/integration` and `@bis/integration/style.css`. Development currently resolves packaged source; production resolves `dist`, so validate both modes. A successful sibling-workspace demo alone does not prove the packed package works. Repack and update provenance after any BIS fix; never test an old tarball and report a newer source revision.

Alternative: `npm link` or direct sibling-source aliases. Rejected for this smoke test because they obscure package completeness, can duplicate React, and require local filesystem topology. No remote package URL, registry account or published release is needed.

### 2. Mount one production Account root behind a thin game adapter

Add `src/integration/bis-account.js` in the game, owning package loading, context/UI creation, subscription, a positioned Account host and cleanup. Add ⚡ Account to `settings-ui.js` via a host callback; the game supplies the Settings button rather than calling `showAccountButton` and creating a second floating button. On activation, call the public Account entry, not a private subpage or a simplified account implementation.

Keep package loading and hydration off the critical game-start path. The adapter can cache the import promise and initialize on first Account activation. Show a bounded host loading/unavailable state with a way back; a failure must not reject `gameReady` or trap the player. Preserve a successful context across menu visits; ordinary close is not logout/reset. Ignore late initialization after adapter disposal, and unmount/unsubscribe/dispose on pagehide or explicit host replacement.

Alternative: embed the BIS demo in an iframe. Rejected because it adds Admin UI, separate navigation and storage and would not verify direct public-package consumption by the game.

### 3. Coordinate modal ownership explicitly

Settings → Account → Settings is the normal route. Opening Account temporarily suspends Settings interaction and transfers focus; Back at the Account root restores Settings and focuses ⚡ Account. Back inside BIS remains BIS-owned navigation. Closing Settings then resumes gameplay only if no other pause owner remains. The adapter observes the public `view` transition from `account` to `empty` to detect root dismissal; it must not infer dismissal from a nested heading or asset/detail route.

The current boolean pause controller is insufficient for stacked ownership. Extend it compatibly with named pause reasons (or equivalent acquired/released tokens), preserving existing no-argument call sites while migrating Settings and BIS to independent owners. Start prompt, death/loss and other existing pauses must remain active when BIS closes. Account acquisition must precede any Settings release; prevent a one-frame resume during transition. Clear held keyboard/touch/virtual-controller actions and retain the existing frame-time reset on the final resume.

Mount BIS inside the visible game frame with scoped geometry and deliberate layer order, respecting fullscreen. Only the active modal may receive pointer or keyboard input; keep the game canvas rendered while paused. Ensure hidden Settings cannot steal focus, and restore focus only after its controls are available. Escape/close must follow existing BIS rules and must not dismiss an operation or logout confirmation by bypassing its controls. Narrow/short screens must retain scrollable actions. Do not globally restyle `.bis-*` internals to match the game's theme.

Alternative: call `pause()` before Account and `resume()` on every Back. Rejected because it resumes beneath Settings, start or loss screens and cannot distinguish nested account navigation.

### 4. Keep origins explicit

Use BIS `http://localhost:5173/` and game `http://localhost:5174/` consistently. These are different browser origins; the game will not automatically see the BIS demo's wallet. `127.0.0.1` is also a different hostname from `localhost`. Do not switch hostnames mid-test and mistake the empty account for data loss.

Create a disposable profile on the game origin. The user handles recovery words privately for restoration; do not transfer IndexedDB/localStorage, expose a phrase to the adapter, or copy secrets into logs/screenshots. After confirmed cleanup BIS requests restart; the game chooses and executes its own restart routine as described below. Verify game startup and logged-out Account afterward. Use no pending transactions for this manual lifecycle test and retain existing guards for other profiles.

### 5. BIS requests restart; the host performs it

Confirmed user decision: BIS tells the game to restart, and the game owns its restart logic, which may refresh the browser. Remove direct `window.location.reload()` from integration storage and same-origin broadcast handling. Do not retain a hidden library fallback reload. This is a refinement needed for the Account host boundary, not a general gameplay restart/revival feature.

Extend the existing public event surface with a proposed `restartRequested` event carrying `reason: 'logout'` and a non-secret logout request identity. Preserve existing accountDisconnected semantics rather than overloading every disconnection into restart. Emit the restart request only after confirmed persistent cleanup and local account/session invalidation. Emit no request on cancelled, rejected, uncertain or failed cleanup, ordinary close, disposal, initial no-account hydration or administrative reset. Register the host listener before Account actions become available.

Invalidate outstanding reads/work and release BIS-held account/SDK references independently of host restart. Clearing must not depend on the host refreshing to erase in-memory identity. The account remains logged out if the handler is absent, delayed or throws; report host-handler failure separately from storage failure and do not retry destructive cleanup or restore the cleared identity. A late handler or outstanding Account initialization must not resurrect the old UI/session.

Carry the logout identity through same-origin notification. Each affected live context confirms cleanup, invalidates its state and emits at most once for that logout; disposed consumers emit nothing. Hosts deduplicate by logout identity across multiple mounted contexts, so one host restart is scheduled per logout even if it hears multiple notifications. A stale broadcast must not clear or restart a subsequently activated different profile. Use a non-reloading host fixture to prove cleanup, event ordering, duplicate protection and fresh context creation without page refresh.

The game adapter invokes an injected game-owned `restartGame` callback. For this smoke slice, the game can use its existing browser-refresh approach, but only game code makes that call. A stubbed callback test verifies BIS requests restart without reloading directly and that the game owns execution. Normal Account Back returns to Settings; successful logout takes the restart route and must not briefly restore Settings or resume play before the host handles it.

The BIS demo also subscribes and implements its own reload, preserving the demo's visible behavior while moving responsibility out of the library. Update public usage examples, plain-host fixtures and compatibility documentation together. Recommend a package version bump appropriate to the repository's pre-1.0 release practice when delivering this changed host responsibility; the snapshot hash still identifies the exact tested artifact.

Alternative: accept a callback that BIS itself uses to reload by default. Rejected because it leaves restart control in BIS when a consumer omits the callback and weakens the explicit host contract.

### 6. Test BIS first, then the real game

Create `documentation/SMOKE_TEST_BIS_TO_GAME.md` in BIS during implementation and link it from the game README. Include this ordered runbook:

1. Record both revisions/dirty status, Node/npm versions, package artifact hash, browser/version and origins. Use Node 24+ as documented by BIS; this session's sandbox default was Node 22, so verify the runtime before executing suites.
2. Run BIS checks/build, start BIS with `npm run dev --workspace @bis/integration-demo -- --port 5173 --strictPort`, and verify HTTP 200 plus demo HTML. Inspect A1–A6 menu navigation before packing; no automatic account creation or financial operations.
3. Pack/install the snapshot and peers in the game. Run game tests/build. Start game with `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` and verify HTTP 200 plus game HTML.
4. On Windows, keep one tunnel open: `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:5173:127.0.0.1:5173 -L 127.0.0.1:5174:127.0.0.1:5174 contabo-srive`. If 5173 is already forwarded, add only the 5174 forward in a second terminal rather than colliding. Share both browser URLs; distinguish host HTTP verification from the user's confirmed browser reachability.
5. Verify guest gameplay, Settings/Account/Back, A2 creation with masked recovery and explicit Continue, same-origin reload persistence, A4 balance/Refresh, A5 list/detail/copy, user-confirmed A6 logout and A3 restoration with the disposable profile. For A6, observe confirmed BIS cleanup → restart request → game-owned restart; verify ordinary gameplay after closing the menus and after that restart.
6. Check Assets, Send, Receive and Swap entry/back as exposed by the package; stop before any mint, burn, send, swap, funding or continuation submission. Record an unavailable/error state honestly. No menu pruning and no new implementation of those workflows.
7. In the user's Windows browser, exercise offline/slow failure, duplicate open, nested Back, focus, held keyboard/mouse input, resize, short portrait, fullscreen and teardown. Record browser name/version; real mobile and a Chrome/Edge/Firefox matrix are not required. Use a fresh live account for lifecycle and zero/empty reads, plus required isolated populated balance/transaction/detail/copy fixtures. An existing funded account is not required and no funding is added to manufacture history. Synthetic account/error/history results belong only to isolated fixtures.
8. Serve both production builds, using ports 4173/4174 and corresponding forwards if needed, and repeat package loading, Settings/Account navigation and absence of startup/React/CSS errors. Stop only servers started for this run; preserve unrelated sessions.

Acceptance evidence belongs in change-local `verification.md`, with one row per A1–A6 case and per host/package regression, including expected/observed result, fixture versus live source and pass/fail/blocked/not-run. Record only public identifiers and masked UI. The evidence must include the complete A2→reload→A6→A3 loop in the game before calling group A smoke-tested. Existing service-dependent gaps remain listed separately; isolated fixture results never substitute for this live loop.

The five-question interview is complete: Back to Settings, host-owned restart, fixed package, a fresh live account plus populated-data fixtures, and the user's Windows browser are confirmed. Exact browser/version is recorded at execution; it does not change scope. Only proposal.md and design.md have been reconciled with these decisions. Before implementation, update the existing delta spec and tasks for restart-event ordering, memory invalidation, same-origin notifications, game/demo handlers and the confirmed fixture/browser acceptance. Do not apply the older tasks as written.

## Risks / Trade-offs

- Separate origins → Explicit URLs and a disposable game-origin profile; no storage migration.
- Package drift or duplicate React → Snapshot hash, locked peers, clean install and dev/production checks.
- Modal/pause regression → Owned pauses, focused lifecycle tests and real keyboard/touch/fullscreen checks.
- Historical UI fixture/spec drift → Compare against the packaged baseline and confirmed behavior; record unrelated failures instead of silently changing wallet semantics.
- Network failure → Truthful BIS errors and a usable return path; no fake balances or account-connected result.
- Concurrent UI refactor → `consolidate-ui-components` is independent; pin the package tested and repack after changes rather than mixing evidence.
- Removing forced reload exposes stale-memory bugs → Confirm BIS invalidation before requesting host restart; test with a host that never reloads and with same-origin contexts.
- Consumers relying on automatic reload → Document the changed host responsibility and migrate the demo and game together before packing.

## Migration Plan

No account schema migration, remote deployment or Git operation is required to implement or run this local smoke test. Establish BIS baseline, implement and test restart requests and the demo handler, deliver the package, wire the game host, verify isolated behavior, then perform the user-assisted account lifecycle. Consumers must adopt the restart event when upgrading this package snapshot. If integration blocks ordinary game startup, disable/remove the game adapter hookup and dependency edits while retaining unrelated work; do not clear wallet storage as rollback. Commits, pushes and destructive Git rollback still require authorization for their targets.
