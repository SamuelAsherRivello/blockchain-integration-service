# Proposal

## Why

Marketplace item metadata currently describes gameplay effects in catalog code, while the issued asset metadata does not provide one authoritative structured source for the game and BIS to consume. This creates a risk that the UI description, item family, tier, or hardcoded catalog values could disagree with the actual gameplay effect, and it makes already-issued assets difficult to validate in an Arkade explorer.

The change will make a structured `bisAttributeDeltas` array authoritative for item gameplay, retain a friendly `bisDescription` for presentation and visual validation, and give trophies the same recognizable metadata shape without gameplay deltas. Existing Marketplace assets will be replaced so the new immutable metadata is present on-chain.

## What Changes

- Add a versioned, flat-compatible item metadata contract with one human-readable `bisDescription` and an authoritative `bisAttributeDeltas` array.
- Define each gameplay delta with `bisAttribute` and `bisAttributeDelta`; percentage deltas are the v1 interpretation and an omitted delta defaults to `0`.
- Require game and BIS gameplay behavior to derive from `bisAttributeDeltas`, never from `bisDescription`, `bisTier`, `bisEquipmentFamily`, catalog IDs, or hardcoded effect tables.
- Preserve catalog, family, tier, price, identity, provenance, and native Arkade fields for classification, display, commerce, and reconciliation only.
- Update trophy issuance to use the same root metadata shape and explicitly use an empty `bisAttributeDeltas` array.
- Extend the public metadata boundary and listing/classification logic to round-trip arrays of structured BIS metadata safely.
- **BREAKING**: Reject new or migrated item metadata that has duplicate attribute entries, invalid delta values, unsupported attributes, or gameplay fields inconsistent with the schema.
- Add a controlled Admin migration path to burn the existing nine Marketplace store items and remint them with the new metadata, verifying the fresh inventory before publication.
- Bring the updated BIS package into the local game, run BIS Admin, Marketplace, and the game through the shared Vite workflow, and verify the end-to-end item purchase, ownership, equipment, and gameplay path.

## Capabilities

### New Capabilities

- `authoritative-gameplay-metadata`: Defines the shared item and trophy metadata shape and the authority rules for structured gameplay deltas.

### Modified Capabilities

- `asset-api`: Generic metadata validation and round-trip behavior must support the structured BIS metadata without assigning game meaning inside the generic API.
- `marketplace-catalog`: Marketplace issuance, classification, display, and migration must use authoritative item deltas and preserve non-gameplay catalog fields for their stated purposes.
- `equipment-loadout`: Recognized owned items and effective selections must expose gameplay classification derived from the chain-provided attribute deltas.
- `level-complete-trophy-reward`: Trophy metadata must use the common item/asset metadata shape while carrying no gameplay deltas.

## Impact

- Affected integration metadata types, validation, Arkade asset issuance/listing adapters, item classification, equipment state, and public exports.
- Affected Admin Marketplace and trophy mint request builders, migration/reconciliation controls, and tests.
- Affected Marketplace rendering and the local game integration contract; gameplay must consume structured deltas rather than catalog constants.
- Affected immutable on-chain inventory: the nine existing Marketplace items require burn and remint operations, producing new asset IDs.
- Affected local preview and verification workflow: shared Vite must serve BIS Admin, Marketplace, Onboarding, and Integration, with the game running from its separate local repository/integration path.
- No recovery phrases, signing material, or private transaction payloads may enter metadata, logs, generated output, or committed files.

## Open Decisions

- Confirm the exact canonical attribute names exposed by the game, beginning with `movementSpeed`, `playerDamage`, and `damageTaken`.
- Confirm whether a migration should burn only the nine currently published Marketplace items or also migrate any other item holdings found in the selected Game Wallet.
- Confirm the selected Game Wallet and funded network/session immediately before the live burn/remint; no wallet identity is assumed by this proposal.

