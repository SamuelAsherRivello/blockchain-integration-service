# Tasks

## 1. Create the destination repository

- [x] 1.1 Verify GitHub authentication, `blockchain-presentations` name availability, and the sibling destination path; record the checks without exposing credentials or replacing an existing repository.
- [x] 1.2 Generate a public `SamuelAsherRivello/blockchain-presentations` repository from `SamuelAsherRivello/github-repository-template`, clone it beside BIS, and verify its public visibility, default branch, `origin`, initial commit, and clean starting status.
- [x] 1.3 Read the generated `AGENTS.md` and template checklist, adapt the starter project files and root package for presentations, and verify no unresolved template placeholders or unused starter app paths remain.

## 2. Transfer Slidev source and planning

- [x] 2.1 Inventory and hash tracked, modified, deleted, and untracked Slidev source; classify tracked Slidev `output/` files, and verify the inventory captures `themes/mondrian` and every edited deck or script before copying.
- [x] 2.2 Copy the Slidev workspace to the new repository root without generated caches, dependencies, or temporary reports; compare source inventories and verify all declared decks, local themes, scripts, and assets arrived.
- [x] 2.3 Copy the four teaser screenshots and the BIS sequence diagram into presentation-owned assets, replace their BIS-dependent references, and verify each referenced file exists and renders in the presentation build.
- [x] 2.4 Transfer the accepted Slidev specification and active Slidev OpenSpec changes into the new repository, reconcile their old paths and dependencies, and verify the migrated change/spec inventory matches the BIS source while historical archives remain intact.
- [x] 2.5 Update repository-relative output paths, local documentation, package scripts, and path-specific authoring skill references; verify the supervisor, launcher, and report commands resolve within the new repository.

## 3. Verify and publish presentations

- [x] 3.1 Update the new public build and landing base to `/blockchain-presentations/`, add a Pages workflow using the root package lock, and verify local `npm ci`, layout contract checks, public build, and representative direct-slide asset loads.
- [x] 3.2 Run the new repository's supervised local preview and focused browser checks; verify the landing, declared deck routes, theme/layout behavior, and a direct slide refresh from the sibling checkout without BIS files.
- [x] 3.3 Complete the template checklist and README with verified setup, preview, build, deployment, and a link to `https://samuelasherrivello.github.io/blockchain-presentations/`; verify links and commands against the new checkout.
- [x] 3.4 Commit and push the new repository, run its Pages deployment, and verify the public landing, each declared public deck, representative deep links, and local image assets return their intended content.

## 4. Disconnect BIS publication

- [x] 4.1 Remove Slidev dependency installation and build steps from the BIS Pages workflow and Slidev copying from `BIS/scripts/stage-pages-artifact.mjs`; verify the staged BIS artifact still contains Admin, Marketplace, and immutable root assets.
- [x] 4.2 Snapshot the former public deck and slide routes, stage redirect entries for the old BIS landing, deck roots, numbered slide paths, and hash slide links, and verify each route form preserves its deck and slide destination in the staged Pages artifact.
- [x] 4.3 Link the BIS README and the Stealth & Steel game README's Resources section to the new presentations GitHub repository main page; verify both rendered Markdown links and confirm the game's runtime GitHub destinations are unchanged.
- [x] 4.4 Remove the migrated Slidev source and active Slidev planning copies from BIS after comparing them with the new repository; verify unrelated BIS edits and historical OpenSpec archives remain untouched.
- [x] 4.5 Run BIS build and Pages route verification, publish the BIS and game README changes, and verify public Admin, Marketplace, immutable root assets, README links, and old landing and slide redirects.

## 5. Final integration check

- [x] 5.1 Verify the sibling checkout's `origin`, remote branch tracking, pushed HEAD, public visibility, and empty `git status --porcelain`; report the new repository and Pages URLs with any pre-existing BIS edits left in place.
