# Tasks

## 1. Pending operation support

- [x] 1.1 Add identity/network-scoped public settlement tracking and shared mutation locks without clearing existing stores; verify reload retention, isolation, pre-submission failures and ambiguous outcomes with focused tests.
- [x] 1.2 Implement original-send finalization, conservative settlement receipt reconciliation and owned-output recovery with exact asset/value verification; verify no replacement send, no retry after uncertainty and preserved assets with focused tests.

## 2. Setup controls

- [x] 2.1 Add Clean Wallet 2 controls for both profiles with captured submitted identities and progress/success/error feedback; verify both profiles, invalid credentials, repeated clicks and feedback in a browser.
- [x] 2.2 Document manual cleanup and its pending-outcome limitations in the named package README while retaining its link and length conventions; verify the documentation matches the implemented controls.

## 3. Asset carrier minimum

- [x] 3.1 Change choices/default to 330/1000, migrate saved 0/1/100 selections, and update overview/tooltip; verify exact validation, network persistence and UI ordering with focused unit/browser checks.

## 4. Integrated acceptance

- [ ] 4.1 Verify real cleanup on Signet and Mutinynet, including an interrupted send continued under the original transaction ID and preserved assets/value during recovery; retain sanitized public receipts under output/reports/prototype-wallet-cleanup/.
- [x] 4.2 Verify real 330-sat asset sends on both networks with exact recipient sats and asset quantities; retain public receipt evidence separately from deterministic checks.
- [x] 4.3 Run the sandbox build, relevant regression tests and OpenSpec strict validation; audit every requirement against evidence and record remaining limitations truthfully.
