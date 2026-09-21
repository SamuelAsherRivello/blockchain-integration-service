# Design

## Context

Assets, Contracts, and Transactions already share the `ItemList` / `ItemListDetail` frame and the compact item-row component. The current stylesheet has a 72px row token and a calculated 3.5-row list height, but scrollbar restoration is split across older page-specific selectors and the shared collection frame does not state the parent height as one contract.

## Goals / Non-Goals

**Goals:**

- Make the shared list page the single source of truth for parent height, list viewport, scrollbar visibility, gutter, row width, and row height.
- Preserve the existing compact visual language, row content, selection behavior, detail navigation, and narrow-host containment.
- Verify empty, short, and long lists without relying on data count to determine layout.

**Non-Goals:**

- No changes to asset, contract, or transaction data mapping.
- No changes to public APIs, wallet operations, list ordering, detail reports, or action availability.
- No changes to detail-page height beyond preserving the existing shared detail behavior.
- No new dependency or browser-specific scrollbar library.

## Decisions

### 1. Enforce dimensions at the shared collection class

Add the explicit compact list-card height and list viewport rules to the shared `bis-item-list` selectors in `overlay.css`. Keep the existing row token at 72px and calculate the viewport as `3.5 * row height + 3 * row gap` (276px). This is preferable to three page-specific overrides because all three production pages already render through `ItemList`.

### 2. Use `overflow-y: scroll` and stable gutter on the shared list

The global overlay intentionally hides incidental scrollbars. The shared collection list must opt back in with `scrollbar-width: auto`, the existing BIS scrollbar colors, a visible WebKit scrollbar, `overflow-y: scroll`, and `scrollbar-gutter: stable`. This guarantees the track remains present for empty and short lists and prevents row content from shifting when a long list becomes scrollable.

### 3. Keep row geometry independent of row content

The shared collection item remains `width: 100%`, `height: var(--bis-item-height)`, and `box-sizing: border-box` through the overlay-wide rule. Asset artwork and compact grids must fit inside that box; they must not introduce type-specific height or width exceptions. The list's right-side scrollbar gutter is part of the list layout, so all item buttons share the same usable width.

### 4. Verify through one focused layout fixture

Extend or add a narrow runtime fixture that mounts the production collection frame with asset, contract, and transaction-shaped rows. Assert the card height, list client height, `overflowY`, scrollbar gutter, and every row's width/height. Repeat with zero, one, and multiple rows. Keep the assertions at the shared DOM/CSS contract level so they detect drift regardless of which data page supplies the rows.

### Alternatives considered

- Page-specific CSS for Assets, Contracts, and Transactions: rejected because it would recreate the inconsistency the shared `ItemList` frame is designed to prevent.
- `overflow-y: auto`: rejected because it hides the scrollbar for short or empty lists, contrary to the requested persistent affordance.
- JavaScript measurement of row count: rejected because fixed CSS dimensions are deterministic, preserve layout during loading, and avoid resize/event complexity.

## Risks / Trade-offs

- [A persistent scrollbar consumes narrow horizontal space] → Reserve the stable gutter consistently and retain existing ellipsis/truncation behavior inside compact fields.
- [A fixed card may be taller than a very short host] → Preserve the existing `max-height: 100%` and available-host cap so the outer overlay remains bounded.
- [Browser scrollbar metrics vary] → Assert logical CSS properties and row/card bounding boxes rather than relying only on platform-specific pixel widths.
- [Existing page-specific scrollbar rules may conflict] → Consolidate the shared rule after the global hidden-scrollbar rule and verify computed styles in the browser fixture.

## Migration Plan

1. Update the shared collection CSS and add focused layout assertions.
2. Run the focused integration-demo fixture and the existing integration tests/build.
3. If the shared rule causes a narrow-host regression, revert only the scoped layout selectors and fixture assertions; no data or persisted state migration is required.
