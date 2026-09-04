## 1. Authorized UI delivery

- [x] 1.1 Add validated Bitcoin/Arkade balance totals and public transfer navigation; test nonspendable Arkade holdings, invalid reads, navigation and account isolation.
- [x] 1.2 Implement Total-first split fields, Copy controls and Account Transfer entry/review with unavailable execution; verify directions, amount controls, Back, clearing and narrow layout in a real browser.
- [x] 1.3 Add D4 Admin demonstration, synchronize docs and run build, relevant tests and strict OpenSpec validation; record the delivered UI separately from pending transfers.

## 2. Bitcoin to Arkade (live verification follows reverse transfer)

- [x] 2.0 Eliminate background signing/settlement from account and wallet readers; verify read-only identities and disabled automatic settlement.

- [x] 2.1 Verify current SDK/operator boarding support, the existing deposit's confirmation/expiry/eligibility, partial boarding/change, eligible maximum and real fee quotes; record public evidence and supported amount constraints. Do not require reverse-direction support or silently replace a requested partial amount with a whole deposit.
- [x] 2.2 Implement Bitcoin-to-Arkade eligibility and quote/review only; verify amount validation, Max, fee/net/projected balances and changed-input/fee invalidation. Keep submission disabled until task 2.3 is complete; unsupported partial amounts show a clear explanation.
- [x] 2.3 Implement boarding operation records, same-origin serialization, restart reconciliation and unresolved-operation account-clearing guards using the prepared/submitting/registered boundary and conservative unresolved outcome policy in the revised design before enabling submission; verify duplicate clicks, reload, timeout, late results, account isolation and uncertain outcomes cannot trigger blind resubmission.
- [ ] 2.4 Connect explicit confirmed Bitcoin-to-Arkade submission and verify an actual Signet transfer plus fresh balances and Activity in a real browser. Verify each direction is independently gated by eligible funds and verified quotes; record completion separately from a failed post-transfer balance read.
- [ ] 2.5 After task 2.4 succeeds, rerun the separate achievement change's funded issuance/list/restoration feasibility gate; record evidence there without claiming achievement implementation complete. This gate does not depend on reverse transfer delivery.

## 3. Arkade to Bitcoin (current priority)

- [x] 3.1 With current live funds on Arkade, verify a suitable account-controlled Bitcoin destination, SDK/operator withdrawal support, amount selection/change, fees and recovery; record evidence without assuming the boarding address is an appropriate withdrawal destination.
- [x] 3.2 Implement reverse-direction eligibility, Max and real quote/review, reusing the operation safeguards from 2.3; verify direction changes invalidate prior review and insufficient eligible funds cannot be submitted.
- [x] 3.2a Diagnose the reported pending warning against the existing attempt: inspect relevant public journal fields and read-only SDK/operator/chain evidence; establish whether it is submitting, registered, awaiting confirmation, completed, or unverifiable. Verify the reported 1,000-sat balance and eligibility without assuming it proves failure. Do not clear or resubmit the attempt.
- [x] 3.2b Establish authoritative SDK/operator evidence for terminal failure and inability to settle later. Implement verified-failed reconciliation only for proven supported evidence, with durable record validation and lock-protected guard release; otherwise retain uncertainty and document the concrete investigation path. Preserve sanitized diagnostic categories from submission errors.
- [ ] 3.2c Add regression tests for review-only behavior, known progress versus verification failure, confirmed completion, authoritative failure, ambiguous/rejected/expired responses, reload and late callbacks. Prove no uncertain attempt is cleared or retried and a resolved failure requires fresh review and explicit confirmation.
- [x] 3.2d Update transfer status presentation and verify it in the production browser flow: show the existing attempt, evidence-supported progress, actionable verification errors and safe next action. Review alone must not show a new pending operation. Keep Log Out and Reset blocked only while the recorded outcome is unresolved.
- [ ] 3.3 Enable explicit confirmed Arkade-to-Bitcoin withdrawal only after its own gates pass; verify real Signet completion, interruption recovery, fresh balances and Activity. Update documentation and retain unrelated unperformed verification as pending.

Implementation and remaining live-verification gates: [BOARDING_VERIFICATION.md](BOARDING_VERIFICATION.md). Both directions are implemented; actual user-confirmed transfers and achievement feasibility remain unchecked.

Recovery update: 3.2a, 3.2b (documented conservative fallback) and 3.2d are complete. Task 3.2c has passing coverage for review, uncertainty, interruption, reload, late callbacks and success; its authoritative-failure/retry branch remains open until a supported proof source exists. The existing registered withdrawal has no verified outcome, blocking live tasks 3.3 and 2.4 and the subsequent 2.5 gate. Do not clear its journal to bypass these gates.
