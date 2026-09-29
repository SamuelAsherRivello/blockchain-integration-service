# Design

## Context

See proposal.md for motivation. The root script currently spawns two workspace servers. Three packages have HTML entry points and public assets; integration is a library. Admin has additional book and documentation HTML entries. Package build configs provide GitHub Pages bases and must continue to work independently.

## Goals / Non-Goals

**Goals:** One Vite instance with development routing and source updates; browsable package documentation with working relative links; explicit remote preview handoff.

**Non-Goals:** New wallet UI, wallet storage migrations, production release, new deployed Pages routes, or changes to the integration public API.

## Decisions

- Create a shared development configuration rooted at the repository and a small Vite plugin mapping the three app prefixes to their existing entry files and public assets. Use Vite's HTML transformation and normal module pipeline. This avoids a reverse proxy backed by multiple Vite instances.
- Keep workspace build configs and optional independent workspace dev commands. Adjust absolute HTML script paths to relative paths, and provide app-specific development bases where application code fetches public resources. Preserve production base behavior.
- Render local README Markdown using existing React/React Markdown dependencies, with relative links resolved from the source README directory. The integration route renders the library README without loading wallet code. Reuse and augment the existing package READMEs and add the missing Marketplace README.
- Retain port 5174 with strict port behavior and loopback binding. Root `npm run dev` starts and prints the four URLs. AGENTS.md specifies remote availability verification and the established 15174 SSH tunnel handoff.
- Preserve origin-scoped BIS account storage. Admin and Marketplace share that origin; the spike keeps its existing standalone/window namespace. Do not silently copy wallet data from historical ports.

## Risks / Trade-offs

- Public asset or entry collisions -> map package prefixes before normal Vite handling; verify HTML, module loading, catalog JSON, documentation, images, and missing paths.
- README links use repository paths -> render with an explicit source-directory base and allow only known README entry files for rendering; preserve Vite raw imports.
- Origin consolidation exposes existing shared wallet semantics -> document that same-origin BIS apps share stored accounts and that old-port data remains on its original origin.
- Production regression from path adjustments -> run typecheck and package builds; preserve public Pages destinations and immutable asset paths.

## Migration Plan

Implement and verify with an isolated test port/browser context, then document the normal 5174 server and 15174 remote tunnel. No release or wallet migration is performed. Reverting the scoped development configuration/script and path adjustments restores independent servers.
