# Design

## Context

See [proposal.md](proposal.md) for motivation. The root workspace uses a wildcard package pattern, but several scripts and imports contain explicit package folder or workspace names. The shared Vite server owns all four development destinations through `BIS/scripts/dev-config.mjs`; it maps `/admin/` to `integration-demo` and `/onboarding/` to `balance-onboard-spike-standalone`. Root test and build scripts, Pages staging, Marketplace imports and tests, documentation, and the lockfile repeat those paths.

## Goals / Non-Goals

**Goals:**

- Make the Admin host consistently `integration-admin` and the standalone onboarding application consistently `prototype-onboarding` in active repository paths, workspace identities, current documentation, and OpenSpec planning records.
- Keep the shared Vite host and all four public development routes unchanged.
- Retain storage-key values, GitHub Pages asset URLs, and archived records that serve as historical evidence.

**Non-Goals:**

- Changing UI behavior, onboarding behavior, package versions, dependency versions, or public Pages routes.
- Migrating or deleting browser storage.
- Rewriting archived OpenSpec plans, test outputs, logs, or verification evidence.

## Decisions

### Rename package folders, documentation files, and workspace identities together

Move `integration-demo` to `integration-admin`, including its required package README filename, and rename `@bis/integration-demo` to `@bis/integration-admin`. Move `balance-onboard-spike-standalone` to `prototype-onboarding`, including its required package README filename, and rename `@spike/balance-onboard` to `@spike/prototype-onboarding`.

Keeping the former workspace identifiers after folder moves would leave the root scripts and developer guidance using mismatched terms. Renaming only the folders would be mechanically smaller but would not meet the requested all-reference outcome.

### Treat stable external behavior as an invariant

Update the Vite package-route map and every explicit source/test/release path to the new folders while preserving route labels and paths: `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/`. The Admin production base and Pages staging destinations remain `admin` and `marketplace`.

Changing routes to mirror folder names was considered and rejected because it would break existing local bookmarks, the documented SSH-tunnel preview contract, and published Pages expectations without a user request.

### Classify legacy textual references before replacing them

Replace former package names and paths in active source, tests, configuration, current documentation, and non-archived OpenSpec plans. Preserve intentional browser-storage identifiers such as `bis.integration-demo.*`, immutable public URLs, and `openspec/changes/archive/**` historical records. Update reader-facing labels where they identify the renamed package, while retaining domain labels such as "BIS Admin" and "Onboarding Spike" where they describe the served application rather than a folder.

A blind repository-wide substitution was considered and rejected because it would invalidate historical evidence and could strand existing storage values.

### Regenerate workspace lock metadata through npm

After moves and manifest identity changes, refresh `package-lock.json` with npm rather than manually editing its workspace and symlink entries. Verify no unwanted dependency upgrades are introduced.

This avoids malformed lockfile references and keeps the workspace resolution aligned with the manifests.

## Risks / Trade-offs

- [An overlooked hard-coded path breaks a build, test, or Vite route] -> Search for both old folder and workspace identifiers after implementation, then run typecheck, all tests, per-package builds, and the shared Vite route checks.
- [Renaming storage keys loses local UI settings] -> Preserve their literal values and assert that the rename scope excludes those keys.
- [Regenerating the lockfile changes unrelated dependencies] -> Inspect the lockfile diff and keep only renamed workspace/path metadata changes.
- [Historical documents become misleading if rewritten] -> Limit documentation and OpenSpec updates to current material; retain archives unchanged.

## Migration Plan

1. Rename the two package directories and each package README using Git-aware moves.
2. Update manifests, root scripts, scripts, imports, test discovery, Vite package routes, active documentation, and non-archived planning references.
3. Regenerate the npm lockfile and inspect the final reference search and diff.
4. Run the repository tests, typecheck, package builds, both renamed workspace commands, and the shared Vite verification for all four destinations.
5. Roll back by reverting the scoped rename and reference update commit if a consumer outside the repository still depends on an old workspace identity; no storage migration is needed because the keys remain stable.
