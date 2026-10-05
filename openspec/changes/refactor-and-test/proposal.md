# Proposal

## Why

The current codebase has a large integration composition module, an equally broad standalone-onboarding entry module, and test fixtures that reach through the integration package's private source paths. These seams make behavior-preserving maintenance difficult while package routing, documentation, and verification evidence have drifted during the package rename.

This change modernizes internal structure and verification without changing supported wallet, game, storage, deployment, or public package behavior. It also makes the existing four-destination Vite contract continuously provable for the current package set.

## What Changes

- Establish a refactor verification matrix that runs the existing root suites, standalone prototype suite, typecheck, package builds, and shared-Vite route checks.
- Verify the declared entry behavior for every package with a `package.json`: `/admin/` for `@bis/integration-admin`, `/marketplace/` for `@bis/marketplace`, `/onboarding/` for `@spike/prototype-onboarding`, and the rendered README at `/integration/` for the library package.
- Decompose private responsibilities inside `@bis/integration`'s context composition without changing its public exports, state shapes, storage namespaces, wallet behavior, or host contracts.
- Move demo-only white-box fixtures away from private cross-package source imports where practical; retain focused internal tests inside the integration package.
- Split the standalone onboarding entry into private lifecycle and rendering seams while preserving its direct Arkade ownership, browser persistence, window isolation, URL semantics, and settlement/recovery behavior.
- Remove confirmed generated debris and repair documentation/configuration references that no longer identify checked-in sources.
- Add maintainability checks incrementally, without a broad formatting rewrite, dependency upgrade, framework migration, or public API redesign.

## Capabilities

### New Capabilities

None. This is an internal refactor, tooling, and documentation change. The existing `multi-package-development` delta already defines the shared Vite behavior that this change will verify.

### Modified Capabilities

None. Existing requirements, including `standalone-boarding-spike`, `story-driven-demo`, and `pages-demo-deployment`, remain unchanged.

## Impact

- Affected code: the integration context composition and its tests, integration-admin fixtures, prototype-onboarding private entry composition, root test/development checks, and documentation/configuration references.
- Public APIs: no intended changes to `@bis/integration` exports, package names, browser storage, URL contracts, or published Admin/Marketplace Pages routes.
- Dependencies: no upgrades or new runtime dependencies are in scope. Any framework, Vite, React, TypeScript, or Arkade SDK upgrade remains a separate migration.
- Verification: the shared Vite server must prove all four current destinations respond with the expected package-specific content; the integration library continues to use its README rather than a browser application entry point.
- Unresolved baseline issue: `openspec/config.yaml`, repository guidance, and documentation reference project-brief/design-discussion files absent from this checkout. Implementation must determine whether to restore the authoritative sources or replace each stale reference with their confirmed successor before treating documentation as synchronized.
