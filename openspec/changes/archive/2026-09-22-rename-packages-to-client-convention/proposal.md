# Proposal

## Why

The package source layout has grown around feature history, which makes it harder to see the client-side ownership boundaries before editing wallet, Admin, Marketplace, or spike code. Renaming and organizing the package internals around a `client/` convention makes the browser-only architecture explicit while preserving the existing package set and public product behavior.

## What Changes

- Rename browser-side source organization in each package toward `src/client/` and mirrored `tests/client/` folders.
- Introduce layer-oriented folders under `client/` so package responsibilities are visible at the filesystem level.
- Preserve the existing package set: `@bis/integration`, `@bis/integration-demo`, `@bis/marketplace`, and `@spike/balance-onboard`.
- Preserve generated/public asset locations unless the implementation finds a low-risk move with updated references.
- Add or update small layer `README.md` files that define ownership rules for client layers.
- **BREAKING** for internal imports only: repository-local relative imports and test paths will change as files move. Public package exports must remain compatible.

## Capabilities

### New Capabilities

- None. This change is a structural refactor and does not introduce externally observable behavior.

### Modified Capabilities

- None. Existing behavior requirements remain unchanged; the change opts out of spec deltas with `skip_specs: true`.

## Impact

- Affected code: `BIS/packages/*/src`, `BIS/packages/*/tests`, package-local Vite/test configuration, and package-local documentation.
- Affected APIs: public exports from `@bis/integration` must remain source-compatible for consuming packages.
- Affected systems: TypeScript/JS import paths, test fixture paths, static/public asset references, and package build inputs.
- Dependencies: no new runtime or development dependencies are expected.
