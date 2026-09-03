## Why

Players can create and remember an account, but cannot log out through the production Account dialogue. A6 adds deliberate logout with a permanent backup acknowledgement and truthful failure handling.

## What Changes

- Enable Log Out for an active account and open a confirmation with an initially unchecked "I have backed up my wallet" checkbox. The final Log Out action is enabled only while checked; Back cancels without changing the account.
- Warn that the browser's saved account will be cleared and restoring access requires the saved recovery phrase. Do not display or offer access to that phrase in A6.
- Clear remembered account material and end the local session on confirmation. Keep the dialogue open with Retry on failure; report success only after clearing is confirmed.
- Preserve the existing A6 destination: the open Account dialogue shows Create Account / Restore Account, and Back restores the preceding host presentation. Restore remains disabled until A3.
- Add an A6 Admin demonstration using the production API, plus logout state/event observation for hosts and verification of reload and multiple-instance behavior.
- Defer pending-payment handling until payment features exist. Restoration, backup/recovery access, the full A4 menu, and game-specific connected-run policy are outside this change.

## Capabilities

### New Capabilities
- `account-logout`: Backup-gated logout, durable completion, retry, and host notification.

### Modified Capabilities
- `account-entry`: Replace the disabled active-account logout action with the A6 confirmation flow.
- `story-driven-demo`: Add the A6 demonstration and synchronized completion documentation.

## Impact

Changes affect integration core state/lifecycle and storage orchestration, production UI, public types, and the consuming demo. No new dependencies, operator requests, wallet transfers, or server changes are proposed. Existing storage generation protection and SDK disposal are reused where appropriate.

The exact additive method/event names and busy-state presentation are proposed implementation decisions in design.md, not separately confirmed interview answers. Game-specific mid-run eligibility and future payment reconciliation remain deferred. Real browser identity deletion checks must be run manually under the repository's database safety rules; automated verification uses isolated storage doubles.
