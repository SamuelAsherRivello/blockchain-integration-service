## Context

See proposal.md for motivation. The current adapter in `packages/integration/src/arkade/boarding.ts` deliberately disables SDK automatic cancellation/re-registration. `boarding-record.ts` preserves a version-1 journal with prepared/submitting/registered phases and pending/succeeded/not-submitted outcomes; Web Locks serialize wallet mutations. Recovery only proves completion, not cancellation. The existing stuck operation is documented in the parent change's BOARDING_VERIFICATION.md; its current live outcome is not re-established by this proposal.

Evidence inspected on 2026-09-04: installed SDK 0.4.67 exposes `RestArkProvider.deleteIntent`, POSTing a signed proof/message to `/v1/batch/deleteIntent`. Its wallet implementation constructs delete proofs from inputs and uses deletion in duplicate-input recovery. This does not establish safe standalone cancellation or finality. The [official intent lifecycle](https://docs.arkadeos.com/arkd/components/intent-system) documents ownership-proof deletion and an empty successful response; it does not by itself establish the active-batch race guarantee needed here.

## Goals / Non-Goals

**Goals:** Add a separate, explicitly authorized mutation with durable uncertainty, conservative migration and public vendor-neutral state. Make the eligibility/finality evidence a prerequisite for enabling live cancellation, not an assumption hidden in UI logic.

**Non-Goals:** Resume interrupted signing, cancel every wallet intent, send replacement transfers, upgrade dependencies, introduce a backend, automatically contact the operator, clear storage or execute live cancellation during planning. No changes to the separate game repository.

## Decisions

### 1. Capability gate before enabling mutations

Verify the deployed operator's input-to-intent targeting, accepted-versus-active-batch behavior and terminal cancellation evidence against official source/version evidence. Establish a supported way to reconstruct and sign the exact recorded inputs with installed public SDK primitives; do not depend on private wallet methods simply because they appear in bundled code. Verify boarding and withdrawal independently. If targeting or finality cannot be established, keep cancellation disabled with a precise reason and report that live recovery remains blocked. This is a fixed safety boundary, not permission to invent a weaker completion rule.

The alternative of calling deleteIntent and treating every 2xx/not-found response as cancellation is rejected: acknowledgement might not exclude an already-running commitment, and the request is input-scoped rather than intent-ID-scoped. If only broader cancellation is possible, stop for a new scoped decision; do not silently cancel unrelated intents.

### 2. Separate confirmation and public API

Keep review in AccountTransfer and expose vendor-neutral core methods to inspect eligibility and confirm cancellation for an expected operation ID. Bind confirmation to account generation, operation ID, intent ID and input fingerprint; revalidate under the existing mutation lock. The UI shows Cancel Pending Transfer, then Confirm Cancellation and Back. During a request, prevent duplicate submission; leaving the view must not erase durable progress or imply the request was undone. Use the existing async loader and Signet labeling.

The confirmed D5b. Cancel Pending Transfer story has its own documentation status, flow and acceptance criteria, linked from D4 under the D5 umbrella. D5a read-only reporting is owned by add-transfer-recovery-report and does not depend on cancellation feasibility. The cancellation production entry remains Account Transfer, without an Admin bypass or coupling to Log Out. Back from confirmation is navigation only. Check Status remains strictly read-only.

### 3. Durable substate without changing the original intent

Extend the validated journal with optional cancellation metadata: attempt ID, requested time, phase (prepared/requesting/unverified/verified) and an allowlisted public evidence summary. Add a terminal cancelled outcome only when verified. Keep original transfer ID, quote, inputs, intent and commitment IDs. Legacy version-1 records without cancellation metadata remain valid and unchanged; malformed or unknown records fail closed. Never persist signed proofs or raw provider payloads.

Persist requesting before the provider call. A failed pre-request write prevents submission. A post-request write failure leaves the operation locked and uncertain; in-memory acknowledgement is not durable success. Preserve a terminal cancellation record until the normal existing operation lifecycle replaces it; do not erase it to unlock the account.

Use the existing wallet-mutation Web Lock for cancellation, transfer, mint, reconciliation and clearing. Block while an original signing attempt is active. Closing/timing out a cancellation attempt prevents a late unsent request. Late responses may update only their matching still-pending operation/cancellation attempt, never a replacement or terminal outcome. Same-origin locking does not coordinate other devices; external races remain part of the evidence gate.

### 4. Dedicated signing adapter

Use a temporary Signet signing identity only following final confirmation, with settlementConfig false and transient SDK repositories. Rehydrate only exact recorded owned inputs and reject missing, foreign, spent or un-attributable inputs. Read-only preflight first checks whether settlement has already completed. The adapter must not call settle, registerIntent or SDK safe-register recovery; create and send only the supported cancellation proof. Sanitize failures into fixed diagnostic categories and keep proof/key material out of logs, public state and persistence.

A missing intent ID, unknown registration, active attempt or recorded commitment awaiting settlement verification stays on Check Status/operator investigation. Prepared transfers that never crossed registration retain their existing not-submitted recovery; they do not need a signed cancellation.

### 5. Resolution and retry policy

The transfer stays pending while cancellation is requesting or unverified. Mark cancelled only with the capability-gated evidence establishing terminal cancellation for the exact attempt, including exclusion of an active settlement. If chain/indexer evidence instead proves completion, preserve the existing succeeded outcome. Contradictory evidence remains unresolved with investigation guidance. Unspent inputs, elapsed time and SDK local state alone are insufficient.

Do not automatically retry a cancellation whose request may have been sent, even after reload. Read-only reconciliation is the recovery path; where no authoritative query exists, keep the operator handoff. A proven pre-send failure can return to a fresh explicit confirmation. This favors honest blocked recovery over duplicate signed mutation attempts.

Only a persisted terminal result releases the existing unresolved-transfer guard. Refresh balances and Activity independently afterward; refresh failure cannot reverse the terminal result. Normal logout acknowledgement and all new transfer/mint confirmations still apply.

### 6. Dependency and presentation reconciliation

This is a new cancellation capability layered on the still-active `add-bitcoin-boarding-settlement` change. Before implementation, reconcile that change's read-only/signing requirement so explicit cancellation is the narrowly scoped additional signing path; retain its ban on automatic cancellation/re-registration. Preserve the parent transfer tests. Sync/archive the parent transfer capability before this additive capability, reconciling any overlapping wording without overwriting other pending work.

Extend Account Activity's local operation formatter and Copy-all, retaining account isolation and commitment deduplication. Document D5 separately and link it from D4, preserving existing IDs and production entry. Test doubles belong only in isolated test fixtures, never production demonstration success claims.

## Risks / Trade-offs

- Cancellation targeting or finality unsupported by the current deployment → Do not enable signing; record the blocker and operator investigation route. Planning completion does not mean live recovery is proven.
- Cancellation arrives after signing/commitment begins → Resolve using authoritative evidence; never promise reversal or a refund.
- Response lost or storage fails after submission → Keep durable pending state and all guards; never auto-retry or force-clear.
- Another device uses the same inputs → Require authoritative scope/finality checks; a browser lock alone is insufficient.
- Older application builds cannot parse the new terminal state → Fail closed. Rollback must retain the new compatible reader or disable cancellation without reverting journal compatibility; never rewrite cancelled as not-submitted or erase the record.
- Existing dirty code and parallel planning overlap → Limit edits to this change during planning and inspect affected diffs again before implementation.

## Migration Plan

1. Reconcile the parent transfer requirements and capture version-pinned operator/SDK evidence before implementation. The confirmed feasibility-first decision requires stopping before cancellation code/UI if exact targeting or finality cannot be established; a disabled cancellation button is not delivery. See FEASIBILITY.md for the currently blocked gate.
2. Add backward-compatible validation and state tests, then a guarded adapter and public API, then UI/Activity integration.
3. Run unit/adapter tests, full integration tests, build and isolated browser cases. Verify production reader paths remain non-signing.
4. Only with separate user confirmation, test an eligible Signet cancellation and verify its durable outcome, guard release, fresh balances and Activity across reload. Never create a new payment merely as a fixture without authorization.
5. If the live evidence cannot prove terminal cancellation, retain the lock, record the limitation and leave live acceptance incomplete. Rollback disables the new mutation while preserving readable cancellation state.
