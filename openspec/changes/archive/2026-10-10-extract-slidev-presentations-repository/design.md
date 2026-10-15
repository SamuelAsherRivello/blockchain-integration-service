# Design

## Context

See [proposal.md](proposal.md). `BIS/documentation/slidev` is a separately locked npm package, but its public build is invoked from BIS `.github/workflows/deploy-pages.yml` and copied by `BIS/scripts/stage-pages-artifact.mjs`. Public build scripts hard-code `/blockchain-integration-service/slidev`; preview and report scripts climb three directories to the BIS `output/` root. Four teaser slides reference screenshots through raw BIS GitHub URLs. The root BIS README links to the current Pages landing.

The Slidev migration inventory captured 470 tracked files, including 259 source files and 211 generated files under `output/`. It includes 43 `themes/mondrian` files and reports no modified, deleted, staged, or untracked Slidev files as of 2026-10-08. Three active Slidev OpenSpec changes remain in BIS. The template repository has its own starter app, Pages workflow, README, `AGENTS.md`, and usage checklist; these need deliberate adaptation rather than coexisting as an unrelated starter app. Local `gh auth status` currently reports an invalid token, so GitHub creation and push require working authentication at apply time.

## Goals / Non-Goals

**Goals:**

- Make a fresh checkout of `blockchain-presentations` sufficient for building, running, and publishing the decks.
- Preserve the current Slidev source state and accepted/active presentation planning without absorbing unrelated BIS changes.
- Keep BIS Admin, Marketplace, and root asset URLs working through the extraction.
- End with a sibling presentations checkout whose tracked source matches its remote and whose working tree is clean.

**Non-Goals:**

- Change deck content, layout semantics, wallet functionality, or the BIS public package API as part of the move.
- Move historical archived BIS OpenSpec changes or remove BIS screenshots that BIS itself still uses.
- Change the game's runtime GitHub buttons or move unrelated game code.

## Decisions

### Use the GitHub template flow, then replace the starter application

Generate the public repository from `SamuelAsherRivello/github-repository-template`, clone it beside BIS, inspect its actual `AGENTS.md` and checklist, and adapt its root package, workflow, README, and placeholder app to the Slidev workspace. Verify its initial history and `origin` before project edits. This follows the requested template provenance and avoids retaining a second, unused Vite application. A plain folder copy into an empty repository would lose that provenance; keeping the template starter would leave conflicting commands and deployment paths.

### Make the Slidev workspace the new repository's runnable project

Place the existing Slidev package contents at the new repository root, preserving internal `assets/`, `public/`, `themes/`, `launcher/`, `setup/`, `components/`, `scripts/`, deck Markdown, and package lock relationships. Adapt repository-root `output/` resolution instead of relying on the old `BIS/documentation/slidev` depth. Keep local manifest routes such as `/slidev/<deck>/<slide>` and the port-3032 launcher; only the public Pages base changes to `/blockchain-presentations/`. Copy the four referenced BIS screenshots into presentation-owned assets and change those slide references to local paths. `SharedBisSequenceDiagram.vue` also imports `BIS/documentation/diagrams/bis-sequence-diagram-2.png` from outside the Slidev package; copy that diagram into the new repository and retarget the import. Shared image layouts resolve `./assets/` media against Slidev's configured deck base so numbered deep links load images. Retain intentional external links to BIS and the game as links.

### Transfer source and planning with an explicit inventory

Capture a path inventory and hashes of all tracked, modified, deleted, and untracked Slidev source before copying. Exclude generated `dist/`, `node_modules/`, and temporary `output/` data; inspect any currently tracked Slidev `output/` files before deciding whether they are canonical assets or stale evidence. Copy the working tree state, including the new `themes/mondrian` files, then compare source inventories before deleting the BIS copy. Transfer `openspec/specs/slidev-theme-layout-contract` and the active `add-games-subdeck`, `harden-slidev-live-preview`, and `update-url` changes to the new repo's OpenSpec root, adapting paths and dependencies. Keep archived BIS changes as history and leave a short pointer in BIS documentation. Reconcile any concurrent edits before removal.

### Separate deployment, then switch repository links

Give the presentations repository its own Pages workflow that installs from its root lockfile, runs presentation checks and `build:public`, and publishes the resulting site under the repository Pages base. Its README points to that published landing. Validate the landing and representative direct slide routes, including images, before switching links. Then remove Slidev-specific install/build/copy steps from BIS's Pages pipeline. Link both the BIS README and the game README's Resources section to the new GitHub repository main page; leave the game's runtime buttons unchanged. Keep the BIS artifact's `admin/`, `marketplace/`, and immutable root `assets/` paths unchanged. A new site first avoids a gap where repository readers reach an empty destination.

### Preserve old public Slidev links

Before removing the old build, snapshot the currently published public deck identifiers and slide counts. BIS stages static redirect entries for the former `/slidev/` landing, each published deck root, and each previously published numbered slide path. Deck-root redirect pages also inspect the historical `#/N` route and forward to slide N. The redirect destination is the matching `/blockchain-presentations/<deck>/<slide>/` path, with any harmless query string retained. This small static compatibility artifact is independent of Slidev's runtime and source files. Tests exercise the landing, deck root, numbered slide, and hash forms on the staged BIS Pages artifact.

### Finish with reproducible Git state

Commit and push the migration in the new repository, then verify remote visibility, `origin`, branch tracking, and `git status --porcelain` in the sibling checkout. Commit and push BIS extraction changes only as authorized by the apply request and the project's Git workflow. The requested clean state applies to the new sibling checkout; unrelated pre-existing BIS edits must be preserved rather than swept into migration commits.

## Risks / Trade-offs

- [Invalid GitHub CLI authentication or repository name collision] → Check authentication and name before generation; stop external creation on conflict, while retaining the prepared local plan.
- [Dirty Slidev checkout loses source during move] → Inventory first, copy and compare before removal, and never clean/reset the source tree as a migration shortcut.
- [Template starter files or instructions conflict with Slidev] → Read the generated instructions, use its checklist, and replace placeholders and irrelevant app code before the first migration commit.
- [Legacy redirect inventory misses a published deck or slide] → Snapshot the public manifest and build outputs before extraction, generate one redirect entry per existing route, and verify representative path and hash forms in the staged and public BIS Pages artifacts.
- [Published media or base paths resolve incorrectly] → Test a fresh checkout, local preview, staged Pages artifact, direct slide refreshes, and public Pages routes before declaring completion.
- [BIS release regression] → Run its existing build and Pages route checks and verify the Admin and Marketplace public routes after deployment.

## Migration Plan

1. Restore valid GitHub authentication, confirm the target name is free, and generate/clone the public template repository to the sibling path without overwriting an existing directory.
2. Record the dirty Slidev inventory, copy the complete source and active planning state, adapt template files and repository-relative paths, and verify the new repo builds and previews from a fresh checkout.
3. Commit/push the new repository and deploy its Pages site. Verify landing, deck deep links, and media on the public URL.
4. Remove the Slidev workspace and build dependency from BIS, stage landing and deep-link redirects, update the BIS and game READMEs, and verify the two BIS demos and immutable assets. Publish both documentation changes after the new site is live.
5. Verify the sibling presentations checkout is clean and synchronized; report any BIS or game edits left untouched because they predated the migration.

If the new site fails before the BIS switch, keep the BIS deployment unchanged. If the BIS switch fails, restore its previous Slidev build/staging commit while the new repository remains available; do not delete the new repository or its history.
