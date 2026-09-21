## 1. Shared Marketplace detail fields

- [x] 1.1 Export the existing copyable value-field component from the
  integration package public API and verify the Marketplace package resolves
  it through a production build.
- [x] 1.2 Replace the inline Marketplace metadata values with labeled,
  read-only, copyable fields; omit Decimals; and verify the full values remain
  selectable with accessible copy success and failure feedback.
- [x] 1.3 Add Marketplace-scoped square detail styling, upper-right action
  column, scroll-free behavior without bottom footer copy, and one left-aligned
  data-row type treatment; verify desktop and narrow layouts retain their
  bounds.

## 2. Regression and workflow guidance

- [x] 2.1 Extend focused Marketplace regression coverage for the square
  detail, upper-right actions, omitted Decimals, no internal scrollbar/footer
  copy, and shared left-aligned data-row typography; run
  `node --test BIS/packages/marketplace/tests/catalog.test.mjs`.
- [x] 2.2 Clarify `AGENTS.md` so agents discover `.openspec/` first and treat
  plain `openspec/` only as generated compatibility plumbing; verify the
  instructions distinguish inspection/editing from the compatibility link.

## 3. Validation

- [x] 3.1 Run `npm.cmd run typecheck`, the integration and Marketplace
  production builds, and `git diff --check`.
- [x] 3.2 Open the Marketplace in a browser, select an available catalog item,
  and verify its square layout, upper-right actions, omitted Decimals, and no
  internal scrollbar or footer copy.
