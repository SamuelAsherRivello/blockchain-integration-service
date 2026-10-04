## 1. Establish the version source and synchronization contract

- [x] 1.1 Change the root package version and the in-scope published workspace manifests to `0.0.1`, update their internal `@bis/integration` ranges and npm lockfile metadata, and verify no in-scope manifest remains at `1.0.0` with a targeted version-consistency test.
- [x] 1.2 Inspect the runtime version import and generated package output, then update the version path only as needed so Admin and Marketplace production builds expose the authoritative `0.0.1`; verify with the existing typecheck/build commands and a focused output assertion.
- [x] 1.3 Update the active README Admin and Marketplace cache-busters and release instructions to describe the patch-only sequence and current two-route Pages workflow; verify both links contain `?v=0.0.1` and historical release/OpenSpec evidence remains unchanged.

## 2. Add release-version validation

- [x] 2.1 Add a repository validation script and npm command that reads the root authoritative version, enforces `0.0.N`, checks all in-scope manifests/lockfile/runtime/documentation surfaces, and excludes the standalone onboarding spike and catalog schema versions; verify passing and intentionally inconsistent fixture cases.
- [x] 2.2 Add exact patch-transition validation for the initial `0.0.1` baseline and later `0.0.N` to `0.0.(N+1)` updates, with actionable errors for unchanged, skipped, decremented, major, or minor jumps; verify each transition case in automated tests.
- [x] 2.3 Integrate the validation into the pre-deployment workflow before build/staging and document the local release command sequence; verify the workflow YAML invokes the check before Pages artifact upload and the local command is reproducible.

## 3. Verify the published release contract

- [x] 3.1 Extend or pair the existing Pages route verifier to assert both Admin and Marketplace applications load from the staged artifact with the candidate version while preserving `/assets/`; verify the existing route and artwork checks still pass.
- [x] 3.2 Run the full release gate (`npm test`, version validation, `npm run build`, Pages staging, and Pages route verification), inspect `git diff --check`, and record the result in the change verification output without writing secrets.
- [x] 3.3 Review the final diff for accidental changes to GitHub tag/release behavior, the standalone spike version, catalog schema versions, or immutable asset URLs; verify only the scoped release-process files are changed.
