---
name: bis-package-release-export
description: Export a verified @bis/integration release tarball and handoff manifest for the adjacent Stealth & Steel game from this BIS repository.
---

# BIS Package Release Export

Use this skill only when Codex is operating in the BIS repository and the user wants the latest verified BIS integration package exported for a game consumer.

## Repository confirmation

Before changing or exporting anything, confirm all of the following from the current directory:

- `git rev-parse --show-toplevel` resolves to the repository containing `package.json` with name `blockchain-integration-service`.
- `git remote get-url origin` is `https://github.com/SamuelAsherRivello/blockchain-integration-service.git` (allow the equivalent `.git` spelling).
- `BIS/packages/integration/package.json` exists and names `@bis/integration`.
- The root release scripts include `check:release`, `test`, and `build`.

If any check fails, stop and report that Codex is not in the expected BIS project. Do not export from a guessed or adjacent directory.

## Default export workflow

The default target is a local, reproducible package handoff—not an npm publication or a GitHub download. The current project release contract publishes Pages demos but does not create npm packages, GitHub Releases, or tags automatically.

1. Read the root version and the `@bis/integration` version. Run `npm.cmd run check:release` and require the result to pass. For a subsequent release, validate the transition with `npm.cmd run check:release -- --previous-version <prior-version>`.
2. Run `npm.cmd test` and `npm.cmd run build`. Do not export when either fails. Windows Vite/Rolldown `spawn EPERM` is an execution-environment problem: retry with the approved elevated execution path; do not weaken the build or skip tests.
3. Create `output/packages/bis-package-release-export/<version>/` before writing artifacts. This is ignored repository output and must not be committed.
4. Pack the built integration workspace into that folder:

   ```powershell
   npm.cmd pack --workspace @bis/integration --pack-destination output/packages/bis-package-release-export/<version>
   ```

   Inspect the resulting tarball inventory and confirm it contains `package/dist/`, `package/src/`, and the public stylesheet export. Do not include recovery phrases, wallet files, `.env` files, or unrelated workspace packages.

5. Compute SHA-256 with `Get-FileHash -Algorithm SHA256` and write a JSON handoff manifest beside the tarball containing only: package name, version, tarball filename, absolute export path, SHA-256, source commit, and whether the BIS worktree was dirty. Never include secrets or full environment values.
6. Report the tarball path, version, hash, validation commands, and the exact next-step prompt for Codex in the adjacent game repository.

## Stealth & Steel handoff

Do not modify the adjacent game repository by default. Give the user a handoff such as:

```text
Use the BIS tarball at <absolute-tarball-path> for @bis/integration version <version>. Replace the game's vendor package, update its dependency and lockfile, then run the relevant game tests and production build. Verify the installed package version and SHA-256. Do not edit the BIS repository, use a source-folder symlink, expose secrets, or perform wallet operations.
```

Only update the adjacent game when the user explicitly names that repository and authorizes the consumer update. Confirm its repository identity and current vendor/dependency layout first; preserve unrelated dirty work.

## Release and Git boundaries

- A local export is not a public release. Do not claim that GitHub, npm, or the Pages site contains the package unless it was separately verified.
- Do not commit, push, tag, publish, or create a GitHub Release unless the user explicitly requests that exact external action.
- If a public artifact is later requested, prefer an immutable tagged or release asset over `main`; record the exact version and SHA-256 in the game consumer.
- Preserve the BIS release rule: `0.0.1` is the baseline and later versions increment only the last digit by one.
