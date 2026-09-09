## Context

### Implemented output-order correction (2026-09-08)

The latest user-submitted withdrawal has a 263715-sat input containing two assets, 1000 sats to Bitcoin, and 262715 sats of owned Arkade change. It interrupted at `validate-tree` with SDK `ServerResponseMismatchError`. The old adapter retained `Ramps.offboard` output order: Bitcoin 0, Arkade change 1. Official arkd source at `f48445b8fc018211a593a555ea5cf4a23a49a07f` filters onchain receivers from the leaf while retaining the intent asset packet's output indices. Thus the change moves to leaf output 0 but the assets still reference 1. Real SDK construction plus that operator transformation reproduces `asset output not found ... at index 0` before nonce submission.

Normalize only asset-bearing withdrawal outputs to Arkade change 0, Bitcoin 1 before quote fingerprinting, intent construction or signing. Let the unchanged SDK derive `onchain_output_indexes=[1]` and asset output 0; validate the asset proof at output 0 before registration. This also remains valid if the operator later remaps indices correctly, because removing a trailing Bitcoin output leaves index 0 unchanged. No dependency upgrade, validator bypass, intent replay or journal release is part of this repair. Existing Bitcoin-first intents cannot be edited after registration. Recovery and live completion remain separate open gates. The live journal did not preserve the original exception text or tree, so the exact live subreason is inferred from the matching source-backed reproduction, not claimed as a recovered raw exception.

See proposal.md for the problem and scope. The installed dependency is `@arkade-os/sdk` 0.4.67. `arkade/boarding.ts` calls `Wallet.settle`, acknowledges registration early, and retains a background worker. It replaces automatic `deleteIntent` with a rejection. `settlementDiagnostic` preserves only response-mismatch, stream-closed and a generic interruption category. Receipt verification checks consumed inputs, exact Bitcoin receipts and owned asset change.

The archived lifecycle verification dated 2026-09-08 records a stable-build withdrawal reaching confirmed batch participation and then interruption before a recorded signing request, with no commitment or Bitcoin receipt. This historical observation is not fresh operator state. The current sequence regression produces two successful payments around a real SDK issuance, then reserves one 265,715-sat input for a 1,000-sat withdrawal with 264,715-sat change. Its settlement transport deliberately waits; it demonstrates reservation behavior, not the original settlement exception.

### Official documentation and upstream review, 2026-09-08

Issue states below were read from the public GitHub API during proposal creation. Search results alone were not used as evidence of current open/closed status. The review covered open issue titles in both repositories, with detailed reads of relevant reports; it is not a claim that every upstream issue was audited.

| Source | Verified finding | Relevance and limit |
| --- | --- | --- |
| [Settlement workflow](https://docs.arkadeos.com/arkd/transactions/onchain-settlement) | Registration, participation confirmation, tree/nonces/signatures, forfeits and broadcast are separate steps. | Registration acknowledgement is not completed withdrawal. Preserve the original signing session until its actual end. |
| [Settlement intents](https://docs.arkadeos.com/arkd/components/intent-system) | `expire_at: 0` means no expiry; deletion uses input ownership proof and returns an empty response. | Local timeout is not terminal cancellation. Query/cancel scope must be established, not inferred from a UUID. |
| [Exiting Arkade](https://docs.arkadeos.com/arkd/transactions/exiting-arkade) | Collaborative withdrawal spends selected VTXOs and settles in a batch, with change supported. | A partial amount does not imply partial reservation of one VTXO. |
| [ts-sdk #239, open](https://github.com/arkade-os/ts-sdk/issues/239) | Proposes constructing an exact-amount VTXO before offboarding. | Confirms a relevant optimization direction, not a shipped settlement fix. Coin splitting remains separate scope. |
| [ts-sdk #766, open](https://github.com/arkade-os/ts-sdk/issues/766) | Managed renewal consolidates coins and cannot express an output plan. | Supports the distinction between total balance and concurrent spending capacity; not our mint/signing root cause. |
| [ts-sdk #372, open](https://github.com/arkade-os/ts-sdk/issues/372), [arkd PR #917, merged](https://github.com/arkade-os/arkd/pull/917) | Operator added intent lookup by ownership proof and repeated matches; SDK tracking issue remains open. | Corrects the earlier blanket assumption that no operator lookup exists. Installed SDK search found local repository `getIntents`, not a provider proof-lookup API. Deployed Signet support and terminal semantics still need verification. Proof lookup is signing an ownership query, not an unauthenticated read. |
| [arkd #903, open](https://github.com/arkade-os/arkd/issues/903) | Requests deleted intent IDs in deletion responses. | Empty acknowledgement cannot by itself identify all affected intents. |
| [arkd #794, open](https://github.com/arkade-os/arkd/issues/794) | Requests notification when intents are deleted. | Silence on an event stream cannot prove an intent is still active or cancelled. |
| [arkd #899, open](https://github.com/arkade-os/arkd/issues/899) | Requests identifying the intent that disrupted a batch. | Batch failure does not necessarily identify the offending intent or authorize replacement. |
| [ts-sdk #831, open](https://github.com/arkade-os/ts-sdk/issues/831) | Reports intermittent live-regtest spend/settlement rejection and cleanup races. | Plausible diagnostic family only; the report is not proof of our deterministic post-participation failure. |
| [ts-sdk #801, open at proposal review](https://github.com/arkade-os/ts-sdk/issues/801) | Reports unawaited manager disposal on 0.4.66. Installed 0.4.67's readonly base contains `manager?.dispose()`; its contract manager disposal is synchronous. The signing wallet override separately awaits VTXO-manager disposal. | Direct lifecycle tests confirm both installed paths. The unawaited syntax alone is not evidence of this bug; the reported swap completed, so it does not establish why ours fails before nonce submission. |
| [ts-sdk #243, open](https://github.com/arkade-os/ts-sdk/issues/243) | Requests visibility into background service-worker settlement. | Related observability gap, but BIS currently owns a temporary wallet worker, not that service-worker flow. |

Boltz reports #507 and #515 were also checked and are closed; they concern Lightning/chain-swap monitoring and refund behavior. This app's withdrawal is a collaborative Ark batch exit, so those reports do not justify adding Boltz or copying refund logic.

## Goals / Non-Goals

**Goals:** finish and independently verify the original authorized withdrawal; recover interrupted operations without losing their financial identity; make failures reproducible and explainable; restore normal payment availability when the reservation is actually resolved.

**Non-Goals:** unlimited spending while a sole VTXO is legitimately reserved, coin splitting, invented success, blind replay, blanket cancellation, custom cryptography, server deployment, automatic SDK upgrades or reporting infrastructure changes as a completed financial fix. This proposal authorizes no live transaction, signing query or operator outreach.

## Decisions

### 1. Locate the failing SDK step before selecting a patch

Use the existing adapter and background worker. Add an allowlisted failure envelope bound to operation, SDK version, batch ID, last attempted/acknowledged action, public error code and worker end reason. Map known messages/codes to static labels; do not persist arbitrary error text, event payloads, proofs, nonces, signed transactions or identities. Existing legacy records remain readable with unknown detail.

The installed `createBatchHandler` validates expiry before confirmation, then constructs sweep data. Before `submitTreeNonces`, it checks cosigner participation, parses the commitment, validates the tree and expected recipients/assets, initializes the signing session and obtains nonces. `Batch.join` can also terminate on a stream error or `batch_failed`. Test these specific boundaries with the real handler and deterministic public transaction fixtures. A generic `settle()` stub that returns a hash cannot cover this defect.

Use a stable, version-identified browser build and the existing progress observations for the next authorized reproduction. Distinguish no event, handler rejection, provider rejection, deadline and teardown. If a specific upstream fix matches a reproduced failure, evaluate its exact release/commit against 0.4.67; otherwise repair only the demonstrated adapter defect. Do not relax SDK transaction/asset validation or lengthen timeouts as an unproven fix.

### 2. Completion and recovery share one durable operation

Retain operation ID, reviewed inputs, destination, amount, asset inventory, intent ID and any returned commitment. Receipt evidence remains decisive. A returned commitment followed by SDK local-update failure must remain discoverable through public evidence and cannot trigger a replacement withdrawal. Keep metadata changes additive and serialized with existing account/operation locks.

Allow logout after the wallet-backup checkbox plus the original pending-loss checkbox when more than zero operations remain unresolved. Logout removes saved identity, demo preferences and player operation journals, including pending, terminal, unreadable, continuation and reservation records. Separate Admin game-wallet records remain outside player cleanup. Submitted transactions are not cancelled, and discarded local recovery records are not promised to return on restoration. Pending operations never gate logout. Keep recovery metadata public-only and profile scoped. Administrative reset retains its existing guards.

### 3. Capability-driven recovery, not automatic cancellation

Implement a recovery coordinator within the existing cancellation capability, not a competing flow. First query public chain/indexer evidence. When proof-based lookup is available through the supported SDK boundary, explicitly distinguish it as an ownership-signing inspection and bind it to the selected account/inputs. Match every returned intent against the journal; multiple matches or missing attribution remain ambiguous. Never persist or expose the proof.

Capability gate: verify deployed operator version, SDK access, proof message format, registration queue versus selected-batch visibility, all possible lookup matches, deletion scope and settlement/deletion races. A method called GetIntent is not assumed to return terminal history. A successful empty deletion response, absence from lookup, timeout, old input still unspent or a local SDK cancellation label is insufficient on its own.

Only after that gate passes, offer the existing explicit cancellation review for one attributable operation. Persist submission uncertainty before its network call. Check completion before cancellation, after acknowledgement and during later reconciliation. A selected/broadcast settlement takes precedence over claiming cancellation. If the deployed contract cannot prove terminal resolution, keep the operation unresolved with a precise missing-evidence reason; prepare public operator-investigation identifiers without contacting anyone. This is a blocked recovery gate, not completion of the change. If SDK access requires an unsupported custom protocol path or dependency change, record the exact gap and resolve that scoped dependency decision before coding it.

### 4. Resolve reservations from evidence and refresh the existing wallet observer

Project reservation release from the verified operation state and publish one wallet invalidation so existing balance, assets, Activity and B1 paths refresh together. Preserve genuine reservations during uncertainty. Report reserved amount and the pending operation when they explain an otherwise funded payment rejection; do not call that a zero total balance.

The immediate B1 attempt during a sole-input pending swap may correctly wait/fail with that explanation. Successful settlement or proven cancellation must make a subsequent payment work without logout or manual journal clearing. Continuous B1 spending during settlement would require independent inputs and remains a separate coin-layout change.

### 5. Acceptance is financial completion, not instrumentation

Extend the exact sequence test into two layers: real SDK batch-handler settlement/recovery tests, and explicit live Signet acceptance. Keep the pending-input test as a characterization of legitimate reservation; add a separate post-resolution successful-payment assertion instead of forcing it to spend the same reserved input.

Cover plain sats and asset-bearing withdrawals, stream loss, malformed tree/recipient/asset proposals, disconnect, account replacement, page reload, lost registration/cancellation response, shared commitments and cancellation racing completion. Live acceptance requires one confirmed 1,000-sat Bitcoin receipt, exact owned Arkade asset change, updated reservation state and successful B1 afterwards. Recovery acceptance also requires an existing interrupted operation to reach a verified outcome; if unavailable, keep that gate open.

## Risks / Trade-offs

- Missing original error -> new diagnostics cannot retroactively identify it; use latest existing evidence or a separately authorized controlled reproduction.
- Generic upstream issues mistaken for a diagnosis -> require a matching failing test before dependency or signing-path changes.
- Browser session loss during interactive signing -> retain accurate interrupted state; do not reconstruct or reuse lost nonce state.
- Proof lookup matches multiple intents -> withhold cancellation and require operation-specific attribution.
- Cancellation cannot exclude selected settlement -> keep unresolved, do not release inputs or automatically replay.
- Global storage fixtures interfere across tests -> run affected suites in independent Node processes if isolation must be disabled locally.
- More public recovery metadata survives logout -> retain only what is needed to avoid losing financial state, and keep it scoped to the originating account.

## Migration Plan

1. Add compatible diagnostics and recovery metadata readers; preserve every current journal. Reconcile overlapping requirements with `cancel-pending-transfer`, `fix-asset-bearing-arkade-withdrawals` and `add-bitcoin-boarding-settlement` without marking their open live gates complete.
2. Reproduce and repair the settlement defect, then verify the recovery capability contract and implement its supported branch. Keep unavailable branches explicit.
3. Build and run an identified stable Admin artifact. Live actions occur only after separate explicit confirmation; this planning workflow performs none.
4. Verify the receipt, retained assets, post-resolution B1 and legacy-operation recovery. Record public evidence and exact build/operator versions.
5. If delivery fails, disable new withdrawal submission on the affected build while preserving read-only recovery and journals. Use an additive forward correction; do not downgrade state readers or erase pending records.

## Open Questions

- Which concrete batch-handler/provider boundary fails in the latest interrupted operation? The diagnosis task has defined outputs and is a prerequisite for selecting the repair.
- Does the deployed Signet operator expose the lookup/deletion semantics required by the capability gate? Unsupported capability blocks that recovery branch; it does not change the evidence requirements or authorize a workaround.
- Which existing operation can supply live recovery acceptance without replay? Select using public status and current ownership during implementation.
