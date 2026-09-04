## 1. Establish implementation baseline

- [ ] 1.1 Reconcile overlapping active transfer, send, mint and cancellation artifacts with this scoped-guard policy, preserving unrelated edits and outstanding verification; verify OpenSpec validation and review the resulting planning diff.
- [ ] 1.2 Inspect current SDK input-selection controls for transfers, sends and issuance, including fee inputs; deliver an evidence table with supported paths and feature-specific blockers, without submitting transactions.
- [ ] 1.3 Read the affected account's current public operation/input state and fresh eligible funds through existing read-only paths; record reserved versus independent funds or unavailable evidence without exposing secrets or claiming a terminal outcome from unspent inputs.

## 2. Durable operations and reservations

- [ ] 2.1 Add the versioned multi-operation journal and non-destructive legacy migration; verify reload, multiple records, invalid legacy records, write failure and retention of original recovery fields with focused tests.
- [ ] 2.2 Implement shared reservation/availability calculation; test disjoint funds, whole-input reservation, unknown inputs, account isolation and release of only one resolved operation.
- [ ] 2.3 Add atomic confirmation reservation and stale-work gates to every mutation boundary; test competing tabs, stale quotes, lost response, repeated operation ID and timeout before submission without real funds.

## 3. Independent spending adapters

- [ ] 3.1 Replace blanket transfer/send guards with enforced unreserved input selection for quotes, Max and confirmation; verify actual submitted input sets exclude reservations in adapter tests for both transfer directions and sends.
- [ ] 3.2 Enforce independently funded mint selection and persist all issuance/fee inputs before submission when supported by the public SDK; verify final input exclusion and idempotent reconciliation. If unsupported, deliver a precise mint-unavailable reason and retain this feature's unverified status without blocking transfers/send delivery.
- [ ] 3.3 Verify prepared-operation discard, terminal reconciliation and account-clearing protections with multiple pending records; prove discarding a draft cannot clear a submitted operation or enable late registration.

## 4. Recovery UI

- [ ] 4.1 Add public operation summaries and per-action availability to the production Account recovery view, integrating existing Check Status and Copy Recovery Details; browser-verify multiple pending operations, accessible narrow layout, truthful errors and continued access to new-operation forms.
- [ ] 4.2 Show total/reserved/independent funds, whole-input explanations, manual Receive guidance, draft discard and precise cancellation-unavailable copy; browser-verify no automatic funding, signing, cancellation or fake Undo from inspection actions.
- [ ] 4.3 Surface mint-specific availability in Admin using the same public state; verify the production API still enforces restrictions if the UI is bypassed and listAssets remains usable.

## 5. Conditional network cancellation

- [ ] 5.1 Refresh D5b's deployed operator evidence for exact targeting, active-batch exclusion and terminal outcome/replay semantics; deliver supported/unsupported findings. Unsupported cancellation does not block sections 2–4 or their verification.
- [ ] 5.2 Only if 5.1 establishes support, implement the existing D5b confirmed cancellation flow against a selected operation and scoped reservations; verify lost response, settlement race, obsolete confirmation and persistence failure. Otherwise leave cancellation explicitly undelivered in the report and its implementation tasks open.

## 6. Verification and handoff

- [ ] 6.1 Run the build and focused integration/browser checks spanning migration, recovery and independent operations; record results with fixtures clearly separated from live evidence.
- [ ] 6.2 In a separately authorized live Signet session, verify a disjoint-input send/transfer and mint where supported while the original record stays intact; verify actual outcomes and fresh balances. If no independent funds exist, report that fact and the manual funding route without funding automatically or clearing the original operation.
- [ ] 6.3 Update user-story status and deliver a can/cannot table covering current-account spending, mint input support, cancellation, draft discard, settled transfers and Log Out/Reset; distinguish removed app guards, remaining operator limitations and missing live evidence. Do not mark the original transfer resolved without authoritative evidence.
