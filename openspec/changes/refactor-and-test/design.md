# Design

## Context

See [proposal.md](proposal.md) for motivation. The current package set is `@bis/integration`, `@bis/integration-admin`, `@bis/marketplace`, and `@spike/prototype-onboarding`. The shared Vite configuration maps the three browser applications to `/admin/`, `/marketplace/`, and `/onboarding/`; it intentionally renders the integration package README at `/integration/` because the library has no standalone application.

`createContext` in `BIS/packages/integration/src/client/state-layer-core/context.ts` currently composes account, onboarding, transfer, asset, send, contract, subscription, toast, and administrative behavior in one module. The prototype's `src/main.js` similarly coordinates browser DOM state with asynchronous onboarding and recovery work. Integration-admin fixtures currently depend on implementation paths under `@bis/integration`.

## Goals / Non-Goals

**Goals:**

- Make the four existing package destinations and package production builds mechanically verifiable.
- Reduce the size and coupling of private composition roots while preserving their behavior and public contract.
- Make test ownership reflect package boundaries without weakening focused white-box coverage.
- Remove only artifacts proved to be generated and unreachable, and resolve or accurately mark stale documentation references.

**Non-Goals:**

- Changing wallet, Arkade, Signet, persistence, URL, host-game, or published Pages behavior.
- Adding a fifth shared-server destination, restoring a retired package, or treating non-package utility folders as packages.
- Replacing the direct-SDK prototype with the integration library.
- Dependency, framework, TypeScript, Vite, React, or Arkade SDK upgrades; lint-driven formatting churn; public API redesign; or live funded acceptance.

## Decisions

### Treat package manifests as the route-verification inventory

The verification inventory is every immediate `BIS/packages/*` directory with a `package.json`. Each application package is checked through its existing shared-server route; the integration library is checked through its documented README route and production library build. Folders without a manifest, including tool-owned hidden folders, are not package entry points.

This matches workspace ownership and preserves the established four-destination development contract. A filesystem-wide HTML scan was rejected because it would accidentally elevate test fixtures, documentation pages, and non-package experiments into supported routes.

### Add a hermetic shared-Vite route check before structural movement

Introduce a test that starts the existing shared development configuration on an isolated loopback port, requests each declared destination and expected package-specific content, and asserts an unknown nested application path is not served as a different application. It shall shut the server down in all outcomes and write no wallet data or secrets.

The route check supplements rather than replaces independent package builds: Vite development routing and production build bases protect different failure modes. Browser rendering remains a focused manual/Playwright concern where HTTP checks cannot establish layout or wallet behavior.

### Preserve `BisContext` as the stable facade

Keep `createBisContext`, its exported state/event types, and returned `BisContext` methods stable. Split private construction into feature-oriented coordinators with explicit dependency objects: session/account lifecycle, read/subscription synchronization, wallet mutations, and Admin-only controls. The existing factory injection seams remain available to internal tests.

This is preferred over a new public service layer because consumers already depend on the current package entry point. A public `BisHostGame` or replacement facade would be an intentional major-version migration and is out of scope.

### Keep white-box tests package-local

Move or duplicate only test fixtures that need integration internals so they execute within `BIS/packages/integration/tests`. Cross-package integration-admin tests should use public exports and browser-visible behavior. A new public testing export is deferred: it would enlarge the supported API and needs a separate compatibility decision.

### Separate prototype orchestration from DOM wiring without altering its boundary

Extract private lifecycle coordination and rendering/event wiring from the prototype entry in small behavior-sliced passes. Preserve the prototype's independent local storage, per-window URL scope, recovery cleanup, and direct Arkade adapter ownership. Do not move the implementation into `@bis/integration` or change its browser data schema.

### Make cleanup evidence-led

Remove only generated artifacts that are tracked, no longer imported, and can be regenerated. Documentation work must first identify whether the missing project brief/design discussion should be restored from authoritative repository history or whether references should be revised to a checked-in successor; it must not invent a replacement design baseline.

## Risks / Trade-offs

- [Composition extraction changes async ordering or cleanup] -> preserve the facade and injection seams, extract one feature slice at a time, and run targeted lifecycle tests after each slice.
- [A test-boundary cleanup accidentally expands the public API] -> relocate white-box fixtures first; add a test API only through a distinct proposal.
- [Vite route tests mask browser failures] -> assert distinctive HTML/content and retain package builds plus browser verification for UI-sensitive work.
- [Prototype refactor disrupts storage or recovery] -> retain keys/schema and prove reload, duplicate-window, interrupted-operation, and no-duplicate-submission behavior through its existing suite and focused browser checks.
- [Concurrent work overlaps refactored files] -> inspect the working tree and active OpenSpec change scopes before each pass; preserve unrelated edits and split conflicted work into a follow-up change.
- [Missing design source cannot be resolved safely] -> record the limitation and leave references unchanged until the authoritative source is supplied or found.

## Migration Plan

1. Establish the verification matrix and capture a clean baseline before touching a composition root.
2. Apply the integration context extraction in independently reviewable slices, followed by test-boundary relocation.
3. Refactor the prototype only after its independent test and route checks are part of the matrix.
4. Complete evidence-led cleanup and documentation reconciliation, then run the complete matrix and OpenSpec validation.

Every extraction is revertible as an internal file move/adapter rollback. No storage migration, network migration, or release is part of this change.
