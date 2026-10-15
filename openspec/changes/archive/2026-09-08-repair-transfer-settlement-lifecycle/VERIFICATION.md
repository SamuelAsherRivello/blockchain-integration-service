# Settlement lifecycle evidence — 2026-09-08

Implementation is incomplete. No live completion claim is made for either direction.

## Existing operation, inspected without replay

Read-only Admin-origin diagnostics at 2026-09-08T09:29:36.806Z inspected operation `72b79ec0-9359-4d57-be8c-0bacf512a5ea`, intent `54bc086c-bcb8-4102-90cf-4f81186c2a44`, 1,000 sats Arkade to Bitcoin. Journal creation time is 1788856670555 milliseconds, not a chain timestamp. The journal contains registered phase and settlement-interrupted diagnostic, with no commitment ID and no detailed signing-stage observation. Thus registration is proven; continued active signing is not.

Public indexer read shows its original 280,715-sat input `9b642c1259ba82736eba7226f1135ccc415ae03073127f16abb7c5756caff747:0` spent by `f4f4ab5011430e9dee9cd4ba84ef60ee94a14a4bdc658d3af6d37cabd955c29c`, with empty settledBy and Ark transaction `b2cd9ba40cd2676562b65f5056244865e21927c57b45f2d6b37060bb0c2c0b0b`. The latter has an owned 279,715-sat preconfirmed output created at 09:12:41 UTC, holding the same three asset IDs and quantities. This is not proof of withdrawal settlement or attribution to the recorded intent.

Esplora returned two old address transactions, neither a matching new 1,000-sat receipt. The original input's commitment `438f487ba60562e628e4cb5de8d25320d4cc8b7f5ecfefd1f4f7d502fb29413c` is an older funding commitment; it cannot be relabeled as this withdrawal. The operator reports Signet and a 60-second session duration, which is not a promised completion time.

The old journal cannot identify whether batch selection, nonce exchange, signing validation, network delivery or disposal caused interruption. Exact missing evidence: last provider action attempted and acknowledged for this intent, batch outcome, and the worker's ending condition. New stage instrumentation captures the first two local observations on future authorized attempts; operator-side intent outcome remains inaccessible through the inspected public readers. No new transfer, cancellation, journal clear or retry was performed.

## Installed SDK continuation matrix

Inspected @arkade-os/sdk 0.4.67 bundled source, `_settleImpl`, `createBatchHandler`, `Batch.join`, and `reconcileStaleIntents` in `node_modules/@arkade-os/sdk/dist/chunk-AEWJU6NZ.js`.

| Proven stage | Existing API and required state | Safe continuation / authorization |
| --- | --- | --- |
| Before registration | settle with reviewed inputs, live identity and durable submitting marker | Original confirmed attempt only; fresh quote if terms change. |
| Registered | Batch.join event stream, original intent and live handler | Existing worker may continue; no proven generic resume after losing handler state. Never register a replacement automatically. |
| Batch selected | confirmRegistration acknowledgement for original intent | Original worker continues only. A public intent ID alone cannot reconstruct signing state. |
| Signing | submitTreeNonces, submitTreeSignatures; retained signing session and nonce state | Original worker only. Reconstructing or reusing nonces is unsupported. |
| Final signatures | submitSignedForfeitTxs after SDK validation | Existing worker awaits BatchFinalized; an unsigned commitment event is not broadcast proof. |
| Commitment returned | settle completion returns commitment ID | Read-only receipt reconciliation; no new signing authorization needed. |
| Interrupted / session state lost | Public indexer and Esplora reads; SDK reconcileStaleIntents is not a signer resume | Needs recovery. No proven exact-intent signing resume implemented. Reservations remain. Operator evidence or a separately proven continuation is required. |

SDK errors may persist a cancellation label even when automatic deleteIntent is rejected by the adapter. Neither that label nor timeout proves terminal financial failure. Temporary-wallet timeout/disposal terminates local ownership; the coordinator removes completed/rejected workers and public projection does not infer activity from registered state.

## Regression and implementation evidence

Two initial lifecycle regressions failed before implementation: interrupted and legacy registration lacked an execution condition. Added session worker ownership, additive validated stage/action/time fields, provider acknowledgement instrumentation, exact-operation reconciliation locking, monotonic stage preservation and public status projections. A returned commitment is recorded separately from verified receipt; no unsigned batch payload is recorded as broadcast.

Six lifecycle tests cover interrupted/legacy status, late lower-stage observations, duplicate worker ownership, background rejection and operation-specific timestamps. Recovery-report tests cover safe projections. Full integration run: 279/280 passed initially; the sole failure was the deliberately changed no-replay wording assertion. After updating that assertion, all 10 lifecycle/report tests passed. Typecheck and both production builds passed; Vite reports existing large-chunk warnings.

Loaded Admin identified version 0.14.1. Checkout HEAD was `e68f356b553d49c90d7888ebb9cd6a262d9a6ad3` with substantial concurrent uncommitted edits, so this is not a clean release-revision acceptance. The preview reloaded during inspection without a reload action from this task. No live signing test was initiated under that condition.

## Remaining gates

- Establish the actual settlement fault using stage observations or exact-intent operator evidence; status instrumentation is not itself a settlement repair.
- Verify actual Admin/SDK navigation and interruption behavior, including late callbacks and shared-commitment receipt attribution.
- Prove one authorized live transfer in each direction with exact receipts, assets, balances and safe post-signing recovery. Existing unresolved attempts must not be duplicated.
- Keep live tasks unchecked until those observations exist. No SDK upgrade, backend, signing-secret persistence or cancellation workflow was added.

Browser UI verification at `/tests/transfer-host.html` passed with production AccountTransfer components and isolated test doubles: pending acknowledgement, either-direction warning, Cancel, fresh review after Yes, and changed pending IDs at final confirmation. This does not establish real SDK settlement or live navigation acceptance.

Final integration suite rerun with `node --test --test-reporter=dot BIS/packages/integration/tests/*.test.mjs` passed all 280 tests. Strict OpenSpec validation passed for this change and both overlapping changes.

A subsequent real Admin read showed 279,715 Arkade sats and zero Bitcoin. This task selected Arkade to Bitcoin, entered 1,000 sats and clicked Review Transfer (quote-only). Before a review or pending warning could be inspected, the page returned to its initial state with every story unselected, consistent with the earlier unsolicited reloads. No Confirm Transfer was clicked. Live signing acceptance remains blocked by the unstable development session as well as the missing original-intent stage evidence.

## Continued application and real reproduction

The development reload blocker was bypassed without replacing the server or copying credentials. A built Admin snapshot was copied to ignored `output/transfer-acceptance-20260908/`, with entry `index.htm` served on the same localhost origin. HTTP 200, expected bundle and absence of `/@vite/client` were verified. Snapshot bundle `index-BonEMeg2.js` SHA256: D5EDCE373B42A21941F4E2A43FABACCFF96EBF2B422D5CFDC9920DBF292E790F. It remains independent of subsequent source edits. This snapshot predates the later detailed diagnostic classification.

Using the previously authorized 1,000-sat Signet amount, the real Admin showed the existing pending warning; Yes obtained a fresh quote on unreserved inputs: 1,000 sats, zero fee, Bitcoin estimate 1,000 and Arkade estimate 278,715, total 279,715. Confirm Transfer was clicked once. The exact pending acknowledgement appeared. No older operation was replayed.

New operation: `3253e5d4-863f-4fa3-8093-e30533632fa0`.
New intent: `de5bfafe-742b-4b48-843c-30e893cf8f80`.
Observed stage time: 2026-09-08T10:00:52.165Z.
Last acknowledged stage: batch participation confirmed.
Execution: interrupted; recovery needed.
No commitment or chain timestamp was reported. Explorer remained disabled. A later read-only Refresh Transactions left the same outcome intact.

Acknowledgement dismissal and navigation through Balance, Account, Accounts Details and Transactions preserved the new operation and exposed its progress. This does not prove active signing survived the whole navigation sequence: the worker had already interrupted by the detailed observation. Thus live lifecycle and completion gates remain open. The stable snapshot removes HMR as the explanation for this reproduction, but does not establish why SDK execution stopped after participation confirmation and before a recorded signing provider request.

An independent, reproduced verifier defect was corrected: multiple local operations sharing one commitment previously each compared against all owned outputs. Group matching now requires disjoint inputs, exact total Bitcoin receipt/change by address, distinct owned receipt outpoints, one-use receipt matching and each asset inventory. Tests reject absent receipts, reused receipt outpoints, duplicate inputs, foreign-wallet attribution, missing assets and incorrect Bitcoin change. This correction does not explain the new pre-signing failure and is not presented as its repair.

Adapter-stage regression confirms provider acknowledgements continue after the foreground response, keep signing state alive, and preserve interruption without inventing broadcast. Context regression checks the owning account remains current across closing/reopening panels and opening Activity while a submission is outstanding. Transaction detail test separates local progress time from absent chain time. Later instrumentation adds exact selected-batch event correlation, tree/finalization validation observations, and allowlisted response-mismatch, stream-closed and selected-batch-failed diagnostics; raw errors, proofs and nonce material are not persisted. These later categories cannot recover the already-swallowed error from the live reproduction.

Validation: full integration suite passed (304 tests at that run, including concurrent checkout additions); subsequent final focused transfer checks passed 38/38, with receipt-outpoint strengthening passing 5/5 and typecheck. Production builds passed with existing chunk-size warnings. The copied live snapshot is intentionally not rebuilt underneath its open session.

Remaining blocker: actual live settlement stops between acknowledged participation and the first recorded signing provider request. Both old and new attempts remain unresolved and reserve their respective inputs. No proven exact-intent signing resume exists in the inspected SDK. Do not send either again or infer failure from missing receipts. Further live diagnosis needs independent unreserved test funds with the new detailed instrumentation, or exact-intent operator evidence. No operator contact was sent. Bitcoin-to-Arkade live acceptance also remains open because the inspected player balance has zero Bitcoin. Task 1.3 and 2.5 are intentionally not marked as diagnosing/fixing this actual live failure.
