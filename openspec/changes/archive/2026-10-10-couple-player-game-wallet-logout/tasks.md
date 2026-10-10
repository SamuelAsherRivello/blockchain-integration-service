# Tasks

## 1. Couple BIS wallet lifecycles

- [x] 1.1 Connect Player account logout to complete Game Wallet purge before Player logout can report success; verify with integration logout and Game Wallet storage tests.
- [x] 1.2 Ensure either wallet logout invalidates reads, subscriptions, operation scopes, pending records, and published state without allowing stale state to return; verify with focused lifecycle and race-condition tests.

## 2. Enforce Marketplace active-wallet truth

- [x] 2.1 Remove the Marketplace catalog-address fallback from active Game Wallet display and inventory sources; require both current Player and explicitly active Game Wallet identities; verify with Marketplace source and UI tests.
- [x] 2.2 Purge Game Wallet inventory cache, visible items, and pending checkout records on either wallet logout while preserving independent Player Wallet inventory; verify with cache regression tests.
- [x] 2.3 Add the logout → refresh → Player-only login regression flow and verify the wallet strip reports Game Wallet as not connected and does not enable Game Wallet actions.

## 3. Verify integrated behavior

- [x] 3.1 Run focused integration and Marketplace tests plus the repository test command, recording unrelated baseline failures under `output/reports/couple-player-game-wallet-logout/` when needed.
- [x] 3.2 Run the shared Vite preview and use Playwright to exercise Marketplace Account logout, reload, and Player-only login; save browser evidence under `output/playwright/couple-player-game-wallet-logout/`.
- [x] 3.3 Verify no Game Wallet identity remains restorable after logout and that a fresh Game Wallet import is required; verify with focused tests and the browser flow where available.
