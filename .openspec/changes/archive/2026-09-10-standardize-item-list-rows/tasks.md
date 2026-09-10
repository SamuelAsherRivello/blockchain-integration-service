## 1. Shared Row Presentation

- [ ] 1.1 Add focused failing tests for the six `emoji: value` field contract, accessible hidden labels, leading visual selection, lifecycle-to-toast classification, and stable interaction-state backgrounds; verify the new assertions fail against the current rows before implementation.
- [x] 1.2 Extract or share the toast status glyph and palette as internal presentation primitives for information, success, warning, and error without changing toast playback or public APIs; verify the focused toast tests pass.
- [x] 1.3 Add the internal compact item-row component with exactly six fields in a two-column by three-row grid, native Unicode emoji markers, accessible nonvisual labels, per-cell containment, and optional artwork; verify component rendering tests cover all six positions and artwork/status fallback.

## 2. Type-Specific Row Content

- [x] 2.1 Map Transactions to operation, cost, network, status, direction, and local time; map missing timestamps truthfully, omit identifiers from the closed row, and verify `activity-row.test.mjs`, `contract-activity.test.mjs`, and `transaction-detail.test.mjs` preserve full detail/report behavior.
- [x] 2.2 Map Assets to name, exact quantity, ticker, owned status, decimals, and off-chain network; prefer prepared metadata artwork and fall back to the success glyph, and verify asset presentation tests cover large quantities, missing metadata, failed artwork, and full ID availability in detail.
- [x] 2.3 Map Contracts to operation/type, cost, purpose, current status, role, and expiration; omit contract ID/reference from the closed row, retain them in detail/reports, and verify contract tests cover pending refund, warning/error classification, and detail navigation.

## 3. Styling and Demonstration

- [x] 3.1 Apply the existing toast blue/green/yellow/red background and border values to compact rows and add outline-only interaction feedback—2px black for hover/focus and persistent 3px black for selected—then verify computed styles show no background change in any interaction state.
- [ ] 3.2 Preserve the bounded 3.5-row collection viewport while fitting the leading visual and two-by-three field grid at supported narrow 9:16 widths; verify long values truncate within their own cells with no horizontal page overflow.
- [ ] 3.3 Update an existing Admin/runtime demonstration or browser fixture to show a pending transaction, completed transaction, artwork-backed owned asset, artwork-fallback asset, and pending contract; verify every example uses production row components and truthful fixture data.
- [ ] 3.4 Update the relevant user-story documentation to describe the closed-row information priorities and unchanged full-detail behavior; verify documentation tests and links remain valid.

## 4. Verification

- [ ] 4.1 Run `npm test` from the repository root and verify all focused and regression tests pass, including toast, activity-row, asset-presentation, account-collection, transaction-detail, and contract coverage.
- [x] 4.2 Run `npm run build` from the repository root and verify typecheck plus both integration and integration-demo builds pass.
- [ ] 4.3 Exercise the real narrow browser fixture with mouse and keyboard, save screenshots under `output/screenshots/item-list-rows/`, and verify status colors, leading icons/artwork, six emoji-value fields, black hover/focus/selected outlines, selection restoration, full detail content, and absence of horizontal overflow.
