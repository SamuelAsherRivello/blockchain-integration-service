# Proposal

## Why

The Admin panel's Documentation link did not reliably open the user-story documentation. Relative URL resolution could append the documentation path repeatedly under the Admin base, while the Vite development redirect middleware intercepted the documentation page's own raw Markdown import and produced a blank page. The demo needs one navigation contract that works in development, in the `/admin/` deployment, and against the latest local working-tree Markdown.

## What Changes

- Make the Admin Documentation link base-aware so it resolves from Vite's active `BASE_URL` instead of the current browser path.
- Serve the documentation as an explicit Vite HTML entry in production builds under the Admin deployment tree.
- Keep the documentation page backed by the local `BIS/documentation/User Story Diagrams.md` source through its Vite raw import, so local edits appear without a manual copy or separate documentation build.
- Prevent legacy URL redirects from intercepting Vite's internal `@fs` raw Markdown import while retaining redirects for the legacy public documentation URL.
- Add regression coverage for the link source, documentation route, raw Markdown loading, and emitted documentation entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: Require the Admin Documentation link to resolve correctly in development and production while rendering the current bundled/local user-story Markdown source without a stale copied artifact.

## Impact

- `BIS/packages/integration-demo/src/admin/AdminPanel.tsx` URL construction.
- `BIS/packages/integration-demo/vite.config.ts` documentation entry and redirect middleware.
- `BIS/packages/integration-demo/tests/documentation.test.mjs` and related Admin regression coverage.
- No public integration API, wallet behavior, dependency, or user-story numbering changes.
