## 1. Regression evidence

- [x] 1.1 Add a failing wallet-subscription regression for a new incoming Arkade receipt with ready Balance: hold the fresh read and assert loading, cleared amounts and subsequent ready values; include duplicate snapshots and verify one foreground cycle.
- [x] 1.2 Add notification regressions for pending then SDK-settled F3 receipts with the explicit Confirmed suffix, final-only arrivals, stable identity across metadata changes, reconnect, historical baseline and account replacement; verify no final toast from balance evidence alone.
- [x] 1.3 Trace the reported F3 transaction through SDK history, activity normalization, session classification and toast queue using only public evidence; deliver a bounded diagnosis and regression for the observed missing transition, explicitly recording if live SDK settlement evidence is unavailable.

## 2. Receipt feedback implementation

- [x] 2.1 Expose internal receipt transition identity/stage data and use it to promote new visible Arkade receipt balance reads to foreground; verify the new loading regression and existing B1 single-cycle, hidden-page and stale-result tests pass.
- [x] 2.2 Preserve foreground loading through coalesced observer updates and use existing bounded retry/error presentation; verify exhausted reads, overlapping independent receipts and navigation/account cancellation do not hang or restore old balances.
- [x] 2.3 Add the final incoming Arkade Confirmed suffix and repair any evidence-backed observation, normalization or identity defect identified in 1.3; verify one pending and one final toast, unchanged own-transfer/Bitcoin wording and no fabricated settlement.

## 3. Integration verification and documentation

- [x] 3.1 Run focused balance, wallet-subscription, shared-observer, notification and affected activity tests plus repository type/build checks; record commands and results under output/reports/f3-receipt-feedback/.
- [x] 3.2 Verify the production browser UI with Balance open: F3 pending toast, visible loading dialog, fresh Arkade balance and subsequent Confirmed toast; verify toast layering and no second loading cycle on duplicate/settled snapshots. Capture secret-free evidence under output/screenshots/f3-receipt-feedback/.
- [x] 3.3 Verify the same real Signet Arkade receipt transitions from pending to verified spendable receipt and produces both toasts with no manual refresh; record public transaction evidence and clearly distinguish any deterministic harness checks from live verification. Also verify receipt notifications with Balance closed do not open it.
- [x] 3.4 Update the relevant user-story and package documentation for loading and confirmed feedback, including that Confirmed means verified Arkade receipt, not batch settlement; verify wording matches the delta specs and preserves F3's current 1000-sat amount.
