---
name: bis-package-release-import
description: Import a verified local @bis/integration release into this Stealth & Steel project from the adjacent BIS checkout, updating the vendored tarball, lockfile, provenance, and verification results.
---

# Bis Package Release Import

Use this skill only from the Stealth & Steel repository root:

`D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game`

Its adjacent BIS source checkout is:

`D:\Documents\Projects\VC\Bitcoin\blockchain-integration-service`

The goal is one reproducible vendored `@bis/integration` tarball. Keep the BIS
checkout separate and do not modify, commit, push, publish, or symlink it.

## Safety and release boundary

- Consume an explicitly requested versioned local package, normally by packing
  only `@bis/integration` from the adjacent checkout.
- Refuse GitHub `main`, an unpinned branch, a source-folder dependency, or a
  symlink as the package input. A future published BIS artifact must be an
  immutable version/tag/archive and still requires provenance verification.
- Never request, print, copy, commit, or use wallet credentials, recovery
  phrases, cookies, API keys, or other secrets. Do not create accounts, sign,
  broadcast, pay, or perform wallet operations.
- Preserve unrelated dirty work in both repositories. Inspect `git status`
  before and after, and stop if the requested package/version is unclear.
- Always use an explicit `Set-Location` to the intended root in PowerShell;
  do not rely on an inherited working directory.

## Import workflow

1. From the game root, inspect `package.json`, `package-lock.json`, the current
   `stealth-steel/vendor/BIS_PROVENANCE.md`, inventory, and the two repository
   statuses. Confirm the adjacent package metadata and requested version.
2. Pack only the integration workspace into the game's vendor directory, using
   a cache inside the game repository so npm does not need the user cache:

   ```powershell
   Set-Location -LiteralPath 'D:\Documents\Projects\VC\Bitcoin\blockchain-integration-service'
   npm.cmd --cache 'D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game\.cache\npm-bis-pack' pack --workspace @bis/integration --pack-destination 'D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game\stealth-steel\vendor'
   ```

3. Inspect the archive before installation. Confirm `package/package.json`,
   the exact `@bis/integration` version, the public `dist`/`src` contents, file
   count, SHA-256, and adjacent BIS `HEAD`. Store the archive as
   `stealth-steel/vendor/bis-integration-<version>.tgz`.
4. Regenerate `stealth-steel/vendor/bis-package-inventory.json` from the
   unpacked archive. It must contain the artifact filename, lowercase SHA-256,
   and SHA-256 values for every packed file. Write JSON as UTF-8 without a BOM
   because `stealth-steel/tools/verify-bis-package.mjs` parses it directly.
5. Update the root dependency to the exact vendored tarball and refresh the
   lockfile. Resolve peer conflicts from the package metadata explicitly; do
   not use `--force` or `--legacy-peer-deps` to hide a mismatch. If React or
   React DOM must advance, make the smallest exact compatible update and run
   the contract typecheck.
6. Update the current section of
   `stealth-steel/vendor/BIS_PROVENANCE.md` with the date, package/version,
   artifact filename, SHA-256, source commit, file count, and verification
   status. Include a concise `Game-consumable public API changes` release-notes
   subsection listing any public BIS API changes from this package that are fit
   for consumption by the game. Preserve historical records below it. This
   release-notes update is performed only during the next explicitly requested
   package import; do not trigger an import merely to prepare these notes.
7. Reinstall from the lockfile. If Vite is running and locks native bundler
   files, stop only the project Vite process, run `npm.cmd ci --ignore-scripts`,
   and restart Vite on its existing localhost port afterward.
8. Verify with:

   ```powershell
   node stealth-steel/tools/verify-bis-package.mjs
   npm.cmd run typecheck:bis-contract
   node --test stealth-steel/src/test/integration/bis-host-game.test.js stealth-steel/src/test/ui/bis-account.test.js
   npm.cmd run build
   ```

   Run the full `npm.cmd test` when practical, but distinguish failures from
   unrelated pre-existing dirty work rather than changing it silently.
9. After the new tarball is installed and `verify-bis-package.mjs` passes,
   remove older `stealth-steel/vendor/bis-integration-*.tgz` files, preserving
   only the currently referenced package. Confirm the lockfile and verifier
   still resolve the retained tarball after cleanup. Do not delete archives
   from the adjacent BIS checkout.
10. Run the game in the existing Vite server and reload the real browser page.
   Confirm normal start without an account, open Settings → Account, verify the
   visible BIS version matches the packed package, and check that no wallet
   action is initiated. Record the live URL and any console/network errors.
11. Finish with a scoped status/diff review. `git diff --check` must pass for
    the files changed by this skill; report unrelated existing whitespace or
    dirty files separately. Report artifact path, version, SHA-256, source
    commit, inventory count, tests, typecheck, build, and browser result.

This skill updates the package only. It does not create another skill, publish
BIS, or commit/push Git history.
