# Proposal

## Why

The same production BIS views currently render with different typography and label treatment depending on whether they are hosted by Admin, a game, or Marketplace. The screenshot-confirmed differences—such as uppercase, letter spacing, and weight changes in `Accounts Details` field labels—make one BIS UI appear to be multiple products and show that host CSS can leak into BIS internals.

The BIS UI needs a clear styling boundary now so that reusable production views preserve one visual contract across all supported hosts while hosts remain free to position the UI in their own layouts.

## What Changes

- Establish a durable BIS visual-style isolation contract for production views rendered from `@bis/integration`.
- Make BIS-owned typography and presentation properties deterministic across Admin, game, and Marketplace hosts, including casing, font family, size, weight, line height, letter spacing, color, alignment, and component spacing.
- Prevent host-owned CSS from re-theming or re-typographing `.bis-*` descendants; host styling remains limited to documented mounting and placement behavior.
- Remove or revise Marketplace rules that directly target BIS internals, including rules affecting `.bis-copy-field-heading`.
- Add cross-context verification for representative BIS views, including `Accounts Details`, to detect style drift between Admin, game-host fixtures, and Marketplace.
- Preserve host-specific placement, launcher visibility, responsive sizing, accessibility behavior, and BIS functionality.

## Capabilities

### New Capabilities

- `bis-ui-style-isolation`: Defines the invariant visual presentation of production BIS views and the boundary between BIS-owned styling and host-owned placement styling.

### Modified Capabilities

- None.

## Impact

- Affected implementation: `BIS/packages/integration/src/client/ui-layer-react/overlay.css` and related BIS UI components, Marketplace host styles, Admin host integration, and game-facing test fixtures.
- Affected verification: production UI tests and new cross-context style assertions or visual fixtures.
- No public business API or wallet behavior changes are intended.
- No new runtime dependency is currently proposed. Shadow DOM remains an unresolved alternative; the design should first evaluate a scoped BIS style boundary and explicit property ownership before adopting stronger encapsulation.
