## 1. Shared BIS button fitting

- [x] 1.1 Generalize the existing fit-text button behavior so every production `.bis-button` keeps its complete single-line label inside constrained bounds, resets when space returns, and preserves padding, hit area, variants, disabled state, and focus behavior; verify with a focused constrained-width UI fixture.
- [x] 1.2 Reconcile local button sizing overrides in shared overlay CSS so compact grids, transfer controls, onboarding actions, recovery actions, and dialog buttons use the shared fitting behavior without clipping or ellipsis; verify `git diff --check` and the constrained-width fixture at 100% scale.

## 2. Game Wallet presentation and loading

- [x] 2.1 Change the unconfigured Game Wallet Login actions to the shared two-column layout with exact labels `⚡ Create Wallet` and `⚡ Restore Wallet`, keep Back below, and rename the restore-submit action to `⚡ Restore Wallet`; verify the Game Wallet restore fixture and action order.
- [x] 2.2 Register Game Wallet logout with the existing pending-operation provider using `Logging out...`, retaining local busy guards and disabled controls; verify a held logout shows the overlay, blocks duplicate actions, and resolves to the unconfigured page.
- [x] 2.3 Add or update failure coverage for Game Wallet logout so the pending window does not claim success and the existing error path remains intact; verify the focused logout fixture.

## 3. Developer menu and navigation

- [x] 3.1 Move the Developer action from the top-level active Account actions to directly below Get Recovery Phrase in Account Details, preserving its existing Developer panel contents and disabled/busy behavior; verify Account Details action-order fixtures.
- [x] 3.2 Preserve Developer as the return destination for Game Wallet Login Back and add Developer-origin tracking for Player Wallet Onboarding Back, while retaining Account Details for direct host/Admin Onboarding entry; verify all three navigation paths in focused UI tests.
- [x] 3.3 Ensure opening Account, leaving Account, reopening Account, and entering Onboarding directly clear or preserve the local return marker correctly; verify no stale Developer return occurs after an unrelated direct entry.

## 4. Regression and browser verification

- [x] 4.1 Update affected integration-demo and integration assertions for the new labels, action order, button wrapper/fitting behavior, Developer placement, and Back destinations; verify the focused test suite passes without weakening existing wallet or recovery assertions.
- [x] 4.2 Run the BIS package test and build commands, then verify the generated integration styles/types remain consumable by the demo; record command results in the task handoff.
- [x] 4.3 Run a real browser check at 100% scale covering Account Details -> Developer -> Game Wallet Login, compact Create/Restore actions, delayed logout loading, Developer -> Onboarding -> Back, and direct Onboarding -> Back; retain screenshots or reports only under the repository output convention.
