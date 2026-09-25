## Context

See [proposal.md](proposal.md) and the `marketplace-catalog` delta for the behavior being changed. Marketplace composition currently spans the base stylesheet, legacy `square-grid.css`, account-launcher and resource styles, and the Marketplace redesign stylesheet. Legacy fixed dimensions and breakpoint-oriented tests compete with the newer fluid rules, which makes the result too large at the measured browser viewport.

## Goals / Non-Goals

**Goals:**

- Make Marketplace sizing coherent as one local fluid system.
- Preserve the existing two-column page composition: wallet/instructions sidebar beside catalog, with a grid of catalog cards.
- Treat CSS viewport dimensions as the layout input and verify the user's measured 1138 by 590 CSS-pixel viewport.
- Capture the reusable sizing principles in this change without changing another product surface.

**Non-Goals:**

- Reworking Marketplace content, filters, asset data, checkout, or the Account dialog.
- Adding a design system dependency, a device-pixel-ratio branch, or viewport width/height media queries.
- Applying these styles to Admin, the game, or another non-Marketplace page.

## Decisions

### One Marketplace-owned fluid sizing layer

Consolidate Marketplace page sizing in its Marketplace-owned stylesheet so it wins consistently over legacy card and shell rules. Use a small set of coordinated spacing, type, artwork, card, and control values rather than independently scaling each element.

This is preferred to tuning each old file in place because cascade order currently lets fixed legacy sizes re-expand the presentation. A global stylesheet rewrite is rejected because the work is intentionally Marketplace-only.

### Available-space layout primitives, not breakpoint branches

Use flex wrapping for the page columns, auto-fit/minmax grid tracks for catalog cards, and bounded fluid values such as `clamp()` for dimensions. Keep required content in the normal document flow and permit document scrolling when it cannot fit.

This is preferred to viewport media queries because Windows display scaling and browser chrome alter the CSS-pixel viewport independently of the user's browser zoom. JavaScript `devicePixelRatio` handling is rejected because it diagnoses physical density, not the space available to the layout.

### Compact 1138 by 590 reference composition

Use the user's Chrome measurement as the primary visual acceptance viewport. At that size, reserve distinct header regions for the Signet label, resources, and Account entry; reduce title, sidebar, toolbar, artwork, and card density together; retain the first catalog row in the visible initial page; and present three square catalog cells across that row.

This is a reference composition rather than a special breakpoint. Narrow and intermediate viewports continue to use the same fluid rules and document scroll instead of clipping or element overlap. Square card cells preserve an equal visual rhythm while their internal content uses flexible spacing and text wrapping.

### Tests verify constraints plus rendered viewports

Replace tests that require a fixed three-card grid or specific width media query with checks that Marketplace has no width/height layout media queries, retains its required semantic content, and uses fluid layout primitives. Add browser screenshot checks at 1138 by 590 and stress widths to detect collisions, clipping, or horizontal inaccessibility.

Static checks alone are rejected because CSS cascade interactions require rendered verification. Screenshot checks alone are rejected because they do not prevent reintroduction of forbidden breakpoint logic.

## Risks / Trade-offs

- [Browser fonts and browser chrome differ between machines] → Verify the CSS-pixel reference viewport and use visual comparison for hierarchy and collisions rather than physical-pixel measurements.
- [Existing base and legacy CSS can override the new values] → Audit import order and remove or neutralize conflicting Marketplace sizing rules during implementation.
- [A compact reference could make cards feel too dense at larger widths] → Bound sizes with minimum and maximum values and verify an intermediate desktop viewport as well as the target.
- [The Account entry is supplied by the shared integration runtime] → Keep the Marketplace-specific positioning override scoped to its closed entry state and test it with the real mounted control.

## Migration Plan

1. Implement the Marketplace-only CSS and test updates.
2. Run Marketplace tests, the production build, and the browser viewport checks.
3. Roll back by reverting only the scoped Marketplace CSS/test edits if visual acceptance fails; catalog data, wallet state, and deployment paths are unchanged.
