# Proposal

## Why

The existing package folder names no longer communicate the roles of the Admin host and onboarding prototype clearly. Aligning their names makes repository navigation, package documentation, and development tooling easier to understand while retaining the existing runtime routes and behavior.

## What Changes

- **BREAKING (repository paths):** Rename `BIS/packages/integration-demo` to `BIS/packages/integration-admin` and rename its package documentation to `integration-admin-package-readme.md`.
- **BREAKING (repository paths):** Rename `BIS/packages/balance-onboard-spike-standalone` to `BIS/packages/prototype-onboarding` and rename its package documentation to `prototype-onboarding-package-readme.md`.
- Rename the corresponding workspace package identifiers to match their new package roles, and update workspace scripts, lockfile entries, source imports, test paths, Vite development routing, release tooling, and current documentation.
- Preserve the shared Vite server's externally visible routes: `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/`.
- Preserve existing browser storage keys, public asset URLs, and archived OpenSpec evidence so that the rename does not clear user state or rewrite historical verification records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a repository-structure and tooling refactor; the documented runtime behavior is unchanged.

## Impact

- Affected repository areas: root workspace metadata, `BIS/scripts`, the two renamed packages, Marketplace cross-package imports and tests, root and package READMEs, and current project configuration/documentation.
- Affected development systems: npm workspaces and lockfile resolution, the shared Vite package-route map, focused test discovery, and Pages staging/release verification paths.
- No application behavior, external routes, dependency versions, wallet data, or public API behavior is added or removed.
