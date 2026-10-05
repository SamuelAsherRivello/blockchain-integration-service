# Design

## Context

The Admin and documentation pages are separate Vite HTML entries in the integration-demo package. The Admin build is published beneath `/blockchain-integration-service/admin/`, while development uses `/`. The documentation React entry imports `BIS/documentation/User Story Diagrams.md` as a Vite raw module, which is served through an internal `@fs` request.

## Goals / Non-Goals

**Goals:**

- Make Admin navigation independent of the browser's current nested pathname.
- Preserve one local Markdown source of truth during development.
- Emit the documentation HTML entry alongside the Admin build.
- Keep legacy public URL compatibility without breaking Vite source loading.

**Non-Goals:**

- No changes to story content, numbering, or documentation rendering semantics.
- No new dependency, server, API, wallet behavior, or deployment provider.
- No manual synchronization or copied Markdown artifact in the development workflow.

## Decisions

- Use Vite's active `BASE_URL` when constructing the Admin link. This gives `/documentation/user-stories/` in development and the deployed Admin-prefixed route in production. A path relative to `window.location` was rejected because repeated navigation or nested routes can append duplicate segments.
- Declare the documentation `index.html` as an additional Vite build input. This keeps the production entry colocated with the Admin artifact and avoids relying on a separate manual copy step.
- Keep the React raw import pointed at the repository's user-story Markdown. This preserves live working-tree updates in Vite development and avoids a second documentation source.
- Exclude `/@fs/` requests from the legacy-file redirect condition. The redirect remains available for the old public documentation path, while Vite's internal raw-module request is allowed to return its source content.
- Verify both source-level behavior and the browser-visible route: focused tests cover route/source loading, the production build checks for the emitted documentation entry, and browser verification checks that headings render with no console errors.

## Risks / Trade-offs

- [Risk] A deployment host may serve unknown nested paths through an SPA fallback → Mitigation: emit an explicit `documentation/user-stories/index.html` entry under the Admin artifact and verify its output path.
- [Risk] Redirect compatibility could accidentally intercept another Vite internal request → Mitigation: scope the exclusion specifically to `/@fs/` and retain a regression test for the legacy public URL.
- [Risk] Working-tree Markdown can contain links to files not copied into the demo artifact → Mitigation: preserve existing link behavior and keep this change limited to the entry/link contract; related asset hosting remains outside scope.
