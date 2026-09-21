# Tasks

## 1. Shared collection layout

- [x] 1.1 Update the shared collection-card CSS so Assets, Contracts, and Transactions use one explicit compact parent height while preserving the available-host cap; verify the computed card heights match in a narrow runtime fixture.
- [x] 1.2 Update the shared collection-list CSS to reserve `3.5 * 72px + 3 * 8px = 276px`, use `overflow-y: scroll`, and restore the BIS scrollbar colors/gutter after the overlay-wide hidden-scrollbar rule; verify computed overflow, scrollbar-width, and scrollbar-gutter styles.
- [x] 1.3 Keep the shared collection item button at one border-box width and 72px height for all row content, including artwork-backed assets and compact contract/transaction grids; verify bounding rectangles are equal across all three row types.

## 2. Focused verification

- [x] 2.1 Extend or add a production-component browser fixture covering zero, one, two, and more-than-four rows; verify the 276px list viewport and visible scrollbar remain present for empty and short lists.
- [x] 2.2 Verify narrow 9:16 rendering has no horizontal overflow and that long field values remain contained within the shared row width; verify existing selection, detail navigation, and scrollbar behavior remain intact.

## 3. Regression checks

- [x] 3.1 Run the focused integration-demo layout test and the relevant integration presentation tests; verify all pass.
- [x] 3.2 Run the repository build/typecheck; verify both integration and integration-demo builds pass without changing public APIs or wallet behavior.
