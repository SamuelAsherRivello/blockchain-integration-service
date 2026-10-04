## Context

Marketplace mounts the reusable BIS Account UI into a fixed, viewport-sized host. Its desktop rules currently apply a scale transform to the layer itself. The transformed layer is also the modal backdrop when Account is open, so its visual extent no longer matches the host viewport.

## Goals / Non-Goals

**Goals:**

- Keep the Marketplace desktop composition readable at the supplied reference scale.
- Place only the closed Account entry in the lower-left desktop area.
- Keep Account’s open state as a complete, centered modal over the Marketplace viewport.

**Non-Goals:**

- Change account lifecycle, wallet operations, catalog data, or the reusable BIS component API.
- Redesign Marketplace cards, filters, or mobile navigation.

## Decisions

### Apply density through local component metrics, not layer transforms

The desktop catalog rules will continue to set grid, card, and typography values directly. The Account layer will never be scaled or transformed. This preserves the fixed host’s coordinate space and makes the open backdrop cover its `inset: 0` area.

The alternative—retaining a scaled layer and attempting to compensate open-state geometry—would keep two coordinate systems and remain vulnerable to new overlay states.

### Separate closed-launcher placement from open-dialog placement

Marketplace will set the closed `.bis-layer` grid alignment to lower-left with a fixed desktop inset. Its `.bis-layer-open` rule will explicitly restore centered alignment, full-size transform-free geometry, and viewport-safe padding. The shared integration’s normal default remains centered for all other hosts.

The alternative—positioning the fixed host itself—would also move the open dialog and constrain its backdrop.

### Verify the rendered reference behavior

Browser checks will use the supplied desktop-scale viewport. They will inspect the Account control before click, then inspect the open layer’s bounds, backdrop coverage, and dialog center after click. A build check guards TypeScript and CSS processing.

## Risks / Trade-offs

- [A future host rule reintroduces a layer transform] → Keep the launcher and open-state rules co-located and assert untransformed open-layer geometry in browser checks.
- [Lower-left launcher overlaps small-screen content] → Limit the fixed placement to the desktop breakpoint and retain the ordinary centered/safe default below it.

## Migration Plan

1. Replace the Marketplace-only transformed-layer override with the separate closed/open placement rules.
2. Validate build and desktop browser behavior.
3. Revert the Marketplace CSS rules if a regression is found; no persisted data or API migration is involved.
