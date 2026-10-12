# Tasks

## Milestone 1 — Code conversion and handoff

Milestone 1 ends when all authored code is converted and wired. Focused checks are allowed while implementing, but final verification is reserved for Milestone 2. After task 5.4, pause for user verification and commit approval.

For this milestone, a task is complete when its conversion and wiring are implemented and focused compile/build/package checks pass. Broad repository suites, browser verification, route smoke, and final cleanup are intentionally deferred to Milestone 2 even where the task wording below mentions them.

## 1. Baseline and migration scaffolding

- [x] 1.1 Record the exact in-scope tracked JavaScript inventory by package, runtime lane, and file extension, reconcile it with the existing working-tree changes, and verify the inventory is reproducible with a repository command.
- [x] 1.2 Confirm the supported Node, npm, TypeScript, Vite, and Playwright versions and test direct execution of a minimal erasable `.ts` module; verify the result is documented in the migration notes and determines whether native strip-types execution is sufficient.
- [x] 1.3 Add shared TypeScript project configuration for browser, Node, Vite, and test code while preserving the existing strict production typecheck; verify `npm run typecheck` still passes before source conversion.
- [x] 1.4 Add a temporary or permanent tracked audit command that reports in-scope `.js`, `.jsx`, `.mjs`, and `.cjs` files plus stale extension references; verify it reports the pre-migration baseline without scanning dependencies or generated output.

## 2. Integration package conversion

- [x] 2.1 Convert JavaScript-module tests and fixtures under `BIS/packages/integration/tests` to TypeScript, preserving test isolation, fake SDK boundaries, secret redaction, and high-range numeric handling; defer the full integration suite to Milestone 2.
- [x] 2.2 Resolve the converted integration tests against typed production imports and add explicit types for fixture payloads, browser/storage values, operation records, and Arkade adapter results without exposing Arkade types through the public API; strict typechecking passes.
- [x] 2.3 Update integration package scripts, test globs, imports, and package documentation for the new extensions; the integration production build passes.

## 3. Admin and Marketplace conversion

- [x] 3.1 Convert remaining Admin browser helpers, fixtures, and tests to `.ts`/`.tsx`, including the standalone spike entrypoint and preview-session helper; the Admin production build passes.
- [x] 3.2 Type Admin message/storage/configuration boundaries and React test hosts while preserving the existing public `@bis/integration` consumption boundary; strict typechecking passes.
- [x] 3.3 Convert Marketplace tests and remaining JavaScript helpers to TypeScript, preserving catalog, checkout, inventory, and network-selection behavior; the Marketplace production build passes.
- [x] 3.4 Update Admin/Marketplace Vite references, test discovery, package documentation, and root launcher references; defer browser route smoke to Milestone 2.

## 4. Prototype and shared package conversion

- [x] 4.1 Convert `BIS/packages/prototype-onboarding` browser source, operation/Arkade layers, helpers, and tests to TypeScript, keeping its independent storage and route behavior; onboarding tests and production build pass.
- [x] 4.2 Convert `BIS/packages/prototype-faucet` React source, Node server/shared modules, scripts, tests, and Vite configuration to TypeScript; preserve funding, balance, environment, and no-secret behavior; faucet tests and production build pass.
- [x] 4.3 Convert `BIS/packages/prototype-sandbox` source/tests and `BIS/packages/shared` server/environment source/tests to TypeScript; preserve their package-local entrypoints and README destinations; sandbox/shared focused checks pass.
- [x] 4.4 Add explicit Node and browser types for prototype environment/configuration input, HTTP/API payloads, lifecycle state, CLI arguments, and test doubles; strict typechecking passes without introducing blanket `any` or secret-bearing debug output.
- [x] 4.5 Update prototype package scripts, test globs, Vite config references, exports, README commands, and root route configuration; defer browser route smoke to Milestone 2.

## 5. Repository tooling conversion

- [x] 5.1 Convert all in-scope `BIS/scripts` JavaScript-module utilities, smoke runners, release helpers, test-wallet tools, and their tests to TypeScript while preserving CLI arguments, exit codes, output contracts, and secret-safety rules; focused tooling and onboarding checks pass.
- [x] 5.2 Update root `package.json` scripts, script imports, workflow references, and documentation commands to execute the TypeScript tools through the verified runtime path; defer broad `npm test`/`test:all` verification to Milestone 2.
- [x] 5.3 Type shared CLI argument parsing, subprocess results, filesystem paths, route checks, and generated-artifact metadata; strict typechecking and focused package checks pass.
- [x] 5.4 Milestone 1 handoff: verify all in-scope authored `.js`, `.jsx`, `.mjs`, and `.cjs` files have been converted or intentionally excluded, all imports/exports/scripts/globs point to the TypeScript replacements, and the working-copy diff is ready for user review; stop here and request verification before committing or beginning Milestone 2.

## Milestone 2 — Verification and hardening

Begin only after the user verifies the Milestone 1 working copy and the converted code is committed.

## 6. Repository-wide verification and cleanup

- [ ] 6.1 Remove obsolete in-scope JavaScript source files only after all imports, exports, scripts, test globs, and documentation references resolve to their TypeScript replacements; verify the extension audit reports zero authored `.js`, `.jsx`, `.mjs`, and `.cjs` files in scope.
- [ ] 6.2 Run strict typechecking and every package build, including `npm run typecheck`, `npm run build`, and `npm run build:all`; verify only pre-existing non-blocking advisories remain.
- [ ] 6.3 Run the complete unit/API/browser verification matrix, including `npm test`, `npm run test:all`, route verification, relevant Playwright smoke checks, and package-specific commands; verify no behavior, route, storage, wallet, or network contract changes are observed.
- [ ] 6.4 Review the final diff for generated files, dependency changes, secrets, unrelated working-tree edits, stale extension references, and accidental Arkade-specific public types; verify only the approved migration/configuration/documentation files are included.
- [ ] 6.5 Update the package and repository documentation to describe the all-TypeScript authored-source baseline and verified commands; verify every documented command and link resolves against the converted filenames.
