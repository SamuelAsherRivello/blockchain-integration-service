# D2a acceptance evidence

## Baseline and ownership

Reviewed 2026-09-04: reuse Core address loading/navigation, AccountAddresses, AccountInvoice, and the earlier receiving change's verification record. D4 now adds a transfer selection branch and UI; preserve it. D2a owns address-journey completion only. Earlier combined-change live tasks remain incomplete.

| Requirement/scenario | Verification |
| --- | --- |
| Entry, copy, clipboard failure | Real demo/plain host and isolated browser checks |
| Refresh failure/retry, late results | Existing addresses.test.mjs plus isolated browser checks |
| Unavailable defaults, Back/re-entry | invoice-receiving.test.mjs plus both browser hosts |
| Keyboard and portrait layout | Both browser hosts |
| Active/logged-out demo selection | receive-selection.test.mjs and real demo |
| Independent delivery boundary | Documentation diff and final scenario review |

Baseline six address/invoice tests passed. New selection test initially failed because the D2a selection helper did not exist; the helper centralizes existing A1/D4 routing and adds D2a without automatic account creation/funding.

## Results (2026-09-04)

- `receive-selection.test.mjs`: passes active/logged-out D2a and existing A1/A4/D4 routes, using a minimal public-method double that cannot create accounts or request funds.
- `/tests/receive-host.html`: PASS in Chromium. Isolated fixtures verify exact copies for both fields, clipboard denial without false success, manual selection fallback, loading state, failed Refresh disabling both Copy controls/removing stale values, successful retry, Back/re-entry, empty disabled invoice/default selection, and portrait overflow. The fixture is not in the production catalog/build entries.
- Real demo at `http://127.0.0.1:5173/`: D2a opens Receive for the existing isolated-browser Signet account. Both actual values were copied and compared to clipboard contents; Refresh/re-entry completed, Tab focused Arkade Copy with a visible outline, and invoice controls remained disabled. Reviewed 100% 9:16 screenshot `output/playwright/d2a-demo.png`.
- Separate fresh browser session: D2a opened the logged-out chooser with Create/Restore/Back, not an automatically created account.
- Independent real host `/tests/ui-host.html`: public package mounting, Account → Receive, both actual address/clipboard comparisons, Refresh, Back/re-entry, disabled invoice controls, Tab focus, and no horizontal overflow passed. At 300×540 the card scrolls vertically; keyboard focus scrolls Back into view. Screenshot `output/playwright/d2a-plain.png` inspected.
- Existing Core tests cover failed reads, late closed/disposed requests, address clearing, and navigation. Isolated browser failures are not represented as live transactions.
- Integration tests: 60/60 passed. Demo tests: 3/3 passed. `npm run typecheck` and `npm run build` passed; existing large-chunk warnings remain non-blocking.
- No wallet funding, payment, transfer, logout, reset, or database deletion was performed. No secrets were printed or captured. No dependencies changed.
- Docs now link D2a independently and retain D2b, D3, D4 boundaries. Earlier combined receiving tasks remain 4/23, unchanged by D2a acceptance.

## Acceptance conclusion

The matrix above is satisfied by the recorded tests and both real-account browser hosts. D2a delivers receiving instructions, not proof of payment or settlement. Live invoice generation/fees/recovery, Activity extensions, and invoice-specific account-clearing protection remain outside this delivery.
