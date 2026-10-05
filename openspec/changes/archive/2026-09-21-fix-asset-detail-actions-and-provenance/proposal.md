# Proposal

## Why

Owned assets can be listed, but the selected Asset Detail view currently gives the player too little identity and provenance information to act confidently. In particular, Open On Explorer can be unavailable even for a valid holding, and Burn can be unavailable or disconnected from the selected account/network context. The detail view should expose the identifiers needed to verify the holding and should keep both actions tied to the exact asset being inspected.

## What Changes

- Make Open On Explorer available for valid owned asset IDs using the active account's verified test network, with safe disabled-state guidance when an explorer URL genuinely cannot be constructed.
- Keep Burn available for a valid selected owned holding and route its request through the existing explicit confirmation, exact-quantity validation, account/network checks, durable-operation, and unknown-outcome protections. This proposal does not weaken those protections.
- Expand Asset Detail and its copyable report beyond quantity/name/ticker/decimals to include the full Asset ID, active network, explorer URL when available, icon URL when available, and source provenance such as mint operation ID and transaction ID when the current account/history records provide them.
- Display `Not available` for provenance that cannot be established, rather than inferring a transaction from an asset ID, a balance change, or a local name/ticker match.
- Preserve exact base-unit quantities, decimal formatting, metadata safety, external-asset interoperability, narrow-host layout, and selection/scroll/focus behavior.
- Add browser and unit coverage for Signet and Mutinynet explorer routing, valid and invalid asset IDs, action availability, richer copy output, known and unknown provenance, duplicate-action protection, and truthful unavailable states.

## Capabilities

### New Capabilities

<!-- No new capability is introduced. -->

### Modified Capabilities

- `account-assets`: require actionable, network-correct Explorer and Burn controls and a complete, truthful identity/provenance detail report.
- `asset-api`: allow optional source operation and transaction provenance to accompany listed assets when it is available from existing durable records or wallet history, without making it required for generic/external assets.
- `asset-burning`: require the selected asset detail action to preserve the existing explicit confirmation and exact-operation safety contract while avoiding false generic-unavailable results for valid same-network holdings.

## Impact

- `BIS/packages/integration/src/ui/AccountAssets.tsx` and shared asset-detail/report presentation.
- `BIS/packages/integration/src/core/assets.ts`, asset listing/provenance hydration, network-aware explorer URL construction, and existing burn context wiring.
- Account Assets fixtures and browser tests under `BIS/packages/integration-demo/tests/`, plus focused integration tests for provenance and action routing.
- No new server, wallet secret, recovery material, or game-specific asset rule; no fabricated transaction data; no dependency change expected.
