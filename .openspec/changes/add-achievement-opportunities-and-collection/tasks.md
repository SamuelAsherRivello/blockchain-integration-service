## 1. Contract and feasibility

Planning updated 2026-09-04 for generic assets, an Admin mint modal, Control Asset None, and three example presets. Generic APIs and Admin controls are now connected. Live mint verification remains blocked by the existing registered wallet transfer; see C1_C4_VERIFICATION.md.

- [x] 1.1 Reconcile the draft modules with generic mint/list semantics and rename the historical achievement-api delta directory to asset-api during apply, updating the proposal reference; verify no game-specific public API/type names remain and strict OpenSpec validation passes.
- [ ] 1.2 Verify fresh spendable Arkade funding, supported metadata/amount limits, and one real no-control-asset issuance/list round trip with fresh wallet repositories for the same identity; record public evidence and actual funding requirements in C1_C4_VERIFICATION.md, preserving the issued asset and reporting any unavailable live checks explicitly.

## 2. Public API and wallet integration

- [x] 2.1 Implement JSON-safe generic mintAsset/listAssets contracts and exact decimal-to-base-unit conversion; verify valid amounts, fractional precision, maximum supply, invalid/exponent input, optional URL validation, no-account errors, and a host without BIS UI.
- [x] 2.2 Implement the Signet adapter issuing entered supply/metadata without controlAssetId and listing all positive holdings with optional metadata; verify non-BIS assets, metadata absence, bigint serialization, insufficient funds, failed live reads versus empty arrays, and no icon URL fetches.
- [ ] 2.3 Implement request-bound operation IDs, shared wallet locking, durable public records, and conservative reconciliation; verify same-ID retry, changed payload rejection, independent same-name mints after completion, concurrent callers, unavailable storage/locks, reload, and unresolved-operation blocking.
- [ ] 2.4 Integrate account generation/disposal and bounded adapter cleanup; verify account replacement, logout/reset coordination, timeout, and late completion cannot cause stale submissions or misattribute results, and submitted operations are not falsely cancelled.

## 3. Admin demonstration

- [ ] 3.1 Add Assets / C1 Mint Asset and C4 List Assets with an Admin-owned dark modal based on the reference, editable defaults, summary, fixed Control Asset None, validation, and explicit Mint; verify accessibility, responsive layout, account-flow restrictions, and unchanged Runtime Preview.
- [x] 3.2 Add quick-fill buttons Achievement: Level 1/2/3 with LVL1/2/3, amount 1, decimals 0, the matching hosted numbered trophy Icon URL, and None; verify all three populate editable values without any API call and cannot mutate a pending/unresolved request.
- [ ] 3.3 Connect both actions to the existing always-visible Console with pending/public results/safe errors and bounded transient history; verify actual lists, empty arrays, no-account errors, scrolling, refresh/reset clearing, and suppression of obsolete client results.

## 4. Verification and documentation

- [ ] 4.1 Verify in a real browser and UI-free host: mint then fresh list with matching asset ID/quantity, safe retry, separate intentional same-name mint semantics, fresh-wallet restoration/listing, failure cases, and preview isolation; record live evidence separately from fixtures and retain unperformed checks as pending.
- [x] 4.2 Reconcile C1/C4 diagrams and superseded C2/C3 references, design discussion, package/API docs, and OpenSpec context; verify generic BIS terminology, Admin-only game example names, stable story IDs, working links, and unrelated deferrals remain accurate.
- [x] 4.3 Run the build, relevant account/asset tests, and strict OpenSpec validation; record results and resolve concrete regressions before marking delivery complete.

## 5. Numbered trophy assets (ad hoc follow-up)

- [x] 5.1 Create three 64 by 64 transparent PNG trophies matching the original artwork outside the digit area, labeled 1/2/3; verify dimensions and alpha transparency.
- [x] 5.2 Publish versioned project assets and wire all three editable presets to absolute GitHub Pages URLs; verify each local and live quick-fill value without minting.
- [x] 5.3 Push the assets, publish trophy-assets-v1, and verify successful Pages deployment plus HTTP 200 and matching local/remote SHA-256 for all three PNGs.
- [x] 5.4 Reconcile delta/main specs and related Markdown with hosted icon behavior, stable paths, and the distinction between artwork publication and actual issuance.
