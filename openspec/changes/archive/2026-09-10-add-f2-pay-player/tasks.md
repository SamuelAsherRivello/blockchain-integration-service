**F3. Send 1000 Sats (Game->Player): Complete ✓**, confirmed by the user on 2026-09-09. The historical change name uses F2. Remaining acceptance is closed on user confirmation; no new live payment was performed in this update.

## 1. Payment controller and recovery

- [x] 1.1 Add focused controller/adapter tests for fixed 1000 sats, distinct identities, missing accounts, fees, asset preservation and stale preparation; verify each rejects incorrect submission behavior.
- [x] 1.2 Extend the F1 controller and public exports with F2 payment eligibility and execution using the selected game signer and existing sending adapter; verify the tests pass without accessing player secrets from Admin.
- [x] 1.3 Add a sender-scoped F2 journal and shared mutation-guard participation; verify duplicate clicks, concurrent tabs, timeout, reload and wallet changes reconcile the original operation without resubmitting or deleting records.

## 2. Receipt and runtime feedback

- [x] 2.1 Implement exact transaction/output receipt correlation using the current adapter/indexer evidence path, including evidence for a send already marked successful; verify wrong recipient, wrong amount, unrelated balance increases and submit acknowledgment cannot trigger a receipt.
- [x] 2.2 Implement shared session observation, silent baseline, pending/final deduplication, unknown sender and own-transfer classification; wire receipt toasts to the active preview session, format the sender ID and refresh both balances; verify exact text, duplicate evidence, logout, replacement context, disposal, reload and balance-read failure behavior.

## 3. Admin and documentation

- [x] 3.1 Add F2 after F1 with the exact label and reactive grey disabled state, pending guard and safe Console outcomes; verify pointer/keyboard unavailability without a player and enablement with eligible accounts.
- [x] 3.2 Update User Story Diagrams.md and relevant package documentation with F2 direction, message, availability and API behavior; verify headings/links and preserve unrelated story IDs and concurrent F1 changes.

## 4. Acceptance

- [x] 4.1 Run relevant integration/controller/adapter tests, workspace typecheck and build commands; record commands and outcomes in this change's verification artifact.
- [x] 4.2 Verify the real Admin and Runtime Preview in a browser, including account transitions, repeated clicks, Account-open toast coexistence and narrow/scaled 9:16 layout; record visible results and distinguish fixtures from live outcomes.
- [x] 4.3 Verify one actual two-wallet Signet F2 payment: 1000 sats received, sender debit plus actual fees, correlated receipt evidence and exactly one correct toast; record only public evidence and mark any unavailable live verification pending.

Apply explicitly requested after interview. Keep unverified live acceptance pending.
