## Why

The Marketplace is visually oversized at the user's real Chrome viewport of 1138 by 590 CSS pixels at 100% browser zoom. OS display scaling changes the effective CSS viewport, so a design that depends on a particular monitor size or width breakpoint cannot present a dependable catalog density.

## What Changes

- Define a fluid Marketplace layout contract that preserves the existing sidebar-and-catalog composition, content, filters, cards, and text treatment without depending on viewport width or height media queries.
- Size Marketplace typography, spacing, filter controls, artwork, and square catalog cells as a coordinated density system so the 1138 by 590 CSS-pixel target shows the Marketplace hierarchy, complete filters, and the first catalog row without oversized elements or header collisions.
- Retire Marketplace tests that assert breakpoint-specific grid geometry; replace them with checks for the fluid layout constraints and browser viewport verification.
- Keep this change scoped to Marketplace. Its design principles may be deliberately reused for non-Marketplace surfaces only in a later change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: The public Marketplace catalog layout gains a fluid, non-overlapping browser-presentation requirement while retaining its catalog content and guest behavior.

## Impact

- Affected code: `BIS/packages/marketplace/src/` layout styles and Marketplace-specific presentation tests.
- No change to catalog data, asset lookup, wallet behavior, checkout behavior, public APIs, dependencies, or the separate game repository.
