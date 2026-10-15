# Proposal

## Why

The existing Prototype Faucet is a useful visual and network-selection baseline, but it is a single-purpose page. A separate Prototype Sandbox will provide a stable home for a sequence of small, independently addressable demos without mixing future experiments into the Faucet workflow.

## What Changes

- Add a sibling `prototype-sandbox` workspace package next to `prototype-faucet`.
- Add ten independently bookmarkable demo entry points: Demo 1 through Demo 10.
- Give every demo the same Faucet-style title bar, including the exact `BIS - Prototype Faucet` title and functional Signet/Mutinynet network selector.
- Add a shared horizontal `Navigation` component with buttons for Demo 1 through Demo 10.
- Make the active demo navigation item non-interactive while the other items navigate to their dedicated demo routes.
- Keep the initial demos intentionally empty below the shared title bar and navigation.
- Register the package in the shared Vite development router without changing product package APIs or Faucet behavior.
- Add package documentation and browser verification for all ten routes and navigation behavior.

## Capabilities

### New Capabilities

- `prototype-sandbox-navigation`: A development-only multi-entry demo shell with a shared Faucet-style header and navigation between ten standalone demos.

### Modified Capabilities

None.

## Impact

- Adds `BIS/packages/prototype-sandbox/` and its workspace metadata.
- Updates shared Vite package routing and development entry discovery.
- Reuses the existing prototype UI styling and Faucet network configuration without adding Faucet API calls or Arkade operations.
- Adds browser tests or Playwright verification for direct demo loading, active-item disabling, and cross-demo navigation.
- Existing working-tree changes outside this change remain out of scope.
