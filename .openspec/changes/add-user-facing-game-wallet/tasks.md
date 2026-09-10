## 1. Shared local game-wallet foundation

- [x] 1.1 Extend the local game-wallet controller with the non-secret create/select lifecycle and selection-change signal needed by F1/F2 consumers, preserving encrypted same-origin persistence; verify focused controller tests cover reload, cross-context selection, invalid setup, logout, and no player-wallet mutation.
- [x] 1.2 Add a public UI-composition option that supplies the one local game-wallet controller to Account UI without adding game-wallet identity data to player context events; verify TypeScript public API checks and tests show no recovery material in public state or callbacks.
- [x] 1.3 Ensure local LTO storage/reconciliation is scoped to the selected game-wallet identity and rejects stale signer actions after selection changes; verify focused LTO tests cover same-origin exclusivity, reload reconciliation, and clean G2 epoch boundaries.

## 2. F2 user-facing game-wallet UI

- [x] 2.1 Add `Game Wallet Login` directly below `Get Recovery Phrase` in Account Details > Balance for every mounted BIS host, including when no player wallet is active; verify rendered UI tests and a Runtime Preview walkthrough.
- [x] 2.2 Implement the F2 Create Game Wallet / Restore Game Wallet flows using the existing private creation and restoration primitives, explicit recovery disclosure/Continue commitment, and game-wallet-only mutations; verify valid create/restore, invalid input, abandonment, and player-wallet isolation tests.
- [x] 2.3 Implement the selected F2 state with `Log Out Game Wallet`, then immediately show Create / Restore choices without an app refresh; verify UI tests and browser interaction preserve the player wallet and do not reveal balances, addresses, or F3 controls.
- [x] 2.4 Subscribe F2 and game consumers to game-wallet selection changes, deferring effect to the next fresh G2 run and clearing old player-facing G2 presentation state; verify a replacement during an active run cannot submit or display old offers under the new selection.

## 3. F1/F3 Admin migration

- [x] 3.1 Recompose the integration-demo Admin, Runtime Preview, and G2 panel around one `createBisGameWallet` instance without `serviceUrl`; verify the local factory is used and no G2 path requests `/__bis/wallet` or a wallet-service URL.
- [x] 3.2 Rename and arrange Admin controls as F1. Game Wallet (Admin-facing) and F3. Board Game Wallet, with F1/F2 sharing selection and F3 remaining Admin-only; verify Admin component tests and same-origin Admin-to-Preview synchronization.
- [x] 3.3 Preserve F3 details, balance, quote, confirmation, and live boarding behavior for the wallet selected by F1 or F2; verify existing boarding coverage plus a focused test for an F2-selected wallet.

## 4. Serverless G2 contract lifecycle

- [x] 4.1 Remove hosted LTO selection from the G2 composition path and use the local direct Arkade contract adapter for funding, claim, refund, persistence, and reconciliation; verify focused LTO tests exercise those operations with no BIS application server.
- [ ] 4.2 Ensure funding, claim, and refund each emit exactly one pending and one confirmed toast through the mounted BIS context, deduplicated by operation and phase; verify local LTO toast tests and Runtime Preview visibility.
- [x] 4.3 Keep Start and ordinary gameplay nonblocking when player readiness, selected game wallet, or direct Arkade readiness is absent; verify Start creates a silent no-offer session, chest inspection stays safe, and no delayed setup changes the active run.
- [x] 4.4 Update treasure-session integration to capture a game-wallet selection epoch at Start, retain signer stability for an active run, and start the next run with no old wallet G2 history; verify session tests for selection, replacement, logout, and unresolved prior work.

## 5. Consumer delivery and verification

- [x] 5.1 Build the BIS package and update Stealth & Steel to consume it, composing a local F2-capable game wallet into its mounted BIS UI and treasure session without a service URL; verify its package resolution and unit tests use the built version.
- [x] 5.2 Run `npm test` and `npm run build` in the BIS repository, resolving failures without weakening the F1/F2/F3 or direct-Arkade contracts; verify both commands succeed.
- [ ] 5.3 Browser-verify the BIS Runtime Preview with no wallet service running: F2 create/restore/logout, F1/F2 same-origin synchronization, F3 Admin-only visibility, normal play with no game wallet, and visible G2 pending/confirmed toasts for a supported funded flow.
- [ ] 5.4 Browser-verify Stealth & Steel with no BIS wallet service running: F2 is the only game-wallet setup route, Start remains playable without it, and an eligible fresh G2 run shows the chest lifecycle and pending/confirmed toasts without interrupting gameplay.
- [x] 5.5 After all callers use the local controller, remove `BIS/packages/wallet-service`, the root `wallet:service` script, hosted wallet/LTO adapters, service-only tests, and obsolete documentation/configuration. Verify no active source, package script, or consumer imports the removed service.
