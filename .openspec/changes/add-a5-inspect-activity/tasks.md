## 1. SDK capability gate

- [x] 1.1 Verify the existing wallet's SDK history, boarding coin snapshot, and subscriptions on Signet; record incoming/outgoing history coverage, spent-record retention, available timestamps/identifiers, any SDK pagination, and evidence for existing unconfirmed deposits and updates without secrets. If required data is unavailable, stop and report the limitation without adding a direct explorer client.
- [x] 1.2 Confirm snapshot/subscription health detection and status mapping, including history.settled versus Bitcoin confirmation and offchain settlement; verify with focused adapter tests for pending, confirmed, unknown, outgoing, spent, duplicate outputs, and disappearing pending records.

## 2. Integration behavior

- [x] 2.1 Add the SDK-only full-history adapter and snapshot/notification reconciliation; verify incoming/outgoing and spent records remain included, all SDK-exposed pages are read when applicable, initial arrivals are not lost, amounts are not duplicated, and failure is distinct from empty. Test newest-first ordering, timestamp ties, undated pending/other entries, and missing output indexes.
- [x] 2.2 Add public normalized activity state and account-scoped view/load/retry lifecycle; verify late results, Back, close, logout, replacement/reset, and disposal cannot leak entries or leave watchers active.
- [x] 2.3 Preserve Transactions below Balance, Account ID, three-line rows and single-click Transaction Detail with its own Copy. Provide Copy all transactions exporting every ordered record on one logical line with sats, direction, supported status, full identifiers and available asset data. Verify exact full-list copying, clipboard success/failure with selectable fallback, disabled Copy without current records or while loading, selection, empty/loading/unavailable states, Back, and scrolling in the 9:16 browser preview.

## 3. Demo and delivery evidence

- [x] 3.1 Add Account / Inspect Activity using production public APIs and the existing logged-out chooser; verify no automatic account creation or fabricated transactions, and independent-host parity.
- [ ] 3.2 Verify the real Signet flow in browser, including an already-pending deposit, a later SDK notification, confirmation transition, SDK-supplied outgoing/spent history where available, newest-first display, and Copy-all. Inspect that application activity traffic stays behind the SDK and record any unobserved live step as pending; do not initiate payments merely to manufacture verification history.
- [ ] 3.3 Synchronize current user-story/package documentation and OpenSpec context with delivered A5 behavior while retaining story IDs and unrelated verification notes; reconcile concurrent address/achievement menu and spec changes without reverting them. Verify documentation against actual runtime and add an A5 verification record.
- [x] 3.4 Run relevant package checks and targeted regression tests for existing Account Details/navigation and the new activity lifecycle; record outcomes before reporting implementation complete. Sync delta specs only when finalizing the implemented change.


Implementation note: real history/coin reads, source coverage, and an isolated live SDK utxo notification are verified. 3.2 remains open for a real confirmation transition and outgoing/spent examples. See .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md. No funding or sending is authorized by verification tasks.

Recheck (2026-09-05): live confirmed-state rendering and outgoing rows are observed, but the same-transaction live transition and independent spent-history evidence remain pending. User Story Diagrams.md is now populated. Task 3.3 remains open because its A5 diagram is stale and the original Copy-all/text-area contract conflicts with the delivered row/detail-copy UI. See the latest A5_VERIFICATION.md entry before reconciling or finalizing.
