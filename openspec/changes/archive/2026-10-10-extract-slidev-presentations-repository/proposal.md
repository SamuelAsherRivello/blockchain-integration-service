# Proposal

## Why

Slidev decks and authoring tools currently live inside the BIS repository, and the BIS Pages workflow installs and publishes them as part of every demo release. A dedicated public repository will let presentations evolve and deploy independently while keeping the BIS application release focused on Admin and Marketplace.

## What Changes

- Create public `SamuelAsherRivello/blockchain-presentations` through the GitHub template-generation flow using `SamuelAsherRivello/github-repository-template`.
- **BREAKING** Move the Slidev source, local themes, media, launcher, scripts, tests, and documentation into the new repository; transfer the current uncommitted Slidev work without losing it. Transfer active Slidev OpenSpec changes and the accepted Slidev spec to the new repository while keeping historical BIS archives in BIS.
- Publish the presentations from the new repository at `https://samuelasherrivello.github.io/blockchain-presentations/`, retaining the existing local authoring routes and deck behavior. Replace hard-coded BIS public bases and repository-relative output paths.
- Remove Slidev installation, build, and artifact staging from the BIS Pages workflow. Keep Admin, Marketplace, and their immutable root asset URLs intact. Link the BIS and Stealth & Steel game READMEs to the new GitHub repository, and link the presentations README to its Pages landing page; leave the game runtime GitHub buttons unchanged.
- Redirect the former BIS `/blockchain-integration-service/slidev/` landing and its published deck and slide URLs to corresponding routes on the new Pages site, retaining slide positions.
- Check out the new repository beside BIS on the local machine and finish with its working tree clean and synchronized with its public remote.

## Capabilities

### New Capabilities

- `slidev-public-deployment`: The independent presentations repository owns its public build and Pages route, provides working deck links and assets, and gives existing BIS presentation visitors a route to the new site.

### Modified Capabilities

None. The existing `pages-demo-deployment` requirements for Admin and Marketplace and `slidev-theme-layout-contract` requirements for layouts and local previews remain in force.

## Impact

- `BIS/documentation/slidev/` and its local package lock, assets, theme, preview launcher, scripts, and tests; selected `docs/images/` images used by the decks.
- New repository template files, instructions, npm commands, and GitHub Pages workflow; local checkout at `D:/Documents/Projects/VC/Bitcoin/blockchain-presentations`.
- BIS `.github/workflows/deploy-pages.yml`, `BIS/scripts/stage-pages-artifact.mjs`, root `README.md`, the game repository's root `README.md`, and any source or skill references that assume the former Slidev path.
- Existing open Slidev OpenSpec changes (`add-games-subdeck`, `harden-slidev-live-preview`, `update-url`) and current uncommitted edits require an explicit transfer/reconciliation check during implementation.
