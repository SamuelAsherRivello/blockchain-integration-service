## 1. Implementation prerequisites

Confirmed decisions: feasibility first for D5b. Cancel Pending Transfer, linked from D4 under the D5 umbrella. The feasibility gate is currently blocked; see FEASIBILITY.md. Do not begin sections 2–4 until task 1.2 passes. D5a read-only reporting has its own independent add-transfer-recovery-report proposal and acceptance; it is not cancellation implementation and does not release the account guard.

- [x] 1.1 After a separate apply request, inspect current affected diffs and reconcile the parent transfer change's explicit-signing requirement with cancellation; verify the planning diff preserves read-only status checks and the automatic cancellation/re-registration ban.
- [ ] 1.2 Establish installed SDK public proof construction and deployed Signet operator targeting, active-batch finality and replay semantics for both directions; deliver source/version-linked evidence and an eligibility matrix. Do not enable cancellation if exact scope or finality remains unproven, and report that blocker rather than marking live recovery complete.

## 2. Durable state and core API

- [ ] 2.1 Add failing cancellation-journal tests for legacy records, valid substates, corrupt metadata, pre/post-request storage failures and terminal evidence validation; run the focused test command and record expected failures before implementation.
- [ ] 2.2 Implement backward-compatible cancellation metadata and verified terminal cancellation without clearing the original journal; rerun the same tests and verify legacy pending records retain their guards.
- [ ] 2.3 Add failing core tests for explicit confirmation, account/operation/input binding, concurrent clicks/contexts, original transfer contention, timeout and stale late callbacks; verify each fails for the intended missing behavior.
- [ ] 2.4 Add vendor-neutral eligibility and confirmation APIs under the existing mutation lock with a durable pre-request boundary; verify the core tests pass and requests cannot target a replacement account or operation.

## 3. Signing adapter and reconciliation

- [ ] 3.1 Add failing adapter tests for exact owned-input reconstruction, unsupported capabilities, absent intent/commitment eligibility, Signet checks and no settle/register/background calls; verify the failures before adding the adapter.
- [ ] 3.2 Implement the separately confirmed cancellation adapter only for capabilities proven in 1.2, using transient signing material and disabled automatic settlement; pass the same adapter tests and assert no proof or secret enters logs, storage or public state.
- [ ] 3.3 Add failing evidence/race tests for terminal cancellation, settlement winning, contradictory evidence, lost response, not-found, acknowledgement without finality, reload and unavailable status services; verify ambiguous outcomes stay pending in the expected assertions.
- [ ] 3.4 Implement read-only cancellation reconciliation, matching-attempt late-result handling and durable guard release; pass the same tests, including no automatic retry and preserved terminal outcome when balance refresh fails.

## 4. Production UI and Activity

- [ ] 4.1 Add an isolated browser regression fixture for Cancel Pending Transfer review, Confirm Cancellation, Back, disabled eligibility, duplicate submission, stale confirmation and reload uncertainty; observe failures before implementing the UI.
- [ ] 4.2 Implement the production confirmation and status presentation with the existing loader and Signet label; verify the fixture passes, keyboard/focus behavior works, and Back/Check Status never sign.
- [ ] 4.3 Add failing Activity tests for cancellation labels, copy-all, account isolation and commitment deduplication, then implement the formatter/state integration; rerun the same tests and confirm no invented transaction, time or refund appears.
- [ ] 4.4 Integrate the production cancellation flow through the existing Account Transfer entry and synchronize D5's separate story/status/acceptance criteria and D4 cross-link; verify the production entry and documentation distinguish implemented behavior from live recovery evidence without introducing an Admin bypass.

## 5. Verification and handoff

- [ ] 5.1 Run `node --test packages/integration/tests/*.test.mjs`, relevant demo tests and `npm run build`; record results and confirm existing transfer, logout/reset, mint guard and read-only-reader regressions remain passing.
- [ ] 5.2 Verify real-browser confirmation, pending/error/reload states and terminal-state guard release using isolated fixtures; record evidence without exposing secrets or representing fixture results as live Signet cancellation.
- [ ] 5.3 After separate explicit user confirmation and only if 1.2 passes, verify an eligible live Signet cancellation, exact public operation outcome, fresh balances/Activity and restart behavior; do not submit a replacement transfer. If finality is unavailable, record the blocker and leave this task incomplete.
- [ ] 5.4 Review spec/design/task coherence and migration/rollback behavior, then record completion limits and parent-before-child sync/archive order; verify `openspec validate cancel-pending-transfer --strict` passes without archiving unfinished changes.
