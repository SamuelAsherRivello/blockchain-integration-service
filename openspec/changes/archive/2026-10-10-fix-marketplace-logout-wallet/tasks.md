# Tasks

## 1. Enforce the logged-in game-session wallet boundary

- [x] 1.1 Update the Marketplace wallet derivation so the published catalog Game Wallet address is never used as an active inventory source or displayed wallet when no Player Wallet is active; verify with the Marketplace source/UI tests.
- [x] 1.2 Ensure Player logout invalidates the game-facing Game Wallet inventory result, suppresses stale items and game-wallet actions, and leaves Admin Game Wallet persistence untouched; verify with focused integration/Marketplace regression tests.
- [x] 1.3 Update user-facing Marketplace empty and requirement states so a logged-out Game Wallet tab truthfully requires an active Player Wallet without implying that the registered catalog wallet is logged in; verify the rendered component assertions.

## 2. Verify the complete browser flow

- [x] 2.1 Run the relevant package tests and the repository test command, recording failures under the repository output convention when diagnostics are needed. Change-specific tests pass; the full suite retains unrelated baseline/environment failures documented in the implementation report.
- [x] 2.2 Start the shared Vite preview, use Playwright to verify Marketplace opened logged out shows no active Game Wallet address or Game Wallet inventory, then exercise Player logout from the Account flow and verify the same invariant after logout; save any screenshot or trace under `output/playwright/fix-marketplace-logout-wallet/`.
- [x] 2.3 Verify the Admin-facing retained Game Wallet behavior remains available after the game-facing logout transition, and report the exact routes and commands used for verification. Existing integration retention tests pass; browser evidence confirms only the game-facing presentation is cleared.
