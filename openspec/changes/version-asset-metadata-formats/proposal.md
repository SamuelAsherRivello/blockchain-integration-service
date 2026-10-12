# Proposal

## Why

Immutable Arkade assets can outlive a change to BIS metadata shape. Today, consumers classify metadata field-by-field without an explicit compatibility contract, so an older holding can fail listing, catalog operations, or a later burn after its format changes. BIS needs an on-chain format identity and a controlled compatibility boundary before another format is introduced.

## What Changes

- Stamp every newly issued BIS asset with the explicit custom metadata field `bisAssetFormatVersion: "0.0.1"`; retain the existing metadata names, values, byte transport, and structured `bisAttributeDeltas` JSON representation unchanged.
- Add a public, JSON-safe asset-format resolution result to BIS listings. It distinguishes the supported explicit version, known legacy metadata shapes, unknown versions, and malformed version values without hiding a generic positive holding.
- Introduce a central format registry. Each registered version owns its metadata decoder, strict marketplace validator/classifier, catalog mint request, listing filter, and Admin compatibility operations. `0.0.1` is the initial/latest registered version.
- Give every Admin asset-listing surface a version selector. It defaults to the latest version, lists only versions that the registry supports for the scoped holdings, and directs mint, list, verification, and burn/reconciliation operations through the selected version's handler. Unsupported and malformed holdings remain safely visible as non-operable diagnostics rather than being treated as the selected version.
- Make BIS runtime/game-facing and Marketplace consumers latest-only: they resolve and use assets only when their explicit resolved format equals the registry's latest version. They neither infer effects nor perform marketplace actions for legacy, unknown, malformed, or future-version assets. Generic ownership listing remains complete.
- Preserve existing unversioned assets through an explicit `0.0.1` legacy-shape resolver when their current metadata validates as the unchanged `0.0.1` contract. Other historical shapes are surfaced to Admin as unsupported legacy holdings for inspection, but are never silently relabeled or mutated.
- Make each successor format declare an upgrade policy and a version-to-version migration. Automatic upgrade is enabled by default: when an eligible owned item of an earlier supported format is encountered, BIS creates and delivers the mapped latest-format replacement and only then retires the prior holding through the existing guarded burn path. A format designer may explicitly disable automatic upgrade, leaving the old item version-scoped and available for Admin-directed migration.
- Keep durable operation identity, burn reservation/recovery, exact quantity revalidation, current network checks, and existing no-secret/public-output safeguards unchanged.

## Capabilities

### New Capabilities

- `asset-format-versioning`: Define the immutable metadata format marker, resolver/registry semantics, legacy recognition, latest-version policy, and safe compatibility diagnostics.

### Modified Capabilities

- `asset-api`: Mint versioned BIS metadata and expose resolved format information while preserving complete generic listings.
- `account-assets`: Give Admin-hosted asset listing and detail operations an explicit version selection while retaining complete, safe ownership inspection.
- `asset-burning`: Route Admin-selected legacy/current operations through the matching format handler without weakening existing burn safety.
- `admin-game-wallet`: Require C.G.3 and C.G.4 to use the selected asset format and active Game Wallet scope.
- `marketplace-catalog`: Mint and classify only the current registered format outside Admin, and keep Marketplace latest-only.

## Impact

- Affected integration asset types, metadata normalization/Arkade adapters, public exports, asset inventory preparation, marketplace classification, and burn/mint/catalog coordinators.
- Affected Admin Asset views and C.G.2/C.G.3/C.G.4 controls, including test hosts and console diagnostics.
- Affected Marketplace and game-facing asset consumers, which will reject non-latest formats for gameplay/trading while retaining generic ownership visibility where applicable.
- Affected durable migration records, replacement asset identities, and recovery/UI states. An interrupted upgrade never discards the old holding or issues a duplicate replacement.
- No metadata migration, automatic burn/remint, SDK change, hosted service, recovery material, signing material, or raw provider error exposure is introduced.
