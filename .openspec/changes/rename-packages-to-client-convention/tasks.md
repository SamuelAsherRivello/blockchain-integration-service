# Tasks

## 1. Inventory and Guardrails

- [ ] 1.1 Inventory non-generated files under `BIS/packages/*/src` and `BIS/packages/*/tests`, excluding `dist`, `node_modules`, `.vite*`, `.playwright-cli`, and `output`, and verify the inventory identifies every source/test file that must move.
- [ ] 1.2 Search for imports and path references to current package folders and verify the result list covers source files, tests, Vite configs, package exports, README references, and test HTML fixtures.
- [ ] 1.3 Confirm `@bis/integration` public entrypoints and CSS export paths before moving files, and verify the recorded baseline matches `package.json` exports.

## 2. Integration Package

- [ ] 2.1 Create the `BIS/packages/integration/src/client/` layer folders and move existing integration implementation files into the target layers, verifying `rg` finds no stale imports to the old `src/core`, `src/arkade`, or `src/ui` locations.
- [ ] 2.2 Preserve `BIS/packages/integration/src/index.ts` and `@bis/integration/style.css` compatibility through re-exports or updated package export targets, and verify consuming imports still resolve from `@bis/integration`.
- [ ] 2.3 Mirror integration tests under `BIS/packages/integration/tests/client/`, update test imports/fixtures, and verify the integration test command passes or reports only pre-existing unrelated failures.
- [ ] 2.4 Add concise layer README files for the integration client layers, and verify each README states what belongs in the layer and what must stay out.

## 3. Integration Demo Package

- [ ] 3.1 Move Admin, preview, bridge, data, and UI code under `BIS/packages/integration-demo/src/client/`, and verify old `src/admin`, `src/preview`, and direct UI paths are no longer referenced.
- [ ] 3.2 Update demo entrypoints, Vite inputs, story catalog imports, and development/test fixtures for the new client paths, and verify the demo build succeeds.
- [ ] 3.3 Mirror demo tests under `BIS/packages/integration-demo/tests/client/`, update fixture paths, and verify focused demo tests pass or report only pre-existing unrelated failures.
- [ ] 3.4 Preserve `public/` assets and `documentation/user-stories/` paths unless a reference is updated in the same task, and verify GitHub Pages-facing asset URLs remain unchanged.

## 4. Marketplace Package

- [ ] 4.1 Move Marketplace implementation under `BIS/packages/marketplace/src/client/` with marketplace, inventory, account, and UI layers, and verify old direct `src` imports are gone.
- [ ] 4.2 Keep Marketplace public assets stable while moving package-private source assets only when imports move with them, and verify Marketplace build output still references expected public asset paths.
- [ ] 4.3 Mirror Marketplace tests under `BIS/packages/marketplace/tests/client/`, update imports/fixtures, and verify Marketplace tests/build pass or report only pre-existing unrelated failures.
- [ ] 4.4 Add concise layer README files where Marketplace ownership boundaries are easy to confuse, and verify the README guidance matches the actual moved folders.

## 5. Standalone Spike Package

- [ ] 5.1 Move standalone spike implementation under `BIS/packages/balance-onboard-spike-standalone/src/client/`, preserving its independence from `@bis/integration`, and verify imports do not introduce production integration dependencies.
- [ ] 5.2 Mirror spike tests under `BIS/packages/balance-onboard-spike-standalone/tests/client/`, update imports/fixtures, and verify the spike test command passes or reports only pre-existing unrelated failures.
- [ ] 5.3 Preserve the spike's public URL behavior and `public/` assets, and verify the package build still succeeds.

## 6. Repository Verification

- [ ] 6.1 Run repository-wide searches for obsolete paths (`src/core`, `src/arkade`, `src/ui`, `src/admin`, `src/preview`, and package test roots) and verify remaining hits are intentional compatibility comments or documentation.
- [ ] 6.2 Run package builds for integration, integration-demo, marketplace, and the standalone spike, and verify each build succeeds or document any pre-existing unrelated blocker.
- [ ] 6.3 Run the relevant package test suites or focused equivalents, and verify failures are fixed or clearly documented as pre-existing unrelated issues.
- [ ] 6.4 Review the final tree under `BIS/packages/` and verify it matches the agreed `client/` convention without moving generated folders.
