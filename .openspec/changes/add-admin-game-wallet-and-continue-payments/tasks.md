# F1 implementation tasks

Implementation started through the authorized apply request. X2 trophy issuance is excluded. See F1_VERIFICATION.md for evidence and remaining live checks.

## 1. Milestone 1 — Independent Admin game wallet

- [x] 1.1 Add isolated encrypted game-wallet import/storage and the Admin-only controller; verify invalid import, reload retention, retention of earlier identities, phrase-based reselection without duplicates, last-selected restoration and stale-read isolation and no secret-bearing public state.
- [x] 1.2 Isolate game-wallet lifecycle and notifications from player cleanup; verify player logout/reset, cross-tab import, unchanged player persistence and pending-operation guards with distinct identities.
- [ ] 1.3 Add F. Game Wallet with Import, payment-usable balance, Details and Logout; verify the single phrase field, no dropdown, fresh public console status, loading, failure/retry, keyboard access and portrait layout.

## 2. Milestone 2 — Configured Continue payments

- [x] 2.1 Add public recipient configuration to the context/controller contract and expose disabled/explained Pay state for missing, invalid or wrong-network configuration; verify self-payment rejection and unchanged free Restart.
- [x] 2.2 Bind new payment journals and results to the captured recipient, replace sink generation with configured sending, and preserve amount/asset verification; test changed-ID inputs, duplicate clicks and exact recipient outputs.
- [x] 2.3 Preserve legacy sink reconciliation and new pending recovery across changed builds; verify timeout/reload, no replacement payments, correct historical labels and at-most-once session-bound effects.
- [x] 2.4 Wire the selected public recipient into new demo requests and public build configuration; preserve captured destinations for pending operations.
- [ ] 2.5 Update the named Stealth consumer's pinned BIS package and build configuration through its existing workflow; verify actual defeat payment, revival and free Restart in a browser independent of Admin, retaining existing self-minted trophy behavior.

## 3. Integrated acceptance and documentation

- [ ] 3.1 Verify a real Signet payment from distinct player to game wallet: record public before/after balances and transaction evidence, refresh Admin to observe receipt, and repeat with Admin closed during payment. Do not claim completion from mocked outcomes.
- [ ] 3.2 Run applicable account/continuation regressions, typecheck and builds; inspect published build inputs/output for absence of signing credentials and verify both wallets remain isolated across reloads.
- [x] 3.3 Document browser import and public recipient deployment configuration; move former X1 to F1 under F. Game Wallet with coherent current links, preserving other appendix numbering and historical change paths. Keep current minting behavior/status accurate.
- [x] 3.4 Record acceptance evidence and unresolved live blockers, then validate this change strictly; leave any unverified task unchecked.

## 4. F3 and status follow-up

- [x] 4.1 Add F3 quote/confirmation and status-only Details with wallet-scoped recovery guards; see F3_VERIFICATION.md.
- [x] 4.2 Base the waiting disablement on fresh matching unconfirmed transaction data, clear stale/unavailable results, and retain Details access; focused tests and typecheck passed.
- [x] 4.3 Show payment-usable F1 balance including zero and report F1/F3 status through the replacing Admin console.
