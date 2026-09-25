# A4 account balance verification

## Fresh SDK read prerequisite (2026-09-03)

Installed SDK 0.4.67 was traced in `dist/chunk-AEWJU6NZ.js`: `getBalance()` reads boarding UTXOs through the onchain provider and a contract snapshot through the indexer. Boarding read failures reject. `getContractsWithVtxos()` can catch retryable indexer errors and return repository data while marking synchronization degraded. `getProviderConnectionState()` exposes that distinction; an adapter must reject degraded/cache results. The adapter also latches indexer query failures so concurrent SDK watcher activity cannot clear the failure evidence.

Available and total are mapped directly from SDK values. No application calculation replaces those semantics. A fresh temporary wallet with explicitly in-memory repositories performed a real Signet read returning available=0, total=0 and online status. Its random identity existed only in memory and was never displayed, saved, or funded. Wallet disposal ended the SDK watcher. No send, settle, funding, or asset operation was performed.

The SDK initializes a transient contract watcher internally during the read. It is confined to the bounded temporary-wallet lifetime, with polling/reconnect delays longer than the read deadline; BIS does not subscribe for ongoing UI updates or retain the wallet after retrieval.

## Adapter, core and build

- `node --test packages/integration/tests/*.test.mjs`: 38 tests pass, including six A4 tests and the existing 32 account regression checks. Coverage includes zero/nonzero mapping, malformed/partial balances, degraded synchronization, source errors, timeout and late disposal, duplicate requests, clearing old amounts, manual retry, Back, logout cancellation, replacement/reset/disposal races, and identity read errors.
- `npm run build` passes typechecking and both production bundles. The existing large SDK bundle advisory remains.
- Isolated nonzero fixtures exist only in tests. Core checks verify that balance requests make no identity-storage writes; production uses no persistent SDK balance repository.

## Browser checks

Verified with Playwright Chromium against the existing server at http://127.0.0.1:5173/, using separate browser sessions and no existing user account. No recovery material was printed, captured, or committed.

- `/tests/balance-host.html` runs isolated production-component checks in a 300 by 540 host. It passed loading/disabled Refresh, available/total hierarchy, nonzero and zero rendering, clearing amounts during requests and failure, retry, reopen, Back, logout cancellation, late-result isolation, and no persistence writes.
- A real disposable Signet identity was created/restored using the existing A3 browser fixture without displaying its recovery material. The actual A4 demo and `/tests/ui-host.html` both fetched 0 available / 0 total sats for that account, consistent with the unfunded SDK read. Reload retained identity but not balance state or demo selection.
- Browser-offline refresh hid prior amounts and preserved Back. Restoring connectivity and selecting Refresh recovered live values.
- Blocking indexer requests while allowing the operator info request caused Balance unavailable, demonstrating that SDK repository fallback is rejected. Unblocking and refreshing recovered.
- Blocking onchain UTXO requests also caused Balance unavailable. A successful operator connection did not mask this failure.
- After reload with the operator blocked, A4 showed unavailable without old amounts. Unblocking and refreshing recovered.
- A separate fresh browser session selected Account Balance and received the ordinary Create Account / Restore Account chooser with no seeded identity or balance.
- The 9:16 demo was inspected visually. The plain host fits at 390 by 844 viewport without horizontal overflow; keyboard Tab reaches Refresh. Back returns to the prior presentation. No physical mobile-device claim is made.
- Screenshots: ignored `output/playwright/a4-plain.png` (explicit isolated fixture) and `output/playwright/a4-demo.png` (real zero balance). The existing favicon 404 and deliberately blocked-request errors were observed; no unexpected UI failure appeared.

## Remaining verification

Funded Signet verification is pending: no funded account was available in the isolated test session. The nonzero fixture is not evidence of a funded wallet read. No funding, payment, settlement, asset issuance, real logout, or reset operation was performed. Earlier A2/A6 manual storage-clearing checks remain separate and pending. A4 is implemented with these verification limits; it is not ready to claim all live acceptance checks complete.

## Account / Account Details follow-up

Account is now a parent menu with Account Details, Log Out and Back. Both dialogs show identical three-line logged-in/Account ID/Signet information. Only Account Details fetches and displays balances, with Refresh and Back; Back returns to Account and clears amounts. Logout cancellation returns to Account without requesting balances. The updated isolated browser fixture passes; live browser checks passed identical headers, correct buttons, real zero balance, Details Back to Account, and Account Back to the host. Build and 39 core tests pass. Funded Signet verification remains pending.
