# Verification — 2026-09-08

## Delivery status

Implementation is partial: tasks 1.2, 4.1–4.4 and 5.1 are complete (6/23). **The original live settlement failure is not identified or repaired. No live withdrawal, payment, mint, cancellation or ownership lookup was submitted by this apply session.** No receipt or terminal cancellation has been fabricated, and no user operation journal has been cleared.

## Current environment and read-only inspection

- Checkout HEAD: `70722ff` (`update`), plus the current uncommitted change. This is not a released revision.
- Installed and exactly pinned SDK: `@arkade-os/sdk` 0.4.67. No dependency change.
- Existing Chrome Admin: `http://127.0.0.1:5174/`, displayed BIS 0.14.1. Current player public account ID: `38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803`.
- At `2026-09-08T14:53:19Z`, unauthenticated `GET https://signet.arkade.sh/v1/info` returned network `signet`, session duration `60`, blank version, empty intent fee expressions and tx fee rate `0`. The deployed operator version remains unknown. The first sandbox request failed; the supported elevated public read succeeded.
- Transactions was inspected through the actual Admin. The separate read-only diagnostic page scanned only boarding journal keys and reported **no pending transfer journal on this origin**. This does not prove any historical withdrawal succeeded or was cancelled. Task 1.1 remains open because the original/latest interrupted record cannot currently supply its failure evidence.
- Archived operation `3253e5d4-863f-4fa3-8093-e30533632fa0`, intent `de5bfafe-742b-4b48-843c-30e893cf8f80`, and its post-participation interruption remain historical observations from `archive/2026-09-08-repair-transfer-settlement-lifecycle/VERIFICATION.md`; they are not fresh operator state.
- Inspection used Account/Transactions navigation and quote review only. It did not use recovery phrase display, signing queries, Confirm Transfer, payment or cancellation controls.

## Implemented and tested

- Optional failure detail now records only static error categories, last observed stage/action, timestamp, diagnostic end reason, the exact SDK pin and a valid public batch identifier when available. Unknown errors remain unknown. Arbitrary messages, stacks, causes, proofs and nonce payloads are not persisted or displayed. Malformed diagnostics cannot remove the financial reservation, and legacy records retain their previous shape.
- B1 stays actionable. When known pending inputs explain a funding shortfall, the result states the reserved amount, relevant transfer IDs when valid, and the Transactions/Recovery Info path. Genuine insufficient eligible funds still reject before submission.
- Updated per user direction: one backup checkbox permits logout with unresolved operations. Identity, preferences and player operation journals are cleared from both browser storage surfaces. Separate Admin game-wallet records remain intact. Administrative reset continues to block unresolved transfers.
- The exact stateful regression logs out the initial account, restores the funded player, pays 1,000, issues the asset through the real SDK AssetManager, pays another 1,000, and submits the 1,000 withdrawal fixture. One 265,715-sat asset-bearing input is reserved. A concurrent B1 is rejected without reaching submission and reports that reservation. Controlled public ledger evidence then supplies the matching confirmed Bitcoin receipt, consumed input attribution and exact asset change. Real BIS reconciliation resolves the original operation; B1 succeeds without logout and retains the same asset and quantity.
- This sequence test uses simulated signing/transport/ledger and real SDK issuance and settlement output construction. It **does not exercise a successful real SDK batch handler** or establish live Signet acceptance. Tasks 1.3, 2.1, 5.3–5.5 remain open.

Test-first evidence: the new failure-detail tests failed with missing metadata; the sequence failed with the old zero-funds text; cleanup failed to reject a pending journal; acknowledged context logout cleared the account. Those regressions now pass.

Affected tests ran in separate Node processes with `--test-isolation=none` because of Windows process restrictions/global fixture interference. 133 tests pass across 18 suites: account-transfer, boarding-multiple, boarding-lifecycle, boarding-assets, boarding-recovery, boarding-quote, boarding-shared-commitment, continue-pending-swap-sequence, continuation, continuation-errors, continuation-adapter, logout, logout-cleanup, live-boarding-wait, send-adapter, sending, send-context and wallet-reservations. The final failure-provenance addition was verified by rerunning the 10-test lifecycle suite. No implemented cancellation suite/API exists to claim as passing cancellation delivery.

`npm run typecheck` and production `npm run build` passed. One repeat sandbox build encountered Vite child-process `EPERM`; the supported elevated build passed. Existing dynamic-import and large-chunk warnings remain.

The isolated browser logout fixture passed for two hosts with pending operations: UI disabled logout, a direct API acknowledgement could not bypass the guard, and in-memory recovery data remained. The ordinary logout fixture also passed in both hosts, including acknowledgement, back navigation, reopening, error/OK, successful logout and return destination. These fixtures do not access real browser account storage or a signing wallet.

`openspec validate fix-arkade-withdrawal-settlement-and-recovery --strict` and `git diff --check` passed. Task 5.6 remains open for final reconciliation after the remaining implementation and acceptance gates; these checks do not establish delivery.

## Prepared live diagnostic, not submitted

A production snapshot is available at:

`http://127.0.0.1:5174/dist/withdrawal-diagnostic-20260908/index.html`

Its generated files are under ignored `BIS/packages/integration-demo/public/dist/withdrawal-diagnostic-20260908/`. Do not overwrite this snapshot during a live signing session. It shares the existing account origin. Browser inspection confirmed its only script is the compiled `assets/index-CYtogWhq.js`; there is no Vite/HMR script. SHA-256 of that bundle:

`8fa54251e0e3b82eb438828f2b4b0f74e3154ad100c70e1ce67129cb0daa4b84`

The actual UI quote was reviewed, but **Confirm Transfer was not clicked**:

| Field | Observed |
| --- | --- |
| Current total / Arkade | 264,715 sats |
| Current Bitcoin | 0 sats |
| Direction | Arkade → Bitcoin, own account boarding address |
| Amount | 1,000 sats |
| Fee | 0 sats |
| Estimated Arkade afterward | 263,715 sats |
| Estimated Bitcoin afterward | 1,000 sats |

The quote expires; re-review before any separately authorized submission. This single diagnostic withdrawal is not the complete account-switch/pay/mint/pay acceptance sequence. Each financial action required by that acceptance still needs its defined confirmation.

### Authorized reproduction handoff

The user subsequently authorized this single 1,000-sat withdrawal at a 0-sat fee. The snapshot bundle hash was rechecked and unchanged. The expired quote was refreshed in the actual UI, which again showed amount 1,000, fee 0, estimated Bitcoin 1,000 and Arkade 263,715, returning Bitcoin to the same account's boarding address.

Automatic approval review rejected the agent's `Confirm Transfer` click, stating that financial actions require user execution. No alternate submission method was attempted. A read-only follow-up still showed the review screen and Confirm Transfer button. The stable tab remains open for the user to click; capture of the live settlement result remains pending. This is an execution restriction, not missing user authorization or evidence of a settlement failure.

## Recovery capability and remaining gates

The official [settlement intent documentation](https://docs.arkadeos.com/arkd/components/intent-system) was reread during apply: no-expiry intents and empty proof-based deletion acknowledgements do not establish operation-specific terminal cancellation. The proposal's upstream issue review remains the source for PR #917 and SDK #372; attempts to reopen those GitHub pages through web retrieval returned cache misses, not new issue-state evidence.

Installed SDK declarations expose `deleteIntent` but no operator ownership-query method. The `getIntents` matches are local wallet/repository methods. The exact deployed lookup contract, selected-batch visibility, multiple-intent targeting and cancellation race guarantees remain unproven. Tasks 3.1–3.4 are not delivered; no custom signed REST workaround or cancellation release path was introduced.

The exact original settlement failure test/repair (1.3–2.1) remains open. Existing receipt verification and the post-resolution sequence are useful evidence, not substitutes for that diagnosis. Subsequent real-handler, lifecycle, local-processing failure, and migration coverage is recorded below.

Overlapping changes remain authoritative for their undelivered scope: `cancel-pending-transfer` has no verified finality path; `fix-asset-bearing-arkade-withdrawals` and `add-bitcoin-boarding-settlement` still lack the required live completion gates. The archived lifecycle change explicitly records incomplete live delivery. This change adds no competing cancellation controller and does not close or archive those gates.

## Continued implementation after user-execution handoff

The stable tab was inspected again: it remained on the expired review, with no submitted result. Its generated files have not been overwritten.

Task 4.2 now has a reproduced and repaired defect: completion of an older operation failed to refresh the wallet when the latest operation remained pending, while repeated checks of a latest completed operation repeatedly refreshed it. Reconciliation now detects transitions in durably saved records, publishes each resolution once to the existing shared wallet refresh path, and also handles a successfully saved earlier resolution followed by a later reconciliation error. A provider return value without persisted completion cannot release availability.

Eleven new tests cover balance/assets/Activity, older versus latest completion, repeated checks, the shared observer, persistence failure, balance unavailability, account replacement, and partial reconciliation failure. The existing exact B1 sequence still passes. All **144 tests across 19 affected suites**, typecheck and production build now pass. This source change is intentionally not copied over the prepared live diagnostic snapshot; that snapshot continues to identify its original bundle and diagnostics.

Failure metadata in the current source now reads the SDK's exported `sdkVersion`, rather than the application's dependency declaration; the installed export is `ts-sdk/0.4.67`.

Public operator PR source and both cache implementations were inspected directly. [RECOVERY-CAPABILITIES.md](./RECOVERY-CAPABILITIES.md) records the transport, overlap matching, cache-only lookup, and a concrete selection/deletion race that makes an empty successful deletion response insufficient for terminal cancellation. Source analysis is not presented as executed Go tests or verified deployed behavior; the specified recovery gates stay open.

## Real SDK handler and legacy migration coverage

`boarding-legacy-reconciliation.test.mjs` adds nine passing production reconciliation tests for scoped and unscoped legacy journals, missing diagnostics, and already-known commitments. Exact confirmed Bitcoin/asset/input evidence resolves the original operation; absent, unconfirmed, wrong-amount, wrong-asset, and wrong-attribution evidence retains its reservation. Original IDs, inputs, asset quantities above JavaScript's safe integer limit, and the original unscoped evidence are preserved. A different account cannot read or mutate the journal, repeated checks do not replay the operation, and signing-wallet creation, registration, deletion, and network access are forbidden in these fixtures. Task 3.5 is complete.

`boarding-sdk-handler.test.mjs` adds ten passing tests using installed SDK 0.4.67's actual `Batch.join`, `Wallet.createBatchHandler`, PSBT/tree validators, and Bitcoin/Arkade/asset recipient validators through production `submitBoarding`. Public single-leaf transaction fixtures exercise the pre-nonce boundary. A valid control reaches session initialization and nonce submission with an exact asset quantity of 9007199254740993; wrong commitment ancestry, absent asset extension, and wrong asset quantity each fail for their specific validator reason before nonce construction. Missing cosigner participation skips signing. Closed streams, selected/unrelated batch failures, and lost confirmation/nonce responses retain accurate observed action, pending status, and the input reservation; another quote cannot reuse that input and registration occurs once.

The installed SDK throws on an unrelated `batch_failed` event, but the adapter correctly avoids labelling it as failure of the selected batch. This is characterized behavior, **not evidence that it caused the historical withdrawal failure**. Initial fixture execution used an encoded BIP68 sequence where the handler requires raw seconds; correcting the fixture to 172032 seconds removed that fixture-only failure. No production correction or original-cause claim is based on it.

Task 2.2 is complete. Session nonce/signature methods and operator transport are controlled seams: this does not claim full MuSig signing, multi-level tree coverage, live operator execution, finalization, or a successful real withdrawal. Those delivery gates remain open. The stable user-handoff build is unchanged.

Revalidation after these test additions: **163 tests across 21 affected suites passed**, `git diff --check` passed, and strict OpenSpec validation passed. Typecheck and production build remain the previously recorded passing runs; these additions changed only test and planning files. Overall progress is 8/23 tasks. The stable browser was inspected again and remains on the expired, unsubmitted withdrawal review; it was handed back to the user without a submission attempt.

## Lifecycle stop and postcommit recovery

Task 2.3 reproduced an adapter defect before changing production code: after its deadline caused temporary-wallet disposal, a queued real SDK tree-signing event still reached `submitTreeNonces` (observed count 1, expected 0). Wallet disposal alone does not cancel the adapter's interactive signing path. `runBoarding` now owns a settlement abort signal, combines it with the SDK's provider stream signal, aborts that stream on teardown, and checks active ownership/account/deadline before participation and nonce/tree/forfeit submissions, including after awaited diagnostic writes. The original journal remains reserved; the change introduces no registration retry or nonce restoration. The same deadline test now passes with zero late nonce submissions, and an account-replacement test also prevents late submission. All handler cases verify that teardown aborts the provider stream.

Four additional `boarding-worker-lifecycle.test.mjs` tests verify actual context navigation leaves the session-owned worker running, a fresh JavaScript worker realm cannot inherit the old worker or present persisted nonce progress as active, and installed SDK disposal behavior. In 0.4.67, `ReadonlyWallet.dispose` invokes the actual synchronous `ContractManager.dispose`, stopping its watcher and clearing callbacks; `Wallet.dispose` separately awaits rotator and VTXO-manager teardown before disposing the contract manager. Thus the previously noted unawaited base-manager syntax is not itself a reproduced #801 defect in this installed version. The fresh-realm test models process state loss; real browser reload acceptance remains task 5.2. Task 2.3 is complete.

Seven `boarding-postcommit-recovery.test.mjs` tests run the SDK's actual `_settleImpl` postcommit branch with a controlled `Batch.join` commitment and an injected local repository-update failure. The SDK records `batch_succeeded` and does not cancel, while the adapter correctly retains its unresolved original journal. Production read-only reconciliation then resolves single and shared commitments from exact confirmed Bitcoin/input/asset evidence, preserving original IDs and inventory; missing, unconfirmed, wrong Bitcoin, wrong assets, or missing change leaves the reservation intact. Counters prove no signing wallet, replay or cancellation during reconciliation. This test deliberately isolates the postcommit seam; it does not replace real handler coverage or live acceptance. Task 2.4 is complete.

Latest verification: **176 tests in 23 affected suites pass**, typecheck passes, and production build passes (main bundle `index-CVtZBY0G.js`). Existing dynamic-import/chunk-size warnings remain. The prepared live diagnostic snapshot has not been overwritten. Progress is **10/23**; these lifecycle and recovery corrections are not presented as proof of the original pre-nonce withdrawal cause or completed live withdrawal.

## Remaining-work audit and execution block

The next continuation inspected the authoritative worktree and prepared Chrome tab again. The tab still displayed the expired review for 1000 sats, fee 0, with Confirm Transfer disabled and no submitted outcome. The prior continuation made implementation progress; this inspection does not establish a running settlement or a verified wait on one.

| Remaining tasks | Missing evidence or dependency |
| --- | --- |
| 1.1, 1.3, 1.4, 2.1 | Historical public observations do not contain the original exception, and the current origin has not supplied a new submitted diagnostic operation. The original root-cause repair cannot be selected from unrelated passing/failing fixtures. |
| 3.1, 3.2 | Public source analysis is documented, but deployed ownership-query behavior and operation-specific cancellation finality remain unverified. Lookup absence and empty deletion acknowledgement cannot close these gates. |
| 3.3, 3.4 | Installed SDK lacks the required operator ownership-query surface; no verified terminal cancellation guarantee has been established. No custom signing/deletion workaround is authorized by this capability-gated design. |
| 5.2 | Stable actual Admin recovery/B1 acceptance needs an unresolved or verified resolved operation and unavailable-capability evidence; isolated UI fixtures and a fresh JavaScript realm do not finish this browser gate. |
| 5.3, 5.4, 5.5 | User-executed authorized financial actions, exact confirmed withdrawal/payment receipts, and an existing interrupted operation's verified resolution remain missing. |
| 5.6 | Delivery limits and overlapping requirements are documented and strict validation passed, but final reconciliation cannot declare the outstanding live/recovery requirements delivered. |

The same user-execution restriction has persisted for more than three consecutive goal continuations. Independent handler, lifecycle, migration, refresh and postcommit work has been completed; further synthetic cases cannot establish the missing live outcome or operator guarantee. The goal is blocked pending the user's direct submission and, for terminal cancellation, supported operator/SDK evidence. No operation is cleared, replayed, cancelled or submitted as part of this audit. Resume with the existing prepared diagnostic tab, refresh its expired quote in the UI, and capture the public result of the user's submission; do not overwrite its identified bundle while it is signing.

## Autonomous read-only follow-up

After the user reported `http://127.0.0.1:5174/` working and requested no human interaction, the running Admin and read-only journal diagnostic were inspected again. The diagnostic reported no pending withdrawal journal on this origin; this does not prove historical completion or cancellation. No financial action was attempted.

A public HTTP read confirmed Signet, session duration 60, a blank operator version, and no advertised `vtxoTreeExpiry` field. A 55-second unauthenticated batch-stream observation received HTTP 200 with `Accept: text/event-stream` and observed `batchStarted` events at 2026-09-08T16:48:33.938Z and 16:49:08.951Z, both with expiry 7775744 and six intent hashes (the hashes were not retained). An ordinary JSON-style request had returned HTTP 501, `Streaming Method Not Allowed`; the EventSource header succeeds, so that 501 is not a demonstrated browser defect. The read completed at its bounded timeout.

The real installed SDK `createBatchHandler.onBatchStarted` was exercised locally with the observed expiry and operator public forfeit key normalized as `Wallet.create` does, using only a simulated confirmation callback. It returned `skip: false` and completed sweep initialization. Thus current public expiry/key encoding does not reproduce the historical post-participation failure. No live registration, confirmation, signing, cancellation, wallet mutation or dependency change occurred. The original repair and live acceptance remain unproven; these checks do not justify an invented fix or bypassing the submission restriction.

## New user reproduction and output-index repair

This section supersedes the earlier lack-of-current-operation/root-cause block. The user restored 264715 Arkade sats, paid B1 successfully (263715 remaining), and personally submitted a 1000-sat withdrawal. Current Admin is Vite at `http://127.0.0.1:5174/`, application 0.14.1, installed/runtime SDK 0.4.67. The operator's public version remains blank, so a deployed commit cannot be asserted.

Operation `4428bcbe-72db-43e9-a59d-f39150837dae`, intent `3a8bae68-0516-48d6-96ed-195f5bf8b5e9`, batch `4eae49ce-4816-425c-aa59-2d848f816981` reached `batch-selected / validate-tree`, then interrupted with `response-mismatch` at 1788886664216. No commitment or attempted nonce submission is recorded. Input `e4d8b3a960abf1c6dedce7e6c8669cfe4ae0fc1c2142fda2d10050866a92bc06:1` contains 263715 sats and two assets (quantity 1 each). Expected Arkade change is 262715 sats retaining both. No secrets or signing material were inspected or captured.

At **2026-09-08T17:12:14.119Z**, a fresh read-only browser check still found that exact input unspent with both assets intact and no matching 1000-sat Bitcoin receipt. The original pending journal is preserved. No live registration, signature, participation confirmation, cancellation or payment was performed by the agent during this inspection.

### Demonstrated defect

- Installed `Ramps.offboard` returns Bitcoin output 0 followed by Arkade change 1. Actual `Wallet._settleImpl` assigns the input assets to that owned change output 1.
- [Official operator leaf builder](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/internal/infrastructure/tx-builder/covenantless/utils.go#L46) removes onchain receivers while preserving offchain order, then appends the stored asset extension.
- [Official asset conversion](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/pkg/ark-lib/asset/asset_group.go#L215) replaces asset inputs with the intent reference but copies asset output indices unchanged. Bitcoin-first therefore leaves an asset index 1 pointing past change at index 0.
- The new regression captures actual SDK output/asset construction, applies those source-backed operator transformations, and uses actual `Batch.join`, `Wallet.createBatchHandler`, tree and recipient validators. Before production correction it fails with `ServerResponseMismatchError: asset output not found ... at index 0`. The old-order negative control retains this failure. Corrected production output order reaches the controlled nonce submission seam with the user's 263715/1000/262715 amounts and both public asset IDs, without relaxing any validator. Existing exact large-quantity and tampered-proof tests also pass.

The live record lacks its original raw exception and tree; this is a deterministic compatible source-backed reproduction of the observed pre-nonce error class, not a claim that the raw live exception was recovered. Operator source is pinned, not a claimed deployed version. Adjacent SDK #801/#831 reports are not used as the cause. A targeted public issue search added no confirmed matching issue; further API access hit its unauthenticated rate limit.

### Correction and limits

`boarding.ts` puts asset-bearing Arkade change first before SDK construction, signing, and quote fingerprinting. The unchanged SDK computes Bitcoin index 1 and asset change index 0. The pre-registration proof guard verifies this layout. Asset-free withdrawal/onboarding layouts remain unchanged. A specific allowlisted `asset-output-missing` diagnostic now preserves this validator reason for future errors, without retaining error messages or asset IDs. Its regression failed before the diagnostic correction and passes afterward.

Tasks 1.1, 1.3, 1.4 and 2.1 are complete; live and recovery gates remain open. The source-backed reproduction covers validation and a simulated nonce transport, not real MuSig completion or a confirmed Bitcoin withdrawal. The existing registered Bitcoin-first intent cannot be repaired by editing a journal or reordering a later request. Its old reservation has not been released. A valid pending sole-input withdrawal also still reserves that whole input until verified resolution; continuous B1 while it is pending requires separate input-layout work as already scoped in design.

The running Vite server returns HTTP 200 for the production boarding module and serves the corrected change-first output order. After the output-order correction, 169 tests across 20 affected suites passed, including the exact pay/mint/pay/withdraw/B1 sequence, handler, recovery and reservation coverage. The additional safe-diagnostic regression passes (11 lifecycle tests, previously 10). Typecheck and production build passed; final build validation follows below. Existing dynamic-import/chunk-size warnings remain.

Final validation: **179 tests across 22 affected suites pass**, including recovery-report/access checks and the additional lifecycle case. Strict OpenSpec validation passes. The final build initially hit sandbox `spawn EPERM`; the approved build rerun passed typecheck and both production builds, producing main bundle `index-Dtl66BcC.js`. The Vite module check confirms the corrected implementation is served, but it does not claim a new live financial success. Overall task progress is 14/23; existing-operation recovery, live completion and post-resolution B1 remain unverified.


## Logout policy correction (2026-09-08)

User requested that player transaction records not survive logout unless SDK guidance or the official Signet wallet supports retaining them. No recommendation to retain them on logout was found in the TypeScript SDK lifecycle/API material reviewed. `IWallet.clear()` explicitly clears local wallet data, including history; this is an available API, not a universal app logout policy.

The actual Signet bundle `/assets/index-CSNLmFi0.js` was read on 2026-09-08. Its equivalent action is named **Reset wallet** and uses one backup checkbox. The deployed handler clears localStorage (preserving reset configuration), swap records, wallet and contract repositories. This was verified in deployed code, without resetting a real wallet. Public source agrees:
- https://arkade-os.github.io/ts-sdk/interfaces/IWallet.html#clear
- https://github.com/arkade-os/wallet/blob/master/src/screens/Settings/Reset.tsx
- https://github.com/arkade-os/wallet/blob/master/src/providers/wallet.tsx
- https://github.com/arkade-os/wallet/blob/master/src/lib/storage.ts

BIS now requires one backup checkbox and clears player transaction/recovery records on logout, including pending, completed, unreadable, continuation and reservation records. Submitted transactions are not cancelled. Separate Admin game-wallet records remain intact.

Validation: 25 targeted logout/cleanup/restart tests pass; type checking passes. Chrome isolated UI fixtures pass for zero and five pending transactions in both host presentations, covering checkbox, cancellation, reopening, retry, successful logout and actual production web-storage cleanup against in-memory test data. No real wallet was logged out or erased.

Follow-up: restored the original pending-loss checkbox when the pending count is greater than zero: 'I accept losing my (N) pending transactions.' Both acknowledgements are required in UI and core; zero pending shows only backup. Player records are still cleared on confirmed logout. All 25 targeted tests, type checking, and zero/five-pending Chrome fixtures pass.
