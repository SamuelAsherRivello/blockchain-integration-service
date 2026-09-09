## 1. Establish the actual failing settlement boundary

- [x] 1.1 Record the running Admin build, installed SDK and current operator versions plus the latest existing withdrawal's public stage/action/commitment evidence in `VERIFICATION.md`; verify no signing, registration or cancellation occurs during this inspection and distinguish current evidence from archived observations.
- [x] 1.2 Add a failing regression for loss of stage-specific failure detail, then implement additive allowlisted failure metadata in boarding status/records; verify legacy records, malformed fields and adversarial error payloads never expose proofs, secrets or nonce material.
- [x] 1.3 Reproduce the post-participation failure using the real SDK batch handler and public tree/recipient/asset fixtures, covering the boundary before nonce submission; verify the test fails for an identified reason rather than deliberately holding or stubbing settlement. If existing evidence is insufficient, prepare a stable-build diagnostic reproduction and obtain explicit confirmation before its live transaction.
- [x] 1.4 Match the reproduced failure against upstream reports/source and record an exact repair decision, including compatibility evidence if a dependency correction is necessary; verify #831, #801 and other adjacent issues are not treated as causal without a matching test. Keep the settlement repair blocked if the failure remains unidentified.

## 2. Repair and verify settlement execution

- [x] 2.1 Implement the smallest demonstrated adapter/SDK integration correction from 1.4 and rerun the same failure test to passing; retain tree, recipient, asset and commitment validation and verify no replacement intent is automatically registered.
- [x] 2.2 Add real-handler tests for stream closure, selected and unrelated batch failures, missing cosigner participation, malformed tree/asset outputs and lost provider responses; verify each produces accurate observed state without fabricated completion or conflicting input reuse.
- [x] 2.3 Verify worker ownership and teardown across navigation, deadline, account replacement and page loss, including the installed disposal behavior identified by upstream #801; any necessary correction must have a failing lifecycle test first and must not reuse lost signing nonce state.
- [x] 2.4 Cover commitment availability followed by local SDK processing failure and shared-commitment receipt reconciliation; verify the original operation can resolve from exact Bitcoin/asset evidence without another submission, while wrong or absent receipts remain unresolved.

## 3. Establish and implement supported recovery

- [ ] 3.1 Verify the deployed operator/SDK intent-inspection contract against arkd PR #917 and SDK #372: query proof shape, supported transport, all returned matches, current-queue versus selected/terminal visibility; deliver a capability matrix backed by public documentation/source and controlled tests, without signing a live lookup during read-only inspection.
- [ ] 3.2 Verify deletion targeting, empty-response meaning and races with selected/broadcast settlements against operator source and controlled tests, including open arkd #903/#794/#899 gaps; document the exact evidence sufficient for terminal cancellation or the precise unsupported guarantee. Do not implement a release path based solely on absence or acknowledgement.
- [ ] 3.3 Integrate the supported ownership-query branch with the existing cancellation/recovery API and explicit review, after 3.1 proves support; verify matching, multiple results, account changes, no ordinary-status signing and proof redaction. If the required SDK surface is unavailable, keep this implementation task blocked and surface the exact dependency decision.
- [ ] 3.4 Implement the existing operation's explicitly confirmed cancellation path only after 3.2 proves scope/finality; test durable before-send uncertainty, duplicate clicks, lost response/reload, completion-before-cancel and completion-during-cancel. If finality cannot be proven, retain a precise unavailable state and leave cancellation delivery open rather than marking this task complete.
- [x] 3.5 Verify recovery of legacy journals with missing diagnostics and already-known commitments using migration fixtures; preserve original IDs, inputs, asset inventory and public recovery evidence without clearing or replaying operations.

## 4. Restore truthful payment availability after resolution

- [x] 4.1 Verify backup-acknowledged logout succeeds with unresolved operations and clears player recovery journals; retain administrative reset guards and account ownership boundaries.
- [x] 4.2 Connect durable verified resolution to the shared wallet refresh path; verify balance, assets, Activity and B1 update once for the correct account, unrelated reservations remain and persistence/refresh failures do not fabricate availability.
- [x] 4.3 Replace the misleading zero-funds explanation when all funds are reserved with an operation-specific pending/recovery reason; verify production B1 presentation remains actionable, actual insufficient funds still reject and no conflicting payment reaches submission.
- [x] 4.4 Extend `continue-pending-swap-sequence.test.mjs` to retain the exact account-switch/pay/mint/pay/withdraw sequence, characterize the legitimate same-input pending rejection and prove successful B1 after verified settlement or cancellation; verify real SDK issuance and batch-handler coverage remain distinct from transport fixtures and live acceptance.

## 5. Delivery and acceptance

- [x] 5.1 Run affected settlement, recovery, cancellation, logout, reservation and continuation tests plus `npm run typecheck` and `npm run build`; record results, using independent test processes where shared global fixtures interfere and reporting any remaining failures accurately.
- [ ] 5.2 Verify the real Admin recovery and B1 flows in a stable identified browser build, covering navigation/reload and unavailable capabilities; record browser evidence and clearly label simulated transport fixtures.
- [ ] 5.3 Prepare the user's exact live Signet sequence with current funds/assets/fees and obtain explicit confirmation for each required financial action; verify the 1,000-sat withdrawal reaches a confirmed matching Bitcoin receipt with exact owned Arkade asset change and record only public evidence. Keep this task open if completion is not proven.
- [ ] 5.4 On the same account after verified resolution, confirm an authorized 1,000-sat B1 payment succeeds without logout; verify the configured game wallet receipt and retained assets. A passing mocked payment does not satisfy this gate.
- [ ] 5.5 Resolve one existing interrupted withdrawal through verified completion or a separately authorized supported terminal cancellation; verify input release and a subsequent authorized payment without clearing journals. If operator evidence/capability is missing, document it and leave recovery acceptance open.
- [ ] 5.6 Reconcile overlapping planning requirements with the existing withdrawal and cancellation changes, update `VERIFICATION.md` with actual delivery limits and run `openspec validate fix-arkade-withdrawal-settlement-and-recovery --strict`; do not archive or mark live gates complete based on instrumentation or unit tests alone.
