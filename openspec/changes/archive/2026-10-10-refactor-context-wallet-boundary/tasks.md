# Tasks

## 1. Establish a tested context dependency boundary

- [x] 1.1 Record the baseline `npm run typecheck` and `npm test` results for the integration workspace before changing the context construction path.
- [x] 1.2 Define a core-owned named wallet dependency contract and migrate the production context construction path to it without changing `BisContext` or `createBisContext()` behavior; verify with a focused injected-dependency context test and `npm run typecheck`.
- [x] 1.3 Add an Arkade-side dependency factory and compatible public composition façade so concrete Arkade operations are wired outside `state-layer-core/context.ts`; verify public context construction and network-selection behavior with focused tests.
- [x] 1.4 Retain or migrate the source-level positional test seam only as needed for existing tests, ensuring named injection is the production path; verify the affected context, send, asset, boarding, and continuation tests pass.

## 2. Extract one cohesive context workflow

- [x] 2.1 Use the existing focused asset characterization suite to confirm visibility gating, refresh coalescing, stale-result suppression, and watch cleanup before and after extraction.
- [x] 2.2 Extract the asset refresh/watch lifecycle into a focused state-core service with explicit callbacks and dependencies while preserving the `BisContext` façade and state shape; verify asset-context and asset-observation tests plus `npm run typecheck`.
- [x] 2.3 Verify the extracted workflow retains account-change, disposal, and background-refresh semantics through the relevant focused tests and the repository-wide suite.

## 3. Guard and complete the refactor

- [x] 3.1 Add a narrow architecture fitness test that prevents direct Arkade runtime imports from the completed context boundary while permitting unrelated modules and deliberate type-only references; verify it fails for a fixture or temporary violating source and passes for production source.
- [x] 3.2 Run `npm run typecheck`, `npm test`, and `npm run build`; inspect the diff to confirm no public API, persistence format, secret-handling, or UI behavior change was introduced.
- [x] 3.3 Update this task list and the refactor-plan report with completed stages, verification evidence, retained compatibility seams, and any deviations; verify every completed checkbox has supporting evidence.

## Verification record

- Baseline and completion typechecks passed.
- Final focused suite passed 89 tests across context, network selection, asset lifecycle, wallet subscription, send, boarding, continuation, named dependency, and architecture-boundary coverage.
- The Vite test servers and root development server now ignore generated `output/` content, avoiding file-watch failures from browser diagnostic profiles while retaining source and documentation watching.
- Final `npm test` passed all 665 tests. `npm run build` passed for all workspaces; Vite emitted only its existing dynamic-import and chunk-size warnings.
