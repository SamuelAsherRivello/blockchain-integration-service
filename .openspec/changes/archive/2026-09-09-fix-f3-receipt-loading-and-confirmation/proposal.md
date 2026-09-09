## Why

F3 produces a pending receipt toast and updates the player's Arkade balance, but the open Balance page does not show loading and the user does not see a confirmation toast. Both stages must be visible without requiring manual refresh.

## What Changes

- Show one existing Pending Operation Dialog loading cycle on the open Balance page when a new F3 Arkade receipt is observed; reveal freshly read balances when preparation completes.
- Deliver exactly one clearly labeled ` (Confirmed)` receipt toast after verified spendable Arkade receipt, preserving the existing ` (Pending)` toast, amount and sender wording.
- Preserve silent historical baselines, duplicate suppression, account isolation and silent follow-up reconciliation for the same receipt.
- Verify the full pending-to-verified observation and UI path; never infer receipt from the balance increase.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `player-wallet-subscription`: Distinguish a new incoming Arkade receipt's foreground Balance loading cycle from silent repeated reconciliation.
- `game-wallet-player-payment`: Require an explicit confirmed label and reliable pending-to-settled delivery for incoming Arkade payments, including F3.

## Impact

Expected implementation areas are integration core context, payment notifications, Arkade activity normalization/observation if supported by regression evidence, and existing Balance/pending-dialog presentation. Extend wallet subscription, notification, adapter and browser coverage. No payment amount, rail, wallet mutation, dependency or public server changes. Existing withdrawal/recovery work in the dirty checkout remains separate.

This specifically supersedes the blanket silent automatic-balance-refresh rule for a newly observed incoming Arkade receipt while Balance is visible. It also supersedes suffix-free final toast wording for incoming Arkade receipts. Other automatic refresh and notification behavior remains intact.
