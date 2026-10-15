## Why

At the current 100% browser scale, several BIS action labels are wider than their compact controls, while the Game Wallet and Developer flows do not share the same navigation and loading treatment. The production UI needs one consistent, readable button behavior and a predictable Account Details -> Developer workflow before the next browser verification pass.

## What Changes

- Add shared fit-to-width behavior for BIS buttons: preserve the normal label size when it fits and reduce only the label font size needed to keep the complete text inside its button.
- Apply the behavior consistently across reusable BIS button actions, including compact grid and narrow dialog layouts, without ellipsis or clipped labels.
- Change the Game Wallet start page to show `⚡ Create Wallet` and `⚡ Restore Wallet` on one row, with `Back` below; use the shortened restore label on the restore action as well.
- Move the `Developer` entry point from the top-level Account actions to Account Details, directly below `Get Recovery Phrase`.
- Make Developer-subflow navigation return to the Developer menu: Game Wallet Login Back and Developer-opened Onboarding Back SHALL return there, while direct demo/Admin Onboarding entry retains its Account Details destination.
- Show the existing BIS Pending Operation Dialog with `Logging out...` over the Game Wallet page while Game Wallet logout is in progress. The logout control remains disabled during the operation and duplicate submissions remain impossible.
- Add focused UI and browser-fixture coverage for button fitting, action order, navigation destinations, delayed logout loading, and preservation of existing direct Onboarding behavior.

## Capabilities

### New Capabilities

- `bis-ui-button-fit-and-navigation`: Defines shared BIS button label fitting, compact Game Wallet actions, Developer-menu placement, Developer-subflow Back destinations, and Game Wallet logout loading presentation.

### Modified Capabilities

- None. The new capability cross-cuts existing Account, Game Wallet, logout, pending-dialog, and onboarding surfaces without replacing their existing lifecycle contracts.

## Impact

- Affected production UI: `BIS/packages/integration/src/ui/client.tsx`, `GameWalletLogin.tsx`, `FitTextButton.tsx`, and shared overlay styles.
- Affected verification: integration-demo UI fixtures and tests for Account Details, Game Wallet restoration, Onboarding, logout, and Pending Operation Dialog behavior.
- No new dependency, wallet protocol, persistence format, public recovery material, or external service is introduced.
