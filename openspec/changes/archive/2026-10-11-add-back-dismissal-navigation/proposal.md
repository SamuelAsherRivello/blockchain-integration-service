# Proposal

## Why

BIS views that already provide a Back action require an extra trip to a small control when the user is using a keyboard or clicking outside the card. A consistent, opt-in “back dismissal” interaction would make those views quicker to leave while preserving the explicit navigation contract of entry, loading, error, and other non-back surfaces.

## What Changes

- Add an explicit boolean capability for each BIS view indicating whether back dismissal is allowed.
- When the active view opts in, pressing Escape or clicking the surrounding backdrop invokes the same Back handler as the visible Back action.
- Keep backdrop clicks inside the active card from navigating back.
- Mark views with an existing Back action as enabled after manually reviewing their current navigation behavior; keep loading, error, and other views without a cancel/back destination disabled.
- Preserve busy-state protections, nested list/detail navigation, focus restoration, pending-operation coverage, and existing Back destinations.
- Add automated coverage for enabled and disabled views, Escape handling, backdrop-versus-card clicks, and duplicate/back actions during transitions or busy operations.

## Capabilities

### New Capabilities

- `back-dismissal-navigation`: Opt-in keyboard Escape and backdrop-click behavior that delegates to a BIS view’s existing Back navigation.

### Modified Capabilities

- None. The behavior is isolated as a new opt-in capability and does not replace any existing navigation requirement.

## Impact

- Affected production UI: `BIS/packages/integration/src/client/ui-layer-react`, especially the shared account view shell and collection/detail views.
- Affected tests: BIS integration browser/component fixtures and navigation-focused tests.
- No public wallet, Arkade, game-facing, or persistence API changes are expected.
- The change is additive for eligible views but changes how Escape and backdrop clicks behave on those views; view-level opt-in is required to avoid changing loading, error, and non-navigable surfaces.
