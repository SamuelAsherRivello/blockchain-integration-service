## Why

The current GitHub Pages deployment publishes only the Admin demo at the site root, despite the workspace now containing a public Marketplace. Releases need stable, clearly labeled links for both independently usable demos.

## What Changes

- Publish the BIS Admin demo at `/admin/` and the BIS Marketplace at `/marketplace/` under the existing GitHub Pages site.
- Build and stage both Vite applications into one GitHub Pages artifact on every deployment.
- Make browser asset, catalog, documentation, and navigation paths work from their published subdirectories.
- Retain the existing root-level immutable artwork URLs used by issued asset metadata while moving only the two browser applications to their named subdirectories.
- Replace the single README demo link with clearly labeled Admin and Marketplace links, and document the release verification of both URLs.

## Capabilities

### New Capabilities

- `pages-demo-deployment`: Publish and document the two independently accessible BIS browser demos from a single GitHub Pages site.

### Modified Capabilities

- `marketplace-catalog`: Require the standalone Marketplace to remain usable when it is hosted at its public GitHub Pages subdirectory.

## Impact

- Affected systems: root build scripts, the GitHub Pages workflow, the Admin and Marketplace Vite configuration and public-path usage, and README release documentation.
- No public integration API, Arkade behavior, wallet handling, dependency, or hosting-provider change is proposed.
