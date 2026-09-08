## 1. Destination form and routing

- [x] 1.1 Add the labeled Destination selector, Game wallet default, helper text and matching responsive styling in MintAssetDialog; verify keyboard selection, presets, idle dismissal and narrow-window layout in a browser.
- [x] 1.2 Route mint and pending-state reads in App through the selected player context or game wallet controller, keeping wallet roles outside the generic request; verify focused tests call only the selected wallet and retain exact metadata.
- [x] 1.3 Replace game-only C1 gating with independent wallet and recovery availability, and selected-wallet feedback; verify player-only, game-only, neither, insufficient funds and failed lookup cases without fallback submission.

## 2. Operation isolation and recovery

- [x] 2.1 Bind asynchronous work to destination, profile identity and form generation; verify delayed lookup/results after selection, logout or wallet replacement cannot submit to or update a replacement wallet.
- [x] 2.2 Preserve metadata and fresh IDs for idle destination changes, restore pending requests with original IDs, and lock submitted requests; verify duplicate-click suppression, unknown-outcome reconciliation and reopening access to both wallets even when either or both have pending work.
- [x] 2.3 Include destination and originating public wallet identity in Admin Console pending/results/errors; verify no recovery material is exposed and no runtime-preview navigation occurs.

## 3. Acceptance and documentation

- [x] 3.1 Run focused mint/admin tests and `npm run build`; record results and any existing unrelated failures in a verification artifact.
- [x] 3.2 Verify the complete window in a real browser, including changing destination, unavailable feedback and pending recovery; record observed outcomes separately from test doubles.
- [x] 3.3 For available funded Signet test wallets, verify one explicit mint to each destination and fresh holdings in the selected wallet; record actual asset IDs, exact quantities and public destination identity, or explicitly mark live acceptance blocked if prerequisites are absent.
- [x] 3.4 Update C1 user-story and demo documentation to describe both destinations and selected-wallet funding; verify wording matches the implemented UI and reconcile overlapping C1 planning requirements before archive.

## 4. Requested payment labels

- [x] 4.1 Append B1 direction and update F3 label and actual payment amount to 100 sats, preserving historical payment recovery; verify payment adapter tests, the availability boundary and rendered browser labels.

## 5. Production mint parity — latest confirmed revision, implemented

- [x] 5.1 Add a failing regression demonstrating Admin reaches the same player production mint method as collection even when the old Admin availability result is false or unavailable; record the expected failure before changing implementation.
- [x] 5.2 Remove the independent Admin balance veto from destination preparation and C1 entry, reuse the existing production mint entry point, and retain game-wallet routing and pending/account/form guards; verify the parity regression passes without changing production reward or issuance behavior.
- [x] 5.3 Verify both destinations, authoritative insufficient-funds errors without network submission, failed pending lookup, duplicate attempts, immutable recovery, stale balance data and wallet replacement through focused automated tests and actual browser interaction.
- [x] 5.4 Update documentation and verification to distinguish the revised production-authoritative path from prior precheck behavior; run typecheck, build and strict OpenSpec validation, and report live same-wallet parity evidence separately from isolated results or missing live prerequisites.
