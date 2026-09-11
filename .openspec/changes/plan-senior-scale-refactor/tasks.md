## 1. Documentation baseline and guardrails

- [ ] 1.1 Create the three BIS Code Templates for core TypeScript modules, React/TSX views, and Node tests; verify each includes purpose, dependency direction, lifecycle/disposal, error policy, and a focused verification convention.
- [ ] 1.2 Add the corresponding three game Code Templates in the game repository through a companion change; verify their structure is equivalent while remaining idiomatic JavaScript/Babylon guidance.
- [ ] 1.3 Link both Project Refactor Thoughts reports, the templates, and the eventual showcase source from the two READMEs; verify every link resolves at its published repository-relative path.
- [ ] 1.4 Add lightweight boundary tests that reject Arkade imports in game code and BIS internal-source imports outside the package; verify deliberate fixture violations fail with an actionable message.

## 2. BIS public composition and core extraction

- [ ] 2.1 Characterize current public factory, readiness, event, cleanup, and public-state behavior with focused tests; verify the pre-refactor suite records the compatibility baseline.
- [ ] 2.2 Add the protocol-neutral `BisGameServices` showcase class with exactly numbered comments 1–5 and a README source-tour link; verify it never exposes Arkade types or recovery material and existing factories remain usable.
- [ ] 2.3 Extract account/session and observation lifecycle ownership from `core/context.ts` into focused core feature controllers; verify account creation, restoration, logout, balance, activity, and cancellation tests remain green.
- [ ] 2.4 Extract asset, transfer, continuation, and contract orchestration in independent batches while retaining one state owner per operation; verify their existing targeted tests and API compatibility tests pass after every batch.
- [ ] 2.5 Reduce `core/context.ts` to coordinator/state publication responsibilities and group public exports by entry-point role without removing compatible names; verify `npm run typecheck`, integration tests, and package build pass.

## 3. BIS UI and demo composition

- [ ] 3.1 Move demo session/bootstrap ownership out of `integration-demo/src/App.tsx` into a named controller or hook; verify reset, dispose, account event, and React unmount behavior with existing demo tests.
- [ ] 3.2 Isolate Admin stories and preview-specific orchestration from production UI composition; verify the portrait runtime still renders the production package UI and uses public APIs only.
- [ ] 3.3 Update migrated BIS core, UI, and test files to their applicable templates in small reviewed batches; verify no batch changes rendered copy, persistence, or workflow behavior.

## 4. Game companion refactor

- [ ] 4.1 Create and approve the companion game-repository OpenSpec change before editing game runtime code; verify it preserves the grid/UI contracts and imports BIS only from `runtime/integration/`.
- [ ] 4.2 Extract game bootstrap, level/session lifecycle, and diagnostics from `runtime/main.js` into named controllers with explicit disposal; verify game Node tests, targeted browser smoke tests, and normal startup behavior remain green.
- [ ] 4.3 Split game-owned BIS host-shell mechanics from public-package session creation while retaining game pause, focus, fullscreen, restart, and no-account gameplay policy; verify `smoke-bis-release` and related integration tests pass.
- [ ] 4.4 Adopt the game templates in migrated runtime, DOM/UI, and test files; verify no gameplay system imports Arkade or a BIS internal path.

## 5. Cross-repository verification and release readiness

- [ ] 5.1 Pack the refactored BIS library and exercise the game adapter against that artifact; verify the game resolves only documented public exports and styles.
- [ ] 5.2 Run BIS `npm test`, `npm run typecheck`, and `npm run build`, then game `npm test`, `npm run test:publish`, and `npm run build`; verify all commands pass with no ignored regression.
- [ ] 5.3 Perform the existing browser smoke paths for account opening, paid continue, reward/asset flows, and game startup without an account; verify real Signet operations are never simulated and gameplay-only events remain the sole simulation boundary.
- [ ] 5.4 Review the two reports against the implemented topology and update only observed facts; verify a new engineer can follow the README to the BIS showcase class and identify the game integration seam in under one code-navigation pass.
