# Proposal

## Why

The root development command starts separate Admin and Marketplace servers and omits the standalone spike and integration library. The user wants one Vite server with four destinations and package documentation that is easy to navigate from the main README.

## What Changes

- Run a single Vite development server with `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/` destinations.
- Serve the three existing browser applications; render the integration package README for the library destination instead of creating a new Account UI.
- Organize the main README's Packages section into External Packages (existing links) and Internal Packages (one README link per package). Ensure all four package READMEs explain their role and link back to the main README.
- Update the documented `run vite` agent workflow to verify and return all four URLs, using the existing remote server port 5174 and Windows tunnel port 15174.
- Preserve separate package builds and the existing two-demo GitHub Pages release contract. This change serves development previews; it does not publish a release.

## Capabilities

### New Capabilities

- `multi-package-development`: One development server, three app entry points, one README entry point, and the documented four-URL handoff.

### Modified Capabilities

None. Existing application behavior and production Pages deployment requirements remain in force.

## Impact

Root development scripts/configuration, package entry HTML and base-sensitive development asset URLs, README files, and AGENTS.md. Existing React Markdown dependencies can render local documentation. No wallet API or storage namespace changes; Admin and Marketplace now share the same browser origin and retain existing storage semantics. Existing data at other ports is not migrated automatically.
