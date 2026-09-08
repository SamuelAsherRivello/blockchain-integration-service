# Admin-first acceptance - 2026-09-08

Tested baseline HEAD: e68f356b553d49c90d7888ebb9cd6a262d9a6ad3 plus the current uncommitted working tree. HEAD alone does not contain this fix. Other ongoing changes exist in this shared checkout; no commit or deployment was created.

## Current results

- 270 integration tests pass with zero failures using isolated Node test workers: node --experimental-strip-types --test BIS/packages/integration/tests/*.test.mjs. See integration-tests.tap.
- The registration regression initially failed because submit waited for settlement. It now verifies that registration returns pending before a deferred settlement finishes, the signing wallet remains alive, its late commitment persists, and reserved inputs cannot be reused.
- Partial input selection, asset-preserving Max, changed asset proofs, exact receipts, multiple independent records, exact-ID late callbacks, pending acknowledgement in either direction, changed pending sets, and repeated Transactions updates are covered.
- npm run build passes including typecheck, integration and Admin demo builds. See build.log. Vite retains its large-chunk advisory.
- Browser http://127.0.0.1:5175/tests/transfer-host.html reports PASS. It exercises forward/reverse pending warnings, Cancel, Yes and fresh review, another pending ID appearing at final confirmation, the submitted/Transactions result, quote expiry, layout and asset-preserving Max. This harness uses isolated test doubles and does not submit live transactions.
- Live Admin http://127.0.0.1:5175/ showed the remembered 280715-sat Arkade balance and zero Bitcoin balance. Its existing 1000-sat pending transfer did not disable either direction. Starting another review showed exactly: You already have a transfer of 1,000 sats pending. Are you sure you want to send another? Buttons were Yes and Cancel. Cancel was clicked; no additional live transfer was submitted.
- The previously reported operation b1a46915-923b-4266-9d6e-8c8266617382 / intent 0bd1a533-46b2-430a-ad75-ac01545aa7d9 has no verified completion in this acceptance. Its record and input reservations were preserved.
- Strict OpenSpec validation passes for this change and add-bitcoin-boarding-settlement. Their overlapping durable/status requirements have been reconciled with the user-confirmed repeat-transfer behavior.
- Earlier repository-wide npm test attempts stalled after documentation assertions. The final verification above is the complete integration suite, not a claim that the repository-wide documentation suite passed.

## Behavior and limits

Operator acknowledgement shows Transfer submitted and Check Transactions for updates. Signing continues in the same open tab; the UI explicitly asks the user to keep it open during processing. Lost acknowledgement uses uncertain pending wording. Neither result is treated as verified success.

Every new balance-transfer review in either direction prompts if any balance transfer is pending. X is the total pending sats. Yes permits a fresh quote against unreserved inputs; final confirmation rechecks pending IDs. Partial transfers reserve only their selected inputs. Insufficient independent funds remain a legitimate quote error, not a blanket pending-operation prohibition.

Background read-only reconciliation updates all records and Transactions. Verified on-chain receipt and exact asset change are still required for success. No guaranteed one-hour completion time is asserted.

Published-game delivery, a verified live completion, and archive remain separate outstanding gates in section 3 of tasks.md. Admin behavior and local implementation are verified.
