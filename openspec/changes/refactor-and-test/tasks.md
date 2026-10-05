# Tasks

## 1. Baseline and package-entry verification

- [ ] 1.1 Recheck active OpenSpec changes, current working-tree edits, and the immediate `BIS/packages/*` manifest inventory before each refactor pass; verify unrelated edits remain outside this change's diff.
- [ ] 1.2 Add a hermetic shared-Vite development-server check that derives the four package destinations from the current manifest/route inventory and verifies `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/` return package-specific expected content; verify a missing nested route does not resolve to another application.
- [ ] 1.3 Make the entry check start and close the Vite server safely on an isolated loopback port without wallet writes, secrets, leaked handles, or dependence on port 5174; verify the check passes repeatedly and a separate occupied-port check preserves strict-port behavior.
- [ ] 1.4 Verify each package's declared entry path with its appropriate Vite mode: shared application/README route checks for all four packages and independent production builds for `@bis/integration`, `@bis/integration-admin`, `@bis/marketplace`, and `@spike/prototype-onboarding`; document the exact commands and library README exception in the package/development documentation.

## 2. Evidence-led cleanup and documentation reconciliation

- [ ] 2.1 Inventory tracked generated artifacts and package-local output folders, remove only files proved generated and unreferenced, and verify `git ls-files` contains no removed generated logs while builds/tests regenerate no tracked debris.
- [ ] 2.2 Locate the authoritative project-brief and design-discussion source through checked-in history or identify an approved checked-in successor; update only verified stale references in repository guidance, OpenSpec context, and documentation, then verify every changed Markdown/config path resolves.
- [ ] 2.3 Preserve the established four-destination route contract while reconciling package-renamed documentation; verify README/package README links, development labels, and the Pages-only Admin/Marketplace release routes remain accurate.

## 3. Integration context decomposition

- [ ] 3.1 Add characterization coverage for `createBisContext`, state/events, disposal, injected dependencies, and Admin controls before extraction; verify the existing focused integration lifecycle suites pass unchanged.
- [ ] 3.2 Extract private account-session and lifecycle coordination from `context.ts` behind the unchanged `BisContext` facade; verify account creation/restoration/logout/reset tests and the public export snapshot remain stable.
- [ ] 3.3 Extract private read/subscription and wallet-mutation coordination in separate reviewable slices while retaining operation ordering, cancellation, storage namespaces, and non-secret state; verify relevant onboarding, sending, transfer, asset, contract, and multi-context tests after each slice.
- [ ] 3.4 Keep `createBisContext`, `createBisAdminContext`, all supported state/event shapes, and package export paths unchanged; verify typecheck, the built-package consumer fixture, and a public-import boundary check.

## 4. Test-boundary cleanup

- [ ] 4.1 Classify each integration-admin fixture that imports `@bis/integration` private source as either a public-contract test or a white-box integration test; verify the inventory records an owner and replacement location for every current private import.
- [ ] 4.2 Move white-box fixtures/helpers into the integration package test boundary and convert public-contract fixtures to package exports and browser-visible behavior; verify equivalent assertions still execute without adding a public testing API.
- [ ] 4.3 Add an import-boundary check forbidding unapproved production or cross-package test imports of integration private source paths; verify the check passes and does not prohibit package-local white-box tests.

## 5. Prototype-onboarding composition

- [ ] 5.1 Add or retain characterization tests for prototype reload persistence, independent duplicate windows, recovery cleanup, and single-submission behavior before moving orchestration; verify `npm run test --workspace @spike/prototype-onboarding` passes.
- [ ] 5.2 Extract prototype DOM rendering/event wiring from `src/main.js` into private modules without changing the HTML entry, storage keys/schema, URL window scope, recovery-phrase handling, or direct Arkade imports; verify its unit suite and shared `/onboarding/` route check.
- [ ] 5.3 Extract lifecycle scheduling and settlement/recovery coordination in small slices while retaining cancellation and recovery ordering; verify focused lifecycle tests plus a browser smoke check for reload and duplicate-window isolation.
- [ ] 5.4 Build the prototype independently after every completed slice and retain its intentionally separate ownership from `@bis/integration`; verify no integration dependency or wallet-data migration is introduced.

## 6. Incremental maintainability guardrails

- [ ] 6.1 Establish a non-blocking baseline report for unused imports, unsupported private imports, oversized composition modules, and stale generated artifacts using repository-native tooling; verify it produces no secrets and is written only beneath `output/reports/refactor-and-test/` if persisted.
- [ ] 6.2 Promote only checks with a clean or explicitly ratcheted baseline into the normal verification path, without broad formatting edits or runtime dependency changes; verify existing `npm test`, `npm run typecheck`, and package builds remain available.

## 7. Integrated parity verification

- [ ] 7.1 Run the complete refactor matrix: root tests, prototype tests, typecheck, all four package builds, shared-Vite entry checks, and relevant browser checks; record non-secret output under `output/reports/refactor-and-test/` and distinguish automated from live Signet evidence.
- [ ] 7.2 Compare the public integration export snapshot, four development destinations, storage/URL contract checks, and two Pages route build artifacts against the baseline; verify no public API, persistence, network, or release behavior changed.
- [ ] 7.3 Validate the OpenSpec change with strict validation and update task completion only for verified results; verify the final change diff excludes unrelated user edits, generated output, recovery phrases, and unapproved dependency upgrades.
