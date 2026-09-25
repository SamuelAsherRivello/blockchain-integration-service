## 1. Major-version contract and BIS composition

- [x] 1.1 Define and export the complete `BisHostGame` interface and explicitly named associated types; verify all receipt states and session-scoped semantics in focused tests.
- [x] 1.2 Implement `BisGameServices` as the public game facade with exactly five numbered explanatory comments; verify it composes and disposes BIS services without exposing Arkade or game internals.
- [x] 1.3 Route confirmed continuation and player-reward results through the host contract; verify duplicate and stale deliveries do not alter financial results.
- [x] 1.4 Make the public package a breaking major version, update entry points and package documentation, and pack the artifact for the game consumer.

## 2. Game-host adoption and boundary checks

- [x] 2.1 Implement game `createBisHostGame` with JSDoc conformance, active-session identity, opaque continuation targets, and a session-scoped delivery ledger.
- [x] 2.2 Replace the game callback seam with the `BisGameServices`/`BisHostGame` integration while retaining paid revival, rewards, no-account play, restart, focus, fullscreen, and disposal behavior.
- [x] 2.3 Add dev-only TypeScript contract checking and focused host, lifecycle, and static import-boundary tests; verify the game imports only published BIS exports.
- [x] 2.4 Update the game vendor package from the packed BIS major artifact only after the game resolves and smoke-tests the new public API.

## 3. Documentation and reusable guidance

- [x] 3.1 Create the three BIS and three game Code Templates; verify their equivalent sections cover purpose, allowed dependencies, contract, state/timers, disposal, errors, and verification.
- [x] 3.2 Add README `Deep Dive` sections and long-form project Deep Dives with cross-repository links, source links, and showcase snippets.
- [x] 3.3 Update both Project Refactor Thoughts reports to distinguish observed facts, benefits, trade-offs, and the implemented recommendation.

## 4. Quality gates and release readiness

- [x] 4.1 Run BIS typecheck, tests, build, package checks, and applicable browser smoke paths.
- [x] 4.2 Run game contract typecheck, tests, publish tests, build, and applicable browser smoke paths; report unrelated dirty-worktree failures separately.
- [x] 4.3 Strictly validate both OpenSpec changes, review staged files, commit the scoped BIS and game changes separately, push normally, and verify both online README pages.
