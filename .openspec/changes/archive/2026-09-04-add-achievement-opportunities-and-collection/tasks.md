## 1. Contract and feasibility

Apply verification on 2026-09-04 minted another Level 1 asset for the reported identity, listed both distinct holdings, and retried the completed operation without another issuance. Public identifiers, reference comparison, controlled tests and browser evidence are recorded in C1_C4_VERIFICATION.md. Prior transfer/funding blockers there are historical and were not reproduced by the current mint. Broad pending-transfer recovery remains separate.

- [x] 1.1 Reconcile the draft modules with generic mint/list semantics and rename the historical achievement-api delta directory to asset-api during apply, updating the proposal reference; verify no game-specific public API/type names remain and strict OpenSpec validation passes.
- [x] 1.2 Fresh-list the reported identity and confirm the external asset ID/quantity/metadata from design.md, then verify current spendable funding and supported metadata/amount limits for another no-control-asset mint; record public evidence and any precise current dependency without treating List Assets request progress or old blocker notes as a pending transaction.
- [x] 1.3 Compare the official Arkade wallet's relevant mint source revision and available deployment/SDK configuration with the existing BIS guard/adapter/submission/finalization path; record concrete differences, unknown deployed-version details, and a reproducible failing stage before selecting the mint repair. Verify findings against current source; no automatic SDK upgrade, funding, settlement, or recovery action.

## 2. Public API and wallet integration

- [x] 2.1 Implement JSON-safe generic mintAsset/listAssets contracts and exact decimal-to-base-unit conversion; verify valid amounts, fractional precision, maximum supply, invalid/exponent input, optional URL validation, no-account errors, and a host without BIS UI.
- [x] 2.2 Implement the Signet adapter issuing entered supply/metadata without controlAssetId and listing all positive holdings with optional metadata; verify non-BIS assets, metadata absence, bigint serialization, insufficient funds, failed live reads versus empty arrays, and no icon URL fetches.
- [x] 2.3 Complete request-bound operation IDs, shared wallet locking, durable public records, and conservative reconciliation; verify same-ID retry, changed payload rejection, independent same-name mints, concurrent callers, unavailable storage/locks, and reload. Preserve the current shared input-reservation contract; verify that an external same-name asset cannot satisfy a BIS operation and no new operation can bypass conflicting or unknown reserved inputs. General reservation/recovery implementation stays in its separate change.
- [x] 2.4 Integrate account generation/disposal and bounded adapter cleanup; verify account replacement, logout/reset coordination, timeout, and late completion cannot cause stale submissions or misattribute results, and submitted operations are not falsely cancelled.
- [x] 2.5 Repair the proven BIS mint-path differences from task 1.3 using the existing SDK issue API; exercise the actual adapter with controlled provider-boundary tests covering issue parameters, metadata/icon mapping, no control asset, preserving existing holdings, submission/finalization success, pre-submission rejection, and ambiguous post-submission failure. Verify that the successful path returns the new asset ID/exact quantity and that retry does not resubmit; mocked context-only success is insufficient.

## 3. Admin demonstration

- [x] 3.1 Complete and verify the existing Assets / C1 Mint Asset and C4 List Assets controls and Admin-owned dark modal, editable defaults, summary, fixed Control Asset None, validation, and explicit Mint; verify accessibility, responsive layout, applicable account-flow restrictions, successful mint presentation, and unchanged Runtime Preview. Keep the reference wallet's additional asset-management screens/actions out of scope.
- [x] 3.2 Add quick-fill buttons Achievement: Level 1/2/3 with LVL1/2/3, amount 1, decimals 0, the matching hosted numbered trophy Icon URL, and None; verify all three populate editable values without any API call and cannot mutate a pending/unresolved request.
- [x] 3.3 Complete verification of both actions in the existing always-visible Console with pending/public results/safe errors and bounded transient history; verify actual lists, empty arrays, no-account errors, scrolling, refresh/reset clearing, and suppression of obsolete client results. Confirm List Assets pending followed by success completes the read without creating transaction recovery state or a spending reservation.

## 4. Verification and documentation

- [x] 4.1 In the real Admin browser for the reported identity, rediscover the external Level 1 baseline, explicitly mint another Level 1 with a new operation ID, and observe minted with a distinct asset ID. Fresh-list both IDs with quantity "1" and matching metadata; retry the completed BIS operation without another issuance, and rediscover both through fresh same-identity repositories. Verify UI-free host parity and preview isolation. Record the public evidence sequence separately from fixtures/user-supplied screenshots; a different-wallet success or submitted-only result does not complete this task.
- [x] 4.2 Reconcile C1/C4 diagrams and superseded C2/C3 references, design discussion, package/API docs, and OpenSpec context; verify generic BIS terminology, Admin-only game example names, stable story IDs, working links, and unrelated deferrals remain accurate.
- [x] 4.3 Run the build, relevant account/asset tests, and strict OpenSpec validation; record results and resolve concrete regressions before marking delivery complete.
- [x] 4.4 Update C1_C4_VERIFICATION.md, affected package/API docs, design discussion, and OpenSpec context after apply to distinguish the user-supplied external mint/BIS list, historical blockers, new adapter tests, and newly performed BIS mint acceptance. Preserve historical observations with explicit superseding context and leave unperformed checks pending; verify no documentation still presents old empty-list or blanket-blocker statements as current.
- [x] 4.5 After the mint repairs, rerun the build, focused adapter/core/Admin tests, relevant account regressions, and strict OpenSpec validation; record current results separately from the earlier checked task 4.3 and require task 4.1's live evidence before claiming delivery complete.

## 5. Numbered trophy assets (ad hoc follow-up)

- [x] 5.1 Create three 64 by 64 transparent PNG trophies matching the original artwork outside the digit area, labeled 1/2/3; verify dimensions and alpha transparency.
- [x] 5.2 Publish versioned project assets and wire all three editable presets to absolute GitHub Pages URLs; verify each local and live quick-fill value without minting.
- [x] 5.3 Push the assets, publish trophy-assets-v1, and verify successful Pages deployment plus HTTP 200 and matching local/remote SHA-256 for all three PNGs.
- [x] 5.4 Reconcile delta/main specs and related Markdown with hosted icon behavior, stable paths, and the distinction between artwork publication and actual issuance.
