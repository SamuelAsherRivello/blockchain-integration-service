# Proposal

## Why

BIS currently replaces navigable views immediately, making movement between account screens feel abrupt and making it difficult to perceive that a Back action has closed one view and revealed another. A small, consistent transition would make the existing navigation easier to follow without changing wallet behavior, view content, or navigation destinations.

## What Changes

- Add a shared BIS view-transition capability for navigable screens and nested detail screens.
- Animate view entry from 80% scale and 0% opacity to 100% scale and 100% opacity over 100ms.
- Animate view exit from 100% scale and 100% opacity to 80% scale and 0% opacity over the same duration when a view closes or navigation moves away from it.
- Declare transition duration, scale endpoints, and timing behavior in one shared styling location so the motion can be tuned centrally.
- Apply the transition to the Account chooser, account menu, Account Details, Developer, Onboarding, Send, Receive, Swap, Restore Account, recovery screens, logout confirmation, Game Wallet Login, Assets, Asset Detail, Contracts, Contract Detail, Transactions, Transaction Detail, and the Pending Operation dialog.
- Keep ordinary loading/content updates, the Account entry button, dropdown menus, recovery toggles, and toast notifications free of the full view transition.
- Preserve focus management, keyboard interaction, pointer behavior, and existing Back/navigation semantics while an enter or exit transition is running.
- Respect `prefers-reduced-motion` by reducing or removing the visual animation.

## Capabilities

### New Capabilities

- `bis-view-transitions`: Consistent, centrally configurable enter and exit transitions for BIS navigable views and supported modal surfaces.

### Modified Capabilities

None.

## Impact

- Affected production UI rendering and lifecycle code in `BIS/packages/integration/src/client/ui-layer-react`, especially shared view composition in `client.tsx`.
- Affected shared BIS styling in `overlay.css`.
- New or updated UI tests will verify animated mounting/unmounting behavior, central transition configuration, reduced-motion behavior, and unchanged navigation/focus semantics.
- No public wallet API, persistence schema, Arkade integration, or transaction behavior changes are intended.
