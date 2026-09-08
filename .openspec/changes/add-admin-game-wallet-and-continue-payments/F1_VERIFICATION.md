# F1 implementation evidence — 2026-09-08

## Delivered locally

- Separate encrypted game-wallet database, retained identities and last selection; one phrase field, reselection, manual Refresh, public addresses and Copy controls under F. Game Wallet.
- Configured Continue recipient, no new sink fallback, recipient-bound journals and historical sink recovery. Player self-minting is unchanged.
- Demo and Stealth host configuration plumbing; updated content-hashed local BIS package and verified inventory.
- User-story documentation moves X1 to F1 without renumbering other appendix entries.

## Checks

- BIS typecheck and production build passed.
- Focused core tests: 29 passed across game-wallet, continuation, continuation-adapter and game-continue tests. Covers imports, retention, reselection, invalid/self import, provider failures, missing/mainnet recipient, recipient change, duplicate requests, recovery, exact outputs, asset preservation and session-bound callbacks.
- Isolated broader core suite: 275/276 passed before the two added recipient tests. The sole failure is the existing transfer-recovery-report test expecting the text `Do not resubmit`; F1 does not change that report implementation.
- Admin assets test has an existing stale expectation for `Coninue` while current UI renders `Continue`. Other action-routing test passes. Full npm test run was stopped after documentation tests because it remained running; no full-suite pass is claimed.
- Browser at http://127.0.0.1:5184/ visibly shows F. Game Wallet, disabled unconfigured Pay, and one recovery input after Import Wallet. No new funding button or selector.
- Browser fixture at http://localhost:5184/tests/game-wallet-storage.html passed encryption-envelope/non-extractable-key checks, separate storage retention, reselection, broadcast, reload and cleanup namespace isolation using synthetic identities only. This fixture is for an isolated test origin, not a real wallet session.
- Stealth production build passed; four bis-account host tests passed; verify-bis-package reports the archive and 75 installed package files match.

## Still required

- Full portrait/keyboard interaction acceptance for task 1.3. Desktop UI was inspected; no portrait pass is claimed.
- Select/configure the actual public game-wallet Arkade receiving address. No real mnemonic was read or embedded, no GitHub signing secret was created, and no deployment occurred.
- With a funded distinct player, verify real Continue receipt, before/after balances and transaction evidence, including Admin closed during payment and a later manual Refresh. No real transfer or gameplay revival is claimed by fixture tests.
- Finish independent Stealth gameplay/browser acceptance and broader regression acceptance. Tasks 1.3, 2.5, 3.1 and 3.2 remain unchecked.

The preview uses local port 5184 for this verification session. It is not the remote demo/tunnel mapping.

UI revision: F1. Game Wallet now has Import initially, Details/Logout after selection. Browser verified public-only console output and persistent deselection after Logout/reload using synthetic storage. Four controller tests pass including retention after logout.

Balance revision: available sats are shown left of Details. SDK script SSE events trigger balance reads; no scheduled balance polling. Six controller tests pass including event-driven change, idle no-read behavior, logout abort and stale-balance removal on stream failure. Production build passes. Live funded receipt remains pending.
