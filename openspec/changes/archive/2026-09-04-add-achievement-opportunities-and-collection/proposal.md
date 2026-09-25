## Why

BIS must successfully mint another real Signet asset through its existing Admin form and show it in the owned collection. On 2026-09-04 the user supplied a successful Level 1 mint from [Arkade's Signet wallet](https://signet.arkade.money/), using the same wallet identity, and a successful BIS List Assets response containing that asset; this revision addresses the then-unverified issuance from BIS.

## What Changes

- Complete the existing C1 Mint Asset flow: retain the Admin dark modal, asset summary, Name, Ticker, Amount, Decimals, Icon URL, and Control Asset fixed to None.
- Mint explicitly issues the entered supply to the active wallet using that wallet's spendable funds. Control asset creation, selection, and reissuance are excluded.
- Compare the working Arkade wallet's mint orchestration and configuration with BIS's existing SDK issuance path, then repair the demonstrated BIS mint gap. Do not replace the working list path or assume a new mint protocol or SDK upgrade is needed.
- Preserve C4 List Assets: the public API prints all positive owned asset holdings, including assets not created by BIS. The supplied external Level 1 asset is the interoperability baseline, with no game-specific filtering.
- Public methods are UI-independent and use generic asset types. All amounts cross the public boundary as exact decimal strings.
- Both operations show pending/results/errors in the existing Admin Console. No Runtime Preview content is mounted, cleared, or changed.
- Three Admin-only quick-fill buttons populate Achievement: Level 1, Achievement: Level 2, or Achievement: Level 3, using tickers LVL1/LVL2/LVL3, amount 1, decimals 0, the matching hosted numbered trophy Icon URL, and Control Asset None. They leave fields editable and never submit automatically; BIS assigns no game-specific meaning to these example names.
- Protect retries by mint operation ID, not asset name. Intentional separate mints may use identical names; an uncertain attempt must not be silently resubmitted.
- Require a new BIS mint with a distinct asset ID, followed by a fresh list containing both the existing external asset and the new asset with exact quantities and metadata. External-wallet success and existing list success alone do not complete C1.
- Treat Console pending entries as request progress. A List Assets pending entry followed by success is a completed read, not evidence of an unresolved wallet transaction.
- Keep broad pending-transfer recovery, cancellation, and independent-spending policy in their separate changes. Recheck any actual mint blocker and preserve shared input and retry protections; do not require all historical transactions to be cleared as a blanket prerequisite for this work.
- B, C2 claim UI, broad C3 recovery UI, C5 payouts, and D1 external/game-controlled issuance remain deferred.

## Capabilities

### New Capabilities
None. Both capabilities already exist in the main specs.

### Modified Capabilities
- `asset-api`: Complete generic Signet issuance and external-wallet interoperability while preserving exact quantities and the current shared retry/input-reservation contract.
- `story-driven-demo`: Admin mint-to-list acceptance, distinction between request progress and transaction uncertainty, and evidence for the existing controls and presets.

## Impact

Implementation affects integration core/Arkade mint orchestration and the existing Admin form/Console as needed. Keep generic public APIs, the UI-independent host path, and Runtime Preview isolation. No game repository, custom server, new dependency, or wallet asset-management screens are added; Send, Receive, Reissue, Burn, and Hide Icon in the reference screenshots are outside this slice.

Proposal, requirements, design, and tasks are revised together. The 2026-09-04 apply session completed the same-identity BIS mint/list acceptance and duplicate-free retry, hardened interrupted-operation journal handling, and verified the Admin/browser behavior. All 20 tasks are complete; public evidence and final test results are in C1_C4_VERIFICATION.md. Earlier zero-balance, empty-list, and registered-transfer observations are retained as history and were not reproduced by the successful current mint. The change was synced to the main specs and archived on 2026-09-04.
