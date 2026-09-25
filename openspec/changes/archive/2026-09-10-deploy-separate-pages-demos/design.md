## Context

See proposal.md for the motivation. The Pages workflow currently deploys only `BIS/packages/integration-demo/dist` at the site root, while the root build already produces the Marketplace bundle. Both Vite applications currently use root-relative public resources, which would resolve incorrectly once nested below the repository Pages path.

## Goals / Non-Goals

**Goals:**

- Produce one Pages artifact containing separate Admin and Marketplace directories.
- Give each Vite application a production base path matching its public route while retaining its ordinary local development experience.
- Make the README's public links and release procedure authoritative and testable.

**Non-Goals:**

- Add a custom server, runtime routing layer, account sharing, or cross-demo navigation.
- Change wallet, Arkade, catalog issuance, or Marketplace trading behavior.

## Decisions

### Stage both bundles in a single Pages artifact

The deployment workflow will build the existing workspace packages, copy the Admin production output to `admin/` and Marketplace output to `marketplace/`, retain immutable artwork at `assets/`, then upload the staging directory. GitHub Pages supports one deployed artifact per repository, making this a simple static layout with stable paths. Deploying either package alone or using separate repositories would fragment the existing workspace and release process.

### Configure explicit production bases

The Admin Vite build will use `/blockchain-integration-service/admin/`; Marketplace will use `/blockchain-integration-service/marketplace/`. Source code will use base-aware public paths where a runtime resource is fetched. This preserves relative development URLs while correctly resolving static resources in Pages. A dynamic domain-based router is unnecessary because the repository Pages path is known and stable.

### Preserve immutable root artwork URLs

Existing asset mint metadata refers to root-level Pages artwork URLs. The staging step will copy that versioned artwork to the artifact's `assets/` directory in addition to the Admin's own assets, so those published URLs remain stable. Rewriting issued metadata or redirecting asset paths is not feasible for already-issued records.

### Retire the root demo URL as the documented entry point

The root Pages URL is no longer documented as the playable demo. README exposes only the two labeled routes and requires checking both after deployment. A root landing page is intentionally out of scope; this avoids an invented third UI and keeps the requested two-link release contract unambiguous.

## Risks / Trade-offs

- [A root-relative browser path escapes a demo directory] → Build each app with its production base and add route-level smoke checks against a static staging server.
- [The copied Pages artifact becomes stale or incomplete] → Recreate the staging directory during every workflow run after the workspace build.
- [Local developer URLs become harder to use] → Keep ordinary Vite development commands unchanged and restrict the nested base configuration to production builds.

## Migration Plan

1. Update application base/resource paths and the Pages workflow staging layout.
2. Build both packages and serve the staged artifact locally to check `/admin/` and `/marketplace/`.
3. Update the README and publish the release; GitHub Pages atomically replaces the previous root-only artifact.
4. If deployment fails, the previous Pages artifact remains available until a successful workflow replaces it; restore the prior workflow from a new additive commit if necessary.
