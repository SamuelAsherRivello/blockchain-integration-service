## 1. Role-separation core

- [x] 1.1 Add a private origin-scoped, profile-ID-only role-selection coordinator that serializes cross-role compare-and-commit work and fails closed when safe coordination is unavailable; verify isolated tests cover distinct IDs, equal IDs, and competing asynchronous requests.
- [x] 1.2 Extend the Player context's private composition options with a late-bound selected Game Wallet profile-ID provider, and wire it from `BisGameServices` and the integration demo without exposing Arkade types or secrets; verify TypeScript checking and composition tests pass.

## 2. Player Wallet protection

- [x] 2.1 Guard Player create/Continue and restoration durable-save/activation paths with the coordinator, retaining private transient input/candidates and emitting no accountConnected event on conflict; verify focused creation and restoration tests prove no Player storage write or activation for a Game Wallet match.
- [x] 2.2 Guard saved-profile selection plus hydration/reconciliation against a selected Game Wallet match, invalidating stale callbacks without overwriting either role; verify focused context tests cover a role change during an awaited Player activation and a legacy persisted conflict.

## 3. Game Wallet protection and feedback

- [x] 3.1 Apply the coordinator to Game Wallet create, import/restore, explicit selection, and refresh completion boundaries, preserving the existing Player and prior Game Wallet selection on a conflict; verify `game-wallet` tests cover Player-first and Game-Wallet-first ordering, distinct identities, and stale selection work.
- [x] 3.2 Present a concise non-secret role-conflict error in the Player and Game Wallet private flows while preserving the established loading, retry, and recovery-material privacy behavior; verify the relevant UI tests assert the visible error and unchanged controls/state.

## 4. End-to-end verification

- [x] 4.1 Add or extend browser-host coverage that logs into one role, attempts the same identity in the other, and verifies immediate rejection, no role replacement, and no secret exposure in Player-first and Game-Wallet-first cases.
- [x] 4.2 Run the affected integration test files, the demo/browser-host checks, `npm.cmd run build`, and `git diff --check`; record any unrelated failures separately from this change.
