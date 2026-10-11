# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The shared development server currently discovers browser packages through `BIS/scripts/dev-config.mjs`, and Prototype Faucet already provides the title-bar styling, network definitions, and network-switch interaction to mirror.

## Goals / Non-Goals

**Goals:**

- Add a self-contained `prototype-sandbox` workspace package with one reusable React shell.
- Make ten dedicated demo URLs resolve through the shared Vite development server.
- Keep the header and network selector visually and behaviorally aligned with Prototype Faucet.
- Keep navigation accessible, horizontal, and explicit about the active demo.
- Verify direct loading and cross-demo navigation in a browser.

**Non-Goals:**

- No Faucet API calls, wallet operations, Arkade boarding, or demo-specific business logic.
- No changes to Prototype Faucet behavior or reusable BIS product APIs.
- No production deployment, authentication, persistence, or shared demo state.

## Decisions

### One shared React shell with path-derived active demo

The package will use one React entry and derive the active demo from the pathname. This preserves ten independently addressable pages without duplicating title and navigation markup. A dedicated physical HTML file per demo was considered, but would duplicate bootstrap configuration without adding observable behavior.

### Reuse existing prototype styles and network configuration

The Sandbox will import the established prototype UI stylesheet and the Faucet network definitions. Its selector will use the same Signet/Mutinynet options and confirmation behavior, but no network selection will trigger data fetching because the shell has no network-specific content.

### Use native links with an explicit disabled active control

Navigation will render native links for inactive demos and a disabled button for the active demo. This gives keyboard and browser semantics that match the requirement: inactive demos are actionable links, while the current demo cannot be reselected.

### Register one package route with explicit nested entry documents

The shared Vite router will register `/prototype-sandbox/`; each Demo 1–Demo 10 directory contains a small HTML entry document that boots the same React shell. This follows the existing package route convention and avoids asking the Vite middleware to reinterpret a nested URL as a different HTML transform request.

## Risks / Trade-offs

- [The shared server may treat nested paths as missing files] → Add explicit nested entry documents and verify all ten URLs through the running server.
- [Reused Faucet styles may inherit unrelated page layout rules] → Keep Sandbox-specific CSS narrowly scoped and inspect the rendered page with Playwright.
- [A browser refresh could lose the selected network] → Treat network selection as local page state only; no persistence is required for the initial empty demos.

## Migration Plan

1. Add the package, shared entry, styles, and package README.
2. Add the package route to the shared Vite configuration.
3. Run the repository's browser preview and verify all ten routes plus navigation.
4. Roll back by removing the package and its single route entry; existing packages remain unchanged.
