# Tasks

## 1. Rename the package boundaries

- [x] 1.1 Move `BIS/packages/integration-demo` to `BIS/packages/integration-admin` and rename its primary README to `integration-admin-package-readme.md`; verify the new directory and README exist and the old paths do not.
- [x] 1.2 Move `BIS/packages/balance-onboard-spike-standalone` to `BIS/packages/prototype-onboarding` and rename its primary README to `prototype-onboarding-package-readme.md`; verify the new directory and README exist and the old paths do not.
- [x] 1.3 Update both moved manifests to `@bis/integration-admin` and `@spike/prototype-onboarding`; verify `npm query .workspace` reports the renamed workspace identities.

## 2. Update active repository references

- [x] 2.1 Update root scripts, TypeScript configuration, lockfile metadata, shared Vite routing, Pages staging/release scripts, smoke scripts, cross-package imports, and test paths to use the renamed package folders and workspace identities; verify `rg` finds no old folder or workspace identifier in active source/configuration.
- [x] 2.2 Preserve existing `bis.integration-demo.*` browser storage keys and public Pages asset URLs while updating package-name references; verify the diff changes no storage-key values or published asset paths.
- [x] 2.3 Update active README files, user-facing documentation, `openspec/config.yaml`, and non-archived OpenSpec plans for the new package names and links; verify both renamed package READMEs link back to the root README and follow the package README naming convention.
- [x] 2.4 Keep `openspec/changes/archive/**` and retained historical evidence unchanged; verify all remaining old folder-name matches are intentional archive/history or preserved storage-key references.

## 3. Validate workspace and package behavior

- [x] 3.1 Regenerate workspace lock metadata without dependency upgrades; verify `npm ci` or equivalent lockfile validation resolves all renamed workspaces and the lockfile diff is limited to workspace identity/path updates.
- [x] 3.2 Run `npm run typecheck`, `npm test`, and `npm run build`; verify each exits successfully with the Admin workspace resolved under its new identity.
- [x] 3.3 Run `npm run test --workspace @spike/prototype-onboarding` and `npm run build --workspace @spike/prototype-onboarding`; verify the standalone onboarding package passes its tests and build.
- [x] 3.4 Start the standalone Admin Vite command for `@bis/integration-admin` and verify its Admin entry returns expected content; stop the temporary server cleanly after the check.
- [x] 3.5 Start the root shared Vite server and verify HTTP 200 plus expected content at `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/`; stop the temporary validation server cleanly unless it is retained for an active preview session.

## 4. Review the rename scope

- [x] 4.1 Inspect `git diff --check`, `git status --short`, and the final old-reference search; verify only this change's renamed packages, references, and planning artifacts changed, without disturbing pre-existing user work.
