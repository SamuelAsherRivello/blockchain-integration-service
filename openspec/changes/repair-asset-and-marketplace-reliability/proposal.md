# Proposal

## Why

Asset operations currently fail with overly broad `unavailable` results, while the Admin marketplace mint flow can pause on the first item without exposing the wallet, reservation, provider, or input condition that caused the failure. Marketplace inventory and metadata consumers also have overlapping ownership and compatibility rules, making listing, classification, cache invalidation, and live checkout failures difficult to distinguish and recover safely.

The recent structured metadata and inventory-loading work needs one reliability pass that makes asset behavior truthful and consistent from mint preflight through fresh listing, Admin catalog issuance, Marketplace presentation, and local checkout recovery.

## What Changes

- Add a single, explicit asset-operation readiness and diagnostic contract covering wallet identity, network, provider freshness, spendable inputs, reservations, durable pending records, browser coordination, and storage availability.
- Make generic minting preserve specific pre-submission failure categories instead of collapsing them into `unavailable`; retain `outcome-unknown` whenever submission may have occurred.
- Make one-item marketplace mint attempts independently recoverable, observable, and idempotent, with exact operation IDs, per-item progress, durable reconciliation, and no batch-wide poisoning.
- Make fresh asset listing and Marketplace classification tolerate generic assets while rejecting malformed or incomplete marketplace metadata without treating it as an empty wallet.
- Define one authoritative inventory ownership path across Account Assets, Game Wallet listing, Admin Marketplace controls, and Marketplace UI; remove duplicate cache/read semantics and invalidate on all relevant wallet, network, operation, and chain-evidence changes.
- Preserve structured `bisAttributeDeltas` as the only gameplay authority and make legacy metadata handling explicit rather than silently inferring gameplay where the contract disallows it.
- Ensure Marketplace item cards, detail views, checkout actions, pending operations, and recovery UI distinguish loading, empty, unavailable, invalid metadata, insufficient spendable funds, reserved inputs, unsupported mint selection, and unknown submitted work.
- Add focused unit, integration, browser, and live-read verification for the complete asset lifecycle, including a nine-item catalog minted one item at a time.

**BREAKING**: Asset and Marketplace APIs may expose more specific error codes and may stop classifying legacy items that lack required authoritative metadata; callers must handle explicit unavailable, invalid-metadata, reserved-input, and outcome-unknown states.

## Capabilities

### New Capabilities

- `asset-operation-diagnostics`: Defines truthful readiness, failure categorization, and recoverable progress for asset mutations and reads.

### Modified Capabilities

- `asset-api`: Preserve exact mint/list semantics, specific failure reasons, metadata validation, and durable per-operation recovery.
- `wallet-operation-availability`: Include asset mint input selection, reservation, provider, and coordination readiness in operation availability.
- `marketplace-catalog`: Require authoritative metadata and verified one-item-at-a-time catalog publication.
- `marketplace-inventory-cache`: Make BIS the single owner of role/network-scoped fresh inventory, cache reuse, and invalidation.
- `marketplace-trading`: Keep checkout and item actions truthful when inventory, metadata, wallet, or operation state is unavailable or unresolved.
- `pending-operation-dialog`: Present asset-specific pending, unavailable, unknown, and recovery evidence without claiming a failed or empty result.

## Impact

- Affected integration asset types, Arkade mint/list adapters, wallet reservation and mutation coordination, shared inventory preparation, and public exports.
- Affected Admin C.G.1/C.G.2/C.G.3/C.G.4 controls, marketplace catalog verification, metadata classification, and Marketplace inventory/detail/checkout UI.
- Affected durable asset operation records, diagnostic projections, and pending-operation presentation; existing submitted-operation recovery remains authoritative.
- Affected tests across `BIS/packages/integration`, `BIS/packages/integration-admin`, and `BIS/packages/marketplace`, plus live Signet verification.
- No recovery phrase, signing key, raw SDK exception, or private transaction payload may enter logs, metadata, output artifacts, or committed files.

## Open Decisions

- Confirm whether legacy marketplace holdings missing `bisAttributeDeltas` should remain displayable as migration-required items or be excluded from gameplay classification entirely; the proposal recommends exclusion from gameplay and an explicit migration-required state.
- Confirm whether the Admin catalog action should remain a single nine-item button with per-item progress or expose separate operator buttons; the proposal recommends retaining one action while making each item independently retryable.
- Confirm the live Signet Game Wallet and exact current holdings before any burn/remint migration; no wallet identity is assumed by this proposal.
