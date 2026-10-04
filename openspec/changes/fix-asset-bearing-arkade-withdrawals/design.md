## Context

See `proposal.md` for motivation and the overlap with `add-bitcoin-boarding-settlement`. The local implementation already spans Arkade preparation, core quotes, durable records and recovery. Design is necessary because changing spend eligibility also changes asset preservation and recovery evidence.

The source uses SDK 0.4.67. Recorded local tests exercised its settlement output construction and intent encoding. This establishes local SDK compatibility, not current operator acceptance or a successful live withdrawal. The earlier verification report records nine withdrawal tests, 258 integration tests, a browser harness pass and a successful build; the full repository test command stalled after documentation assertions.

## Goals / Non-Goals

**Goals:** Keep quotes read-only, retain the explicit confirmation boundary, preserve exact asset quantities, and make pending records recoverable across the change.

**Non-Goals:** A second withdrawal mechanism, asset relocation to another wallet, SDK upgrades, fee estimation beyond the supported schedule, automatic transactions, or repairing the separate documentation-test lifecycle.

## Decisions

1. **Use SDK settlement with owned asset change.** Retain the existing Ramps capture facade for quoting and let settlement carry assets into the owned Arkade output. Merely removing the filter without retaining change is insufficient. A separate self-transfer to split assets adds another transaction and recovery lifecycle without a demonstrated need.
2. **Separate withdrawable Max from input value.** Reserve `max(wallet dust, operator VTXO minimum, 1)` when selected inputs carry assets. Store `inputSats` independently from `maxSats`, so recovery can compute exact change even when Max leaves assets behind. Asset-free Max remains unchanged. Limits and fees are freshly checked; 330 sats is a test example, not a universal constant.
3. **Bind and verify exact asset ownership.** Aggregate quantities with bigint and serialize decimal strings. Quote fingerprints include per-input inventory and owned change. Before registration, verify the SDK intent's input references, owned change output and asset extension. This rejects stale or altered allocations rather than trusting the displayed total.
4. **Persist evidence before registration.** Record the change script, sats and exact asset quantities beside existing public operation evidence. On recovery, require confirmed Bitcoin receipt, matching settled inputs and exact asset change. Missing evidence stays pending. Legacy records use their original Max as input value; no destructive migration or journal reset is needed.
5. **Reconcile overlapping planning before archive.** The prior task already updated both the main requirement and the broader change. This focused delta preserves that complete requirement and adds explicit reserve-error, asset-free and legacy-recovery scenarios. At apply/closeout, reconcile the broader change's overlapping requirement to avoid either archive restoring stale wording. Its unrelated tasks remain independent; neither change is automatically complete when the other closes.
6. **Separate local readiness from delivery.** Reuse existing code and evidence instead of reimplementing it. Refresh focused checks against the selected release revision. Prepare the BIS release handoff, then coordinate a separately authorized game-consumer update. Verify the loaded published revision before a user-confirmed live withdrawal. Unit fixtures and the isolated browser harness are never evidence of a real transaction.

## Risks / Trade-offs

- Sats and assets share outputs -> reserve sufficient owned change and reject amounts that consume it; explain Max in the error.
- Operator policy differs from tested assumptions -> read the current schedule and eligibility before review; reject unsupported fees or limits.
- Registration response is lost -> keep the durable pending record and reconcile without replay.
- An old deployed client lacks asset-aware recovery -> preserve records and prefer a forward fix; do not downgrade a client managing a pending asset-bearing withdrawal.
- Main and active delta specs overlap -> reconcile complete requirement blocks during closeout, without removing unrelated scenarios.
- A fresh account has no eligible funds or an unresolved operation -> report that specific live gate; do not infer spendability from screenshots or clear state to manufacture acceptance.

## Migration Plan

1. Confirm the existing local implementation against the delta and complete any scoped gaps with regression coverage.
2. Re-run adapter/core tests, build and browser review, recording the release revision and the documentation-suite limitation separately.
3. Prepare a release handoff identifying the BIS build and the game-consumer dependency. Publication and edits to that separate repository require the appropriate subsequent task scope.
4. On the delivered build, obtain a fresh quote and have the user confirm the chosen Signet amount. Verify confirmed Bitcoin receipt, retained assets, fresh balances and Activity; record public evidence only.
5. Reconcile the broader boarding artifacts and sync this delta before archive. If delivery fails, keep the current account and journals intact; use a reviewed forward correction rather than a destructive rollback.

## Open Questions

- The exact eligible outputs, reserve, fees and unresolved-operation state at live acceptance are time-dependent and must be read then.
- The published consumer revision and release handoff details will be recorded when delivery is scoped; they do not change the withdrawal contract.

## Confirmed asynchronous transfer interaction

Registration acknowledgement resolves the foreground request after its public intent ID is durably saved. The signer and shared browser mutation lock remain alive until settlement finishes or reaches its deadline; the account mutation lock releases at acknowledgement so another independently funded transfer can begin. Registration is pending evidence, never finality. The UI directs the user to Transactions and explains that this tab must stay open during processing.

Each operation has an independent storage key under the existing wallet journal prefix. The existing single record remains readable and is not destructively migrated. Exact operation IDs target late registration, commitment and reconciliation writes. Pending inputs are excluded from both quote and confirmation. Partial transfers select only enough whole inputs for the amount and valid change, allowing other inputs to remain available.

Before every new Review Transfer with pending operations, show the requested Yes/Cancel question in either direction. The displayed amount is the sum of pending amounts. Yes acknowledges the current pending operation IDs only for that review; Cancel does no quote or submission. Final confirmation rechecks the pending set under the account lock; a newly pending ID requires renewed acknowledgement and a fresh review. This does not override input eligibility.

Read-only background checks reconcile pending records and update Transactions after navigation. Abandoned prepared recovery alone takes the account mutation lock. A pending result from a lost registration response uses uncertain wording rather than claiming successful submission. Logout cannot interrupt an actively signing worker; the separate existing explicit logout acknowledgement policy is unchanged.
