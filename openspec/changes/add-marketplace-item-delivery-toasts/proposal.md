# Proposal

## Why

Marketplace checkout exposes a durable item-delivery lifecycle, but users currently receive no concise notification when an item transfer has been submitted or later verified. The generic incoming-sats receipt remains useful and must stay visible even when an asset carrier output accompanies the delivery.

## What Changes

- Add Marketplace-owned item-transfer pending and confirmed toast notifications for every Marketplace asset-delivery leg involving the Player Wallet: current buys and sell-backs, plus any future supported trade flow.
- Attach the verified Marketplace item icon to each delivery toast when its validated chain-provided HTTPS URL is available; retain text-only fallback when it is not.
- Trigger the pending notification only after durable delivery submission evidence exists, and trigger confirmation only after the existing delivery reconciliation verifies the exact transfer.
- Preserve all generic incoming-payment toasts and their existing timing, wording, and deduplication, including carrier-value receipts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-trading`: define user-visible pending and confirmed delivery status notifications without altering checkout recovery or payment receipt behavior.
- `toast-messaging`: define Marketplace delivery-toast wording, semantic types, optional verified item artwork, and non-interference with generic receipt notifications.

## Impact

- Affected code: Marketplace checkout presentation and its focused tests; existing integration toast API usage and focused toast tests.
- Affected systems: the durable checkout and asset-delivery journals remain the authority for delivery state; no new wallet mutation, receipt filtering, or payment-notification correlation is introduced.
- No new dependencies, public signing authority, network service, or cross-origin state are required.
