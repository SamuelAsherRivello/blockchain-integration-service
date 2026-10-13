# Tasks

## 1. Evidence-backed delivery notification lifecycle

- [x] 1.1 Expose the delivery-submission evidence needed by Marketplace without weakening the existing asset-delivery recovery contract, and verify focused asset-delivery tests distinguish prepared, submitted-pending, and reconciled delivery states.
- [x] 1.2 Add a checkout-scoped, Player Wallet session/network/direction-scoped durable delivery-toast marker for pending and confirmed milestones, and verify reloads, polling recovery, session changes, and stale callbacks cannot duplicate or recreate notifications.
- [x] 1.3 Publish one Player Wallet item-transfer pending notification only after exact durable transaction evidence and one direction-aware confirmed notification only after exact reconciliation/checkout confirmation; verify purchase and sell-back flows, and define the required evidence contract for any future trade flow, with Marketplace checkout tests.

## 2. Toast content and artwork

- [x] 2.1 Use the Player Wallet context's shared toast entry point to emit the specified pending and direction-aware confirmed text, and verify the Marketplace-focused UI/unit tests assert message text and semantic types.
- [x] 2.2 Pass only the selected item's validated chain-provided icon URL to delivery notifications, preserve the shared text-only fallback, and verify invalid, missing, or unavailable artwork does not block the toast or cause a name-based icon lookup.

## 3. Regression verification

- [x] 3.1 Extend focused payment-notification coverage to prove incoming-sats receipts, including carrier-value receipts, retain their existing notification behavior alongside the new delivery notifications.
- [x] 3.2 Run the relevant integration and Marketplace test suites, TypeScript checks, and production build; verify checkout recovery, generic receipt notifications, and toast queue ordering remain intact.
