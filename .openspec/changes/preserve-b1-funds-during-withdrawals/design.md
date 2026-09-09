## Context

See proposal.md for motivation. Current `boarding.ts` selects enough whole unreserved coins, calls `Ramps.offboard` to construct the quote, and submits `Wallet.settle` with those original inputs. Its output-order correction fixes an asset-index defect but does not create independent change before settlement. `walletReservations` projects every pending boarding record's inputs into the shared exclusion set, including B1's `arkade/sending.ts` path. Therefore a single large input still prevents B1 throughout the withdrawal.

Read-only source inspection of installed SDK 0.4.67 shows `SendParams.selectedVtxos` spends exactly selected inputs; `_sendImpl` constructs explicit recipient outputs and then separate change with the remaining assets. It does not require an external recipient. BIS's public `sendRecipient` deliberately rejects self recipients, so preparation needs a narrow internal adapter, not a relaxed public send form. SDK output construction and finalization behavior still need executable integration tests and live acceptance before feasibility is called verified on the operator.

Official [settlement intent documentation](https://docs.arkadeos.com/arkd/components/intent-system), read on 2026-09-08, confirms whole input ownership proofs and distinct registration/deletion operations. The previous change's [capability analysis](../fix-arkade-withdrawal-settlement-and-recovery/RECOVERY-CAPABILITIES.md) demonstrates why an empty deletion acknowledgement cannot exclude a selected settlement. No new deployed cancellation guarantee was discovered or assumed. The last observed old operation at 17:12 UTC remained unspent without a Bitcoin receipt; this proposal does not present that earlier snapshot as a new live check.

## Goals / Non-Goals

**Goals:** prevent newly submitted partial withdrawals from holding excess funds through batch settlement; preserve exact assets; keep preparation recoverable; prove B1 works before withdrawal completion; retain a separately tracked old-account recovery requirement.

**Non-Goals:** spending an input twice, rewriting registered intents, blanket cancellation, restoring availability by deleting browser data or injecting game-wallet funds, automatically retrying financial mutations, custom cryptography, new SDK dependencies, or an operator deployment. Unlimited B1 payments after the independent remainder is exhausted are not promised.

## Decisions

### 1. Prepare the withdrawal amount using a normal same-account Arkade transfer

Prefer existing exact asset-free inputs covering the withdrawal funding. Otherwise, use the installed SDK's `send({selectedVtxos, recipients:[{address:own, amount:fundingSats}]})` to create an asset-free dedicated recipient output plus ordinary owned change. Pass no recipient assets so the SDK retains every input asset in change. Use the supported SDK's script/address and asset packet validation; add BIS checks binding the exact input set and each output's role, amount, script and asset manifest before submission.

At the current verified zero-fee schedule, the user's example is:

| Stage | Withdrawal funds | Independently spendable funds |
| --- | --- | --- |
| Before preparation | No dedicated input | One 263715-sat input with two assets |
| Verified same-account preparation | 1000-sat asset-free output reserved | 262715-sat output with both assets |
| Withdrawal registered | Same 1000-sat output reserved | Same 262715-sat change available |
| B1 succeeds during withdrawal | Same 1000-sat output reserved | 261715 sats with both assets |

Then settle only the dedicated output to the account's Bitcoin address. This is an asset-free exact-amount withdrawal, with no Arkade change in its settlement tree. Retain the existing change-first validation for legacy/direct asset-bearing paths.

The alternative of returning only a better reservation toast is insufficient. Releasing most of a reserved input is invalid because a coin cannot be partly spent. Splitting via settlement would still wait on the same batch and would not fix the pending interval. A preparatory send gives separate spendable outpoints before batch registration.

### 2. Preserve a single reviewed plan with two durable legs

Extend the internal boarding operation with an optional versioned preparation record; keep legacy records readable. Store original reviewed source inputs and aggregate asset manifest separately from the active withdrawal inputs. Proposed preparation states are `prepared`, `submitting`, `verified`, and `unknown`; withdrawal retains its existing registration states. Store only public candidate/accepted transaction identifiers, expected output roles and verified outpoints, never signed proofs or private signing data.

Persist a candidate transaction ID and verified manifest at the SDK's existing pre-submit transaction boundary so a lost response can be reconciled using exact public transaction evidence. Record `submitting` durably before sending. If this persistence fails, submit nothing. A hash returned by `send` alone is not success: verify finalized transaction/ancestry, exact outputs, ownership, asset inventory and current spendability through supported SDK/indexer evidence. Equal-address outputs are identified by transaction ID and vout, not by selecting the first script match.

Under the existing mutation/record locks, mark the preparation leg verified, bind its dedicated output to the pending withdrawal, and project only that output as reserved. Original input history remains immutable. The reservation transition is one durable state change; readers must never see the dedicated output temporarily unreserved. Verification or persistence failure retains the source hold until read-only recovery can finish this transition.

Keep current B1/send selection and duplicate protection. Publish the existing shared refresh only after the durable handoff so balances/assets/Activity/B1 agree. A failed Bitcoin leg keeps only its dedicated input reserved.

### 3. Keep fees, authorization and presentation truthful

Quote the whole two-leg plan, including preparation and settlement fees, asset dust floor and the independently spendable remainder. Initially retain the current zero-fee compatibility boundary, verify both legs' fee assumptions, and reject changed/unsupported fee terms instead of guessing. Max still respects asset dust and may legitimately leave less than 1000 sats for B1.

One existing Confirm Transfer action can authorize both fully reviewed legs in the current session. The original operation owns its worker, account generation, selected inputs, authorization deadline and mutation lock. After preparation, do not rerun generic coin selection: validate the actual dedicated output against the original plan and use it explicitly. If terms or authorization expire, keep verified preparation and require a fresh review for the outstanding withdrawal. A new page/session may reconcile but cannot inherit authority to send an unsubmitted leg.

Use the existing pending-operation dialog for `Preparing transfer...`; show ordinary withdrawal pending only after preparation is verified and registration has occurred. Do not represent a preparation delay as an already independent balance. Navigation retains the authorized worker; account replacement/deadline/disposal closes all late mutation gates. B1 remains a separate explicit request and is never autoqueued or autopaid by reconciliation.

### 4. Reconcile each leg with its own evidence

Preparation evidence is a finalized Arkade transaction with exact source ancestry and outputs. Bitcoin withdrawal evidence is the dedicated input's settlement plus the exact Bitcoin receipt. Once B1 spends prepared change, that change may no longer be unspent; withdrawal reconciliation must not demand it as an unspent settlement output. Assets are already proven in the preparation transaction and remain subject to the existing B1 asset-preservation checks. Activity presents one linked transfer with distinct preparation/Bitcoin IDs and does not count self-transfer preparation as Bitcoin received or two withdrawals.

If preparation is unknown, no replacement send or settlement can run. If preparation is verified but withdrawal is definitely unsubmitted, a fresh confirmation can use the same dedicated coin. If withdrawal registration is uncertain or known, retain its identity and do not replay. Read-only checks, restoration and logout protections must understand the new record shape without opening a reservation gap.

### 5. Treat old-operation recovery as a concrete external dependency

The old intent cannot use the new preparation path because its original source input is already reserved. Reuse the previous change's recovery coordinator and `account-transfer-cancellation` prerequisites. First refresh exact public input/commitment/Bitcoin/asset evidence for operation `4428bcbe-72db-43e9-a59d-f39150837dae`. If verified completion exists, save it through normal reconciliation. Otherwise establish supported terminal evidence tied to its intent and selected batch before any cancellation or release.

The remaining precise gap is exclusion of an already-selected or later-settling intent; ownership-query absence, a deletion acknowledgement, elapsed time, and `validate-tree` observational metadata alone do not prove that guarantee. Existing metadata writes were observational and cannot retroactively become a cryptographic never-signed certificate. Do not add a local `failed` status that simply frees the input. No source change proposed here can manufacture missing operator evidence.

Implementation must record an explicit result for this dependency: verified resolution with evidence, or the exact missing supported operator result. Do not repeatedly add generic research tasks or call an unavailable cancellation button a fix. Preparation can be delivered independently, but full issue acceptance and the old operation's recovery task remain open until actual resolution and same-account B1 receipt are proven. This boundary avoids promising that a new withdrawal algorithm repairs a prior registered transaction.

### 6. Keep overlapping specifications coherent

This proposal supersedes only the earlier change's exclusion of coin splitting and its expectation that a new partial withdrawal may legitimately reserve all excess funds through settlement. It preserves whole-input protection for legacy intents and uncertain preparation, the asset-index correction, and existing cancellation-finality requirements. Reconcile the affected deltas in `fix-arkade-withdrawal-settlement-and-recovery` and `cancel-pending-transfer` during apply before syncing or archiving; do not erase their open live gates. Main availability's old greyed-out B1 language also differs from the previous change's actionable B1 UI: retain the latest authorized UI behavior, while requiring successful independent payment here; this proposal does not reintroduce a cosmetic disable/enable workaround.

## Risks / Trade-offs

- Additional Arkade transaction and latency: skip preparation for exact asset-free funding; show preparation distinctly and validate both legs' fees before confirmation.
- Same-address outputs or asset-bearing SDK change behave differently than assumed: exercise actual `_sendImpl`, output/asset validation and finalized receipt mapping before enabling the path; stop at a demonstrated incompatibility instead of weakening checks.
- Lost network response, delayed indexer, or reload: retain exact candidate identifiers and reservations, reconcile read-only, require fresh authorization for a definitely unsubmitted leg.
- B1 consumes prepared change before withdrawal completion: separate leg evidence and verify asset ancestry rather than requiring original change to stay unspent.
- Legacy recovery cannot be proven using current operator capabilities: retain the old account gate as undelivered, with concrete evidence requirements; never claim preparation fixes the current reservation.

## Migration Plan

Add compatible internal state readers and tests first, then the preparation adapter, reservation handoff, shared refresh and UI integration. Do not alter old registered inputs or remove journals. Validate the exact user sequence against real SDK paths and an identified browser build. Retain the previous output-order regression. A forward rollback disables new preparation submission while preserving new/legacy record readers and read-only reconciliation; it must not restore the old unsafe state interpretation or discard financial history.
