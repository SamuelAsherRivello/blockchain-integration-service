## 1. Reproduce the remaining failure and prove the preparation boundary

- [ ] 1.1 Add a failing production-adapter regression for restore 264715 sats with two assets -> B1 -> review/confirm 1000-sat withdrawal -> B1 before withdrawal completion; assert the second B1 must succeed from independent change and demonstrate the current full-input reservation failure.
- [ ] 1.2 Exercise installed SDK 0.4.67's actual send/output/asset construction with exact selected inputs and a same-account 1000-sat recipient; verify distinct asset-free funding and 262715-sat asset-bearing change, including duplicate scripts, multiple assets and quantities above Number.MAX_SAFE_INTEGER, without live signing or weakening validators.
- [ ] 1.3 Verify exact-input asset-free withdrawal handling through the real SDK batch/finalization path with controlled transport; assert a 1000-sat dedicated coin yields only the reviewed Bitcoin receipt and cannot cause the SDK to add prepared change or another wallet coin. Retain the previous output-order negative/positive regressions.

## 2. Extend the reviewed plan and durable state

- [ ] 2.1 Add preparation-aware quotes with complete fee assumptions, owned asset manifest, original inputs, expected funding/change roles and Max/dust behavior; test exact-input preparation bypass, changed fees/assets/account, insufficient retained change and no signing during review.
- [ ] 2.2 Add compatible preparation state and immutable source history to core boarding records; test legacy journals, malformed records, before-submit persistence, candidate transaction identifiers, verified handoff persistence failure and preservation of original registered IDs/inputs.
- [ ] 2.3 Update the shared reservation projection for unresolved preparation inputs versus a verified dedicated withdrawal output; test B1/send/mint exclusion, no unreserved transition gap, no lingering hold on verified surplus change, multiple operations and account isolation.

## 3. Implement and reconcile the two-leg execution

- [ ] 3.1 Implement the internal same-account preparation adapter using explicit SDK selected inputs, exact pre-submit transaction/asset checks and durable uncertainty; verify tampered inputs/outputs/assets and failed persistence prevent submission, and the public Send form still rejects self recipients.
- [ ] 3.2 Implement preparation receipt verification from actual finalized transaction/ancestry and exact output indices; test lost submit/finalize responses, delayed/unavailable indexer, wrong scripts/amounts/assets, indistinguishable same-address outputs and candidate/accepted transaction mismatches without blind retry.
- [ ] 3.3 Atomically bind verified funding to the existing withdrawal coordinator and continue only the still-authorized original plan; make task 1.1 pass and assert one preparation submission, one withdrawal registration, two B1 receipts and no use of the reserved withdrawal output by B1.
- [ ] 3.4 Cover navigation, account replacement, deadline, duplicate confirmations and cooperating tabs at both mutation boundaries; verify late callbacks submit nothing, navigation retains the worker, and another context cannot consume the dedicated output before its reservation is saved.
- [ ] 3.5 Implement read-only restart reconciliation for both legs and fresh confirmation of a definitely unsubmitted withdrawal using its existing prepared coin; test reload after each durable boundary and prove no repeated preparation, registration or inherited signing authority.
- [ ] 3.6 Separate preparation and withdrawal completion evidence; test B1 spending asset-bearing preparation change before Bitcoin confirmation, exact/shared Bitcoin receipt attribution, original IDs retained and no dependency on preparation change remaining unspent.

## 4. Integrate production presentation and refresh

- [ ] 4.1 Extend the existing transfer review/pending/status flow with preparation information and linked identifiers; verify opening/review/Back never mutate, preparation is distinct from withdrawal pending, and preparation completion is not shown as Bitcoin success.
- [ ] 4.2 Refresh balance, assets, Activity and B1 after the durable handoff through the existing shared observer; verify once-per-transition updates, no autopayment, no unrelated-account updates, and truthful unavailable/persistence-failure behavior.
- [ ] 4.3 Verify the Admin consumes the production API and shows the same preparation and pending behavior; test independent B1 success, legitimate insufficient remainder after Max, asset retention, and no duplicate Bitcoin totals from the self-transfer Activity entry.

## 5. Resolve the existing reported operation through the shared recovery contract

- [ ] 5.1 Refresh and record exact public evidence for operation 4428bcbe-72db-43e9-a59d-f39150837dae and compare it with the previous capability analysis; deliver a dated evidence/dependency report distinguishing verified completion from the missing operator guarantee that excludes selected/later settlement. Do not repeat generic SDK research, sign a status lookup, or clear a reservation.
- [ ] 5.2 If supported terminal evidence is available, integrate it through the existing recovery/cancellation coordinator and verify exact scope, completion/cancellation races, lost responses and durable release; if it is unavailable, keep this task open with the exact dependency rather than implement a force-clear or count disabled cancellation UI as delivery.
- [ ] 5.3 Resolve that existing operation and verify a separately authorized B1 receipt on the same account without logout, journal removal, replacement withdrawal or compensating funding; retain public terminal evidence and original identifiers. Keep this acceptance task open until the actual recovery and payment are proven.

## 6. Delivery and live acceptance

- [ ] 6.1 Run all affected preparation, boarding, sending, asset, reservation, continuation, recovery and lifecycle tests plus typecheck/build; record the exact commands/results and distinguish real SDK paths from controlled provider/signing seams.
- [ ] 6.2 Verify an identified production browser build using the user's exact 264715 -> B1 -> 263715 -> prepare/withdraw 1000 -> B1 while pending sequence; use authorized live actions, verify the game wallet's 1000-sat B1 receipt and preserved assets, then verify the exact confirmed Bitcoin withdrawal receipt. Do not replace pending-interval acceptance with payment only after settlement.
- [ ] 6.3 Reconcile overlapping change artifacts and main-spec conflicts described in design, retain all undelivered legacy recovery gates, and run `openspec validate preserve-b1-funds-during-withdrawals --strict`; report preparation delivery and existing-account recovery separately, and do not archive or declare the full issue fixed while tasks 5.3 or 6.2 remain open.
