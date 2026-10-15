# Proposal

## Why

Marketplace currently derives Player Wallet and Game Wallet state only from its local BIS controllers. A logout performed by the separately hosted business application can therefore leave Marketplace displaying stale wallet identities and controls.

## What Changes

- Add a public, non-secret wallet lifecycle notification contract for Player and Game Wallet login and logout transitions between an owning business application and Marketplace.
- Require Marketplace to validate the notification source and let its own policy decide the resulting presentation, inventory invalidation, checkout cancellation, and action availability.
- Make externally reported logout immediately remove the affected wallet from Marketplace's active presentation and prevent old wallet data or asynchronous work from returning.
- Make externally reported login refresh the corresponding Marketplace wallet projection without treating a notification as signing authority or exposing recovery material.
- Add integration coverage for Player Wallet login/logout and Game Wallet login/logout received from a separate application context.

## Capabilities

### New Capabilities

- `wallet-session-notifications`: Publishes and consumes validated public Player and Game Wallet lifecycle notifications across application boundaries.

### Modified Capabilities

- `marketplace-catalog`: Marketplace wallet labels, inventory, and local trade availability react safely to validated external wallet lifecycle notifications.

## Impact

- Affected code: `@bis/integration` public integration/state boundary and `@bis/marketplace` wallet session, inventory, and checkout presentation.
- Affected integration: the business application must use the exported lifecycle bridge when either wallet is activated or deactivated.
- Security: notifications contain only public role, active/inactive state, public profile/address/network evidence, and a monotonic session revision; no recovery phrase, private key, or signing capability is transported.
