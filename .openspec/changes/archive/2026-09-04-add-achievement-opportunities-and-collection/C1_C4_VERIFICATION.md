# C1/C4 achievement verification

## Current live acceptance — 2026-09-04

The current Admin successfully minted another Level 1 asset for the reported identity on the first attempt in this apply session, using SDK 0.4.67 before the adapter hardening below. A fresh C4 List Assets then returned both distinct assets, each with quantity `"1"`. The earlier funding and registered-transfer blockers below are historical; neither was reproduced by this successful mint. No transfer was cancelled, recovery record cleared, account replaced, or SDK upgraded to obtain it.

| Evidence | Public value |
| --- | --- |
| Local Admin | `http://127.0.0.1:5173/` |
| Profile | `38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803` |
| External baseline asset | `7de59891e1cdcb9292800aff0597b92e8e01ad95821711fccba6b84744ed948b0000` |
| BIS operation | `26e568d9-a654-42e0-a3c2-06f69801994a` |
| New BIS asset | `1d78a9ccd440226c5b61e29bfc490e4e02b3f5afb6198a8480a7442aeae366460000` |
| Returned Ark transaction | `1d78a9ccd440226c5b61e29bfc490e4e02b3f5afb6198a8480a7442aeae36646` |
| Mint result | `minted` |
| Each holding | `Achievement: Level 1`, `LVL1`, quantity `"1"`, decimals `0` |
| Each icon URL | `https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png` |

Before the mint, a fresh Account Details read showed 289,715 Arkade sats and 0 Bitcoin sats, and a fresh C4 list confirmed the external baseline. C1 used the Level 1 quick-fill, amount 1, decimals 0, the hosted URL and Control Asset None. During submission, fields/presets/Mint/dismissal were disabled. Completion displayed Asset minted and Console contained the public result above; subsequent C4 showed both asset IDs with exact metadata. The existing Runtime Preview Account button remained unchanged by either asset action.

List Assets emits request progress (`pending`) followed by `success`; this is a completed read, not a pending transaction. User-supplied screenshots established the external baseline; the mint and fresh nonempty lists described here were performed in the current browser session.

### Retry and fresh repository acceptance

The development-only `/tests/asset-live-host.html` uses the public production context without BIS UI. Its completed-receipt retry returned `already-minted` with the same BIS operation, asset and transaction IDs above. Fresh lists before and after contained the same two holdings (`unchangedHoldings: true`). `getPendingAssetMint()` returned success with a null request. Each list constructs fresh temporary in-memory wallet/contract repositories from the saved identity, independently rediscovering both assets; no account reset or recovery phrase entry was needed. Exactly one new live mint was submitted by this acceptance sequence.

A final fresh read after the fixes still returned both Level 1 holdings and no pending mint. It also contained Level 2 asset `8b3a32724cd8075f5333b7c81421cdd510cad0d8f578ee4ba547914b38cd10930000`, quantity `"1"`, with a completed receipt. That additional issuance was observed separately and was not submitted by this acceptance sequence.

### Admin browser verification

- The real Admin C1/C4 sequence above verifies actual pending/success output, metadata and Runtime Preview isolation. Component fixtures are separately labeled synthetic and never create a wallet or touch account storage.
- `/tests/asset-ui-host.html` verifies all three editable quick-fill presets without callbacks, invalid amount rejection, fixed Control Asset None, success, pending controls and Escape suppression, and account-flow restrictions on C1/C4. Closing and reopening an unresolved mint retained identical request fields and operation ID; Check mint status returned `already-minted` with two calls and one synthetic issuance.
- A browser geometry check reproduced horizontal dialog overflow at a 520-CSS-pixel viewport. Adding border-box sizing kept the dialog inside that viewport and a 320-CSS-pixel viewport with no horizontal overflow and working vertical scrolling. The browser viewport override was reset after verification.
- Keyboard activation of C1 followed by Escape initially left focus on the document body. The dialog now closes during layout cleanup and restores its connected opener; repeating the same sequence returned focus to C1. Native modal focus containment was also checked.
- `/tests/asset-console-host.html` mounts the actual App with isolated in-memory account/storage and synthetic public callbacks. Its browser runner passed pending/success ordering, full holdings, empty arrays, safe/no-account errors, 100-entry history retention/eviction, scrolling, fresh-mount/reset clearing, obsolete pre-reset result suppression, unchanged Runtime Preview and UI-free callback parity. Listing created no mint journal or spending reservation. This fixture verifies App orchestration, not the adapter or live issuance.

### Reference comparison and supported inputs

Read-only inspection at 2026-09-04 13:42:19 UTC confirmed that the [deployed Signet bundle](https://signet.arkade.money/assets/index-CCcV2P9x.js) reports commit `9bf21d7a`, SDK 0.4.68, and operator `https://signet.arkade.sh`. The corresponding full [official revision](https://github.com/arkade-os/wallet/commit/9bf21d7a0a0b72456514da84032bf82faa729e79) is `9bf21d7a0a0b72456514da84032bf82faa729e79`.

- The [official mint screen](https://github.com/arkade-os/wallet/blob/9bf21d7a0a0b72456514da84032bf82faa729e79/src/screens/Apps/Assets/Mint.tsx) uses the same `assetManager.issue` API, bigint supply, name/ticker/decimals/icon metadata, and omitted controlAssetId for None. BIS adds operation reconciliation metadata.
- [Official wallet setup](https://github.com/arkade-os/wallet/blob/9bf21d7a0a0b72456514da84032bf82faa729e79/src/providers/wallet.tsx) uses a service worker, persisted repositories and configured background settlement. The deployed ISSUE deadline is 50 seconds, with a 60-second worker bus timeout. BIS uses temporary in-memory repositories, a 30-second deadline and disabled automatic settlement. These differences did not prevent the observed BIS mint and are not treated as diagnosed causes.
- Installed SDK 0.4.67 selects spendable VTXOs excluding recoverable outputs against wallet dust, preserves existing assets from selected inputs in change, and waits for submission/checkpoint signing/finalization before returning IDs. No upgrade or automatic settlement was needed.
- [Operator info](https://signet.arkade.sh/v1/info) reported network signet, dust 330, minimum VTXO 1, maximum VTXO -1, max transaction weight 40000 and max OP_RETURN outputs 3. The server version was empty and no maxOpReturnSize was advertised. Dust is a funding-selection threshold, not a proven mint fee.
- [Official validators](https://github.com/arkade-os/wallet/blob/9bf21d7a0a0b72456514da84032bf82faa729e79/src/lib/validators.ts) cap name/ticker/decimals at 40/8/8. BIS deliberately validates at 128/16/18 with a positive exact quantity capped at `18446744073709551615` base units and HTTPS icon URLs up to 2048 characters. These are BIS input limits, not claimed SDK/protocol maxima. The accepted Level 1 request fits both UIs; tests validate exact conversion and rejection at the BIS boundaries. The inspected SDK requires positive supply and nonempty encoded metadata keys/values; no broader live maximum-supply claim is made.

### Adapter fixes and final regression results

Controlled provider-boundary tests reproduced loss of an accepted transaction ID on finalization failure and late journal writes after the caller released its wallet lock. The adapter now preserves a known accepted transaction ID while the operation remains active, retains it during fresh ownership reconciliation, and performs no journal writes after abort/closure. SDK finalization still proceeds; the next locked retry resolves the original intent without resubmission. A failed secondary journal write cannot interrupt finalization. These are tested recovery defects, not a claimed explanation for the historical busy result or the successful first current attempt.

- `asset-adapter.test.mjs`: **15 passed**, using the actual BIS adapter and SDK AssetManager/asset packet construction with controlled wallet/provider transport. Coverage includes exact supply/metadata/icon/no control, preserving the external holding, non-replayed retries, independent IDs, precision, storage/funding/live-read failures, ambiguous submission/finalization, account replacement, abort, disposal, and late callbacks with zero unlocked journal writes.
- `asset-context.test.mjs`: **19 passed** for shared wallet locking, same-wallet contention, cross-wallet isolation, list during a held mint, existing pending send/transfer protection, storage/lock failures, profile/generation changes and obsolete completion suppression. General input reservation/recovery remains a separate change; current conservative spending guards were retained.
- Existing `assets.test.mjs`: **7 passed**; `admin-assets.test.mjs`: **1 passed**, including the reproduced empty Pay-to-play category and the fix that omits it.
- All **193 tests across 31 integration/demo test files passed** in this checkout, including account, restoration, logout/cleanup, send, transfer, activity, layout and documentation regressions. Files ran in separate Node processes with `node --test --test-isolation=none <file>`. Two Vite-based suites initially failed under sandbox dependency/process restrictions and passed unchanged with approved normal process access. The total includes the concurrently developed runtime asset-inspection suites, which are outside this change's implementation scope.
- `npm run build` passed typecheck and both package production builds; Vite retained its large-chunk advisory. Development verification pages are excluded from production inputs. `openspec validate add-achievement-opportunities-and-collection --strict` passed.

Real wallet logout/reset and manual recovery-phrase restoration were not performed. Fresh same-identity SDK repositories verified rediscovery, and isolated tests verified account lifecycle behavior. No broad pending-transfer recovery or disjoint-input reservation feature is claimed complete by this change.

## Historical observations

The remaining dated sections retain earlier evidence. Their then-current blockers and unchecked-task counts are superseded by the current acceptance and task list above.

## Planning status update — 2026-09-04

The user reports Arkade balance is now available and requests the C1/C4 reward-then-view proposal. The funding blockers below describe earlier checks and must not be presented as a newly verified blocker. Live spendability, asset issuance, fresh listing, and restoration remain unverified; task 1.1 will recheck them during implementation. No transaction was attempted and no implementation task was completed by this planning update.

## Feasibility gate — 2026-09-03

Status: blocked on a funded Signet account. Task 1.1 remains incomplete; no achievement API or Admin implementation has been made.

- A live GET of https://signet.arkade.sh/v1/info succeeded and reported network signet, dust 330, vtxoMinAmount 1, and txFeeRate 0. These advertised values do not prove asset issuance support or a fixed transaction cost.
- Inspected installed @arkade-os/sdk 0.4.67, dist/chunk-AEWJU6NZ.js, AssetManager.issue: it reads spendable VTXOs with recoverable outputs excluded, selects against wallet.dustAmount, builds the asset metadata/output, and submits an offchain transaction. The 330-sat selection threshold is funding backing, not a claim that issuance consumes a 330-sat fee.
- In the existing Chrome demo at http://127.0.0.1:5173/?skipIntro=true, opened A4 Account Balance, then Account Details. The saved account displayed a completed live balance response of 0 available sats and 0 total sats. No recovery material was accessed or displayed.
- No issuance, funding, settlement, account replacement, logout, or reset was attempted. No successful asset issuance/list/restoration round trip is claimed.

## Required to resume

A funded test Signet account with sufficient spendable Arkade VTXOs is needed for the first task. Restore any required test recovery phrase directly in the app, never in chat. After funding is available, verify actual issuance with the agreed metadata, fresh holdings and metadata reads, and rediscovery after restoring the same identity before proceeding past the gate.

All ten implementation tasks remain unchecked. Existing A-story verification status is unchanged.

## Funded account recheck — 2026-09-03

The user reported a balance and requested continuation. A fresh production Account Details read for profile `38a4…e803` showed **289,715 total sats and 0 available sats**. The existing read-only SDK host at `/tests/activity-sdk.html` independently returned an online/live connection and one confirmed Bitcoin boarding output:

- Transaction: `7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8`, output 858, value 289,715 sats.
- SDK history: `RECEIVED`, `tag: boarding`, `settled: false`, with empty commitment and Ark transaction IDs.
- Installed SDK `getBalance()` includes boarding funds in total but derives available funds from offchain holdings. `AssetManager.issue()` selects spendable VTXOs with recoverable outputs excluded, against the wallet dust amount.

The funding has arrived and is Bitcoin-confirmed, but it has not become spendable Arkade funding. Task 1.1 is still blocked on that distinction; no asset issuance was attempted. Boarding/settlement is not implemented in the current BIS context and is outside this achievement change's tasks. The next scope decision is whether to add the boarding step needed to convert these test funds into spendable Arkade VTXOs. No credentials were displayed, and no settlement, logout, reset, or account replacement was performed. All achievement implementation tasks remain unchecked.

## Admin funding follow-up

The user subsequently requested an Admin button labeled Fund 1000 Sats. It is implemented through createBisAdminContext(context).fund1000Sats(), using the active wallet's Signet Arkade receive address and the faucet endpoint used by the [official Arkade wallet](https://github.com/arkade-os/wallet/blob/master/src/lib/faucet.ts). It posts exactly 1000 sats, has a pending state, rejects missing accounts and concurrent calls, and never fabricates balance changes or automatically retries. Success means request accepted, not confirmed receipt.

On 2026-09-03 the faucet healthcheck returned HTTP 502. A real browser request through the new button displayed pending, then Funding was not confirmed; the existing preview and balance were unchanged. Successful funding remains unverified and the achievement feasibility gate remains blocked. Build and 39 existing tests passed; two additional funding tests passed for request amount/network/failure handling and account/duplicate/disposal behavior.

The Admin funding button now opens https://signetfaucet.com/ rather than calling the API faucet. `getFundingAddress()` returns the active wallet's public Bitcoin boarding address with account-change guards. The site was inspected and does not consume an address URL parameter; the app attempts clipboard copying and displays the address if clipboard access fails. Build passed and the updated button/manual-copy fallback was observed in Chrome. Prefilling the external form is not supported. No faucet claim or boarding transaction was submitted by this change.

## Generic asset implementation check — 2026-09-04

- Implemented generic public mintAsset, listAssets, getPendingAssetMint and validateMint APIs; no BIS achievement types or game rules. Added exact decimal conversion, optional metadata, no controlAssetId, same-origin wallet locking, public durable request records and guarded submission. SDK automatic settlement is disabled for minting.
- Added C1 Mint Asset and C4 List Assets to the current Admin layout. Native dark dialog follows the reference, with fixed None and three editable quick-fill examples. Each of Level 1/2/3 was checked in Chrome: matching name/ticker, amount 1, decimals 0, blank Icon URL. Only Mint submits; presets did not issue anything.
- Live List Assets returned success with assets: [] for account 38a4…e803. Runtime Preview remained empty. The dialog was visually inspected at the normal browser viewport and scrolls to its final action.
- Attempted one explicit Level 1 mint (operation 82767f98-9bac-45a5-a2d3-bea4e870bf51). It returned code busy before the asset adapter submitted. No asset issuance is claimed.
- Account Transfer then displayed 289,715 Arkade sats, 0 Bitcoin sats and an existing registered unresolved Arkade-to-Bitcoin transfer for 1,000 sats. Transfer ID: 43eb8d6e-a4a0-403f-b759-44cdb0673ef3; operator intent: 21bb686b-ef2e-4654-87eb-999e3e9ee716. Its Check Status action reported completion not verified. The asset implementation preserves this guard; no record was deleted or bypassed and no new transfer was submitted.
- Build/typecheck passed. All 87 integration tests passed, including 7 asset tests for exact amounts, validation, non-BIS/metadata-free holdings, JSON-safe quantities, corrupt/unavailable records, request binding, unresolved-operation blocking, independent same-name IDs, headless parity, error sanitization, account changes and missing locks.

### Still pending

Real minted/nonempty list round trip, restored-identity holdings after issuance, actual same-ID issuance retry, adapter submission timeout/concurrency fault injection, mobile layout/focus checks, and full console reset/late-result browser checks. The registered transfer must be resolved before attempting another mint. Unchecked tasks remain explicit; the change is not ready to archive.

## Numbered trophy assets and preset URLs — 2026-09-04

This follow-up supersedes the earlier blank-Icon-URL preset observation only; the initial form still starts with a blank optional URL.

- Created level-1-trophy.png, level-2-trophy.png and level-3-trophy.png under packages/integration-demo/public/assets/achievements/v1/. Each is 64 by 64 with 2,456 fully transparent pixels, retaining the original trophy pixels outside the digit area.
- Browser-checked each local and live quick-fill button: matching Achievement: Level 1/2/3 and LVL1/2/3, amount 1, decimals 0, and the corresponding absolute public PNG URL. No Mint action was performed in this follow-up.
- Asset commit: 1dcbfb87a336a69a33d969aad0cd3fd320e28acd. [Asset release](https://github.com/SamuelAsherRivello/blockchain-integration-service/releases/tag/trophy-assets-v1) contains all three PNG attachments.
- The first Pages run was superseded by a concurrent application update. [Deployment 33857397435](https://github.com/SamuelAsherRivello/blockchain-integration-service/actions/runs/33857397435) for 1d67c8e0dfebf26b49dde6f857550317659b0416 completed successfully and included the updated live dialog.
- All three public URLs returned HTTP 200; each remote SHA-256 matched its corresponding local PNG.
- Local build passed; all 7 focused asset tests passed. The broader local suite at the time had 113 passes and 3 failures in the unfinished sending API; those results are a historical snapshot, not current verification of that separate work.
- Artwork publication and preset verification do not prove asset issuance, ownership, retry safety, or restoration; outstanding C1/C4 live checks remain pending.
