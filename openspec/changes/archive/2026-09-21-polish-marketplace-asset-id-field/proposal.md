## Why

Marketplace item details mix a copyable Asset ID with non-copyable metadata,
including a decimals value that players do not need. The compact dialog also
shows an internal scrollbar at common desktop sizes.

## What Changes

- Present Asset ID, ticker, quantity, and every gameplay stat as labeled,
  contained read-only value fields using the existing accessible copy action
  and clipboard feedback.
- Use the same left-aligned type treatment for each field label, value, and
  copy control.
- Remove decimals from the detail.
- Present the detail as a square card with Buy and Sell in an upper-right
  action column, without an internal scrollbar or bottom status/footer copy.
- Keep disabled trading behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: Define the labeled and copyable metadata treatment
  and scroll-free sizing in a public catalog-item detail view.

## Impact

- `BIS/packages/marketplace/src/App.tsx`
- `BIS/packages/marketplace/src/player-polish.css`
- `BIS/packages/integration/src/index.ts`
- Marketplace detail regression coverage
- `AGENTS.md` OpenSpec directory-discovery guidance
