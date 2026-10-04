## 1. Establish the BIS package and test baseline

- [x] 1.1 Record BIS/game revisions, dirty paths, Node/npm versions and the inspected Account labels/contracts in change-local verification.md; compare against design.md and preserve concurrent work. Verify Node 24+ is available for the documented BIS suites and list any baseline drift without changing unrelated behavior.
- [x] 1.2 Run BIS typecheck/build and focused existing account context, creation, recovery, restoration, balance, activity and logout tests; perform the BIS demo navigation baseline with clearly isolated fixtures where needed. Record commands and outcomes, including historical fixture failures, before changing the consumer.
- [x] 1.3 Pack the built `@bis/integration` workspace, inspect its file list and verify both export branches and the public stylesheet exist; record version, source identity and SHA-256. Add a focused independent public-package consumer check if the existing demo fixture cannot detect missing packed files or external peer resolution.

- [x] 1.4 Replace library reloads with restartRequested after confirmed cleanup and memory invalidation. Carry a non-secret logout ID through same-origin notifications, reject stale/duplicate notifications, isolate throwing host handlers, and test absent/non-reloading hosts plus fresh contexts. Update the demo host and public lifecycle documentation before packing.

## 2. Prepare the independent game consumer

- [x] 2.1 Place the reviewed version/hash-named tarball under game `vendor/`, add its relative file dependency and tested React/React DOM peers, and update the game lockfile. Verify a clean dependency install resolves one compatible React instance and does not require the BIS sibling checkout or private source aliases.
- [x] 2.2 Add game `src/integration/bis-account.js` using only the public package/stylesheet, with an injected game-owned restartGame callback, logout-ID deduplication, cached asynchronous loading, one context/root, subscription cleanup, disposed-generation protection and a bounded failure/back path. Verify duplicate opening, delayed initialization, import failure and teardown with isolated host tests; no live wallet calls in fixtures.
- [x] 2.3 Wire the adapter into game `src/main.js` and its pagehide cleanup without making account readiness a dependency of game startup. Verify guest play, failed BIS loading and ordinary Account close leave the game usable and do not reset browser account state.

## 3. Integrate Settings, pause and focus

- [x] 3.1 Extend game pause ownership compatibly and migrate Settings/BIS to independent reasons or tokens; verify existing pause tests plus overlapping Settings/Account/start/loss ownership, no intermediate resume, held-input clearing and final-resume frame timing.
- [x] 3.2 Add the game-owned ⚡ Account action to `src/ui/settings-ui.js` through an injected callback; suspend inactive Settings interaction while the production Account root is active and restore Settings/focus only on root dismissal. Verify nested BIS Back does not dismiss the root, and existing music/SFX/fullscreen/developer settings behavior remains intact.
- [x] 3.3 Add a positioned BIS host and scoped game-side layout/layer handling without restyling private BIS components. Verify pointer/keyboard isolation, focus containment/return, available close controls, short/narrow portrait fit without whole-dialog scrolling and fullscreen placement; ensure the paused canvas remains visible.
- [x] 3.4 Reconcile the game's Settings and gameplay-pause specification descriptions with the implemented Account route, preserving its C### conventions if a game-local change record is required. Link back to this BIS coordination change and verify no death/revival or payment gameplay requirements are introduced.

## 4. Deliver the repeatable smoke runbook

- [x] 4.1 Create BIS `documentation/SMOKE_TEST_BIS_TO_GAME.md` with exact build/pack/install commands, package refresh/provenance procedure, BIS server 5174/Windows 15174 and game server 5175/Windows 15175 startup commands, production-preview commands, HTTP checks, Windows SSH forwarding and browser URLs. Verify every command against the actual final manifests and document how to add the game tunnel when BIS is already forwarded.
- [x] 4.2 Add game README and BIS integration README pointers plus the minimal public adapter lifecycle contract; verify links resolve and the instructions explain separate origins, consistent 127.0.0.1 hostname, disposable game-origin account setup, user-managed recovery material and host-owned restart after logout.
- [x] 4.3 Add the A1–A6 and host/package acceptance matrix to verification.md with expected outcomes and pass/fail/blocked/not-run fields. Verify it distinguishes live lifecycle checks, isolated populated/error fixtures, empty account results and historical live-evidence gaps; include all existing Account destinations as navigation-only checks.

## 5. Verify the cross-project Account smoke test

- [x] 5.1 Run game `npm test`, `npm run test:publish` and `npm run build`, plus BIS build and the focused integration suites affected by any package fix. Verify the game consumes the recorded artifact in development and production and no private/admin import or duplicate React error appears; record any unrelated baseline failure separately.
- [x] 5.2 Start and HTTP-check BIS first, then the game; establish Windows forwards when running remotely (use direct localhost for Windows-local checkouts) and verify both browser pages load. In the game verify A1 Settings/Account/Back and guest gameplay, with no automatic account creation, payment or blocking dependency on BIS connectivity; record public screenshots and observed pause/focus behavior.
- [ ] 5.3 With the user handling a disposable Signet profile and recovery words privately, verify A2 explicit creation/Continue and same-origin reload persistence, then A4 Balance/Refresh and A5 Transactions. Verify masked recovery access and copying through user-assisted interaction without recording secrets; record zero/empty/unavailable results honestly. Use isolated populated fixtures for detail/copy cases unavailable in the live profile, without claiming live financial evidence.
- [ ] 5.4 On that disposable profile with no pending transactions, have the user complete production A6 acknowledgement/logout, verify cleanup → restartRequested → game-owned restart and ordinary guest gameplay, then A3 restoration and matching public profile identity. Leave this task incomplete if any live lifecycle step is blocked; do not clear unrelated account storage or bypass pending-operation guards.
- [ ] 5.5 Verify Assets, Send, Receive and Swap remain reachable with their existing controls and Back behavior, stopping before mutation submissions. Exercise offline/slow errors, repeated open/close, nested navigation, held keyboard/touch input, short portrait/fullscreen and page teardown using isolated fixtures for induced failures; record no gameplay resume beneath an active modal.
- [x] 5.6 Repeat production-preview Settings/Account navigation and verify CSS/assets, lifecycle mounting and startup error handling against the same artifact. Finish the acceptance matrix, run strict validation of this change and whitespace checks, and report A1–A6 pass versus blocked/manual gaps without claiming pay-to-continue, funded transfers or achievement gameplay completion.

## 6. Follow-up UI feedback — implementation and sizing review

- [ ] 6.1 At the existing scale, first shorten the seed-word warning to at most one line and make every BIS screen fit without scrolling except its Transactions or Assets list. Verify recovery display/entry, all other dialogs, error/confirmation states and long-content behavior without clipping required content/actions. If screens still do not fit, trial a temporary 80% embed and obtain user review before permanent CSS size changes.

- [x] 6.2 Place the BIS host above every game visual control, including virtual controls, and add the full-screen translucent black blocking backdrop. Verify visual overlap and pointer/keyboard isolation in the user's browser.
- [x] 6.3 Move the game-owned Account action above the volume controls and match BIS button styling with game-owned CSS. Verify focus/keyboard behavior and appearance without private BIS component dependencies.
- [x] 6.4 Show Account ID with a copy icon only on Accounts Details; remove its repeated subtitle from other windows. Verify complete-ID copying and navigation. Keep the confirmed logout browser refresh.

- [ ] 6.5 Measure actual Windows Chrome and Android viewport/game-area dimensions and verify the agreed no-page-scroll behavior on both. Use the reported desktop 743 × 1321 at 100% zoom as an observed target, not an assumed Android minimum. Settle keyboard-open behavior in planning before accepting restoration-entry layout.

- [x] 6.6 Remove the initial loading-placeholder flicker while retaining blocking/pause behavior and bounded failure/Back. Verify delayed initialization and ordinary opening without exposing account data.

- [x] 6.7 Following user approval, replace the 80% game embed with native BIS CSS dimensions and verify the approved geometry at 100%.

## 7. Release delivery

- [x] 7.1 Commit, push and release BIS v0.12.0; download and verify the release archive in the game and record publication evidence.
