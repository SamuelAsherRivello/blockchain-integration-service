# Spec Delta

## Purpose

Define a common, inspectable metadata envelope for BIS items and trophies, with structured item attribute deltas as the sole authoritative source of gameplay changes.

## ADDED Requirements

### Requirement: Common BIS asset metadata envelope

BIS-issued items and trophies SHALL use Arkade's native `name`, `ticker`, `decimals`, and `icon` fields together with the shared BIS identity fields `bisKind`, `bisSchemaVersion`, `bisOperationId`, `bisGameId`, `bisAssetType`, `bisCatalogId`, `bisEquipmentFamily`, `bisTier`, and `bisPriceSats` where applicable. All custom fields SHALL use the `bis` prefix.

#### Scenario: Item metadata is inspected
- **WHEN** a user opens an issued marketplace item in an explorer
- **THEN** the raw metadata contains the native fields and the shared BIS identity fields
- **AND** every custom metadata key begins with `bis`

#### Scenario: Trophy metadata is inspected
- **WHEN** a player trophy is issued
- **THEN** it uses the same common envelope with `bisAssetType` identifying it as a trophy
- **AND** it contains `bisAttributeDeltas: []`

### Requirement: Authoritative item attribute deltas

For an item, `bisAttributeDeltas` SHALL be the only metadata source that can determine gameplay changes. Each entry SHALL contain `bisAttribute` and a numeric `bisAttributeDelta`; v1 deltas SHALL be percentages, missing deltas SHALL mean zero, and duplicate attributes SHALL be invalid.

#### Scenario: Game applies an item
- **WHEN** a currently owned item is equipped
- **THEN** gameplay applies only its validated `bisAttributeDeltas`
- **AND** it does not derive gameplay values from `bisDescription`, `bisTier`, `bisEquipmentFamily`, `bisCatalogId`, price, or item name

#### Scenario: Friendly description disagrees with a delta
- **WHEN** `bisDescription` does not match the structured delta
- **THEN** the item remains governed by the structured delta
- **AND** the description is treated as presentation text only

#### Scenario: Multiple item changes
- **WHEN** an item contains multiple valid delta entries
- **THEN** the game exposes and applies each supported attribute delta
- **AND** a repeated `bisAttribute` causes the item metadata to be rejected

### Requirement: Metadata validation and safe compatibility

BIS SHALL validate the structured metadata before minting or recognizing a gameplay item, preserve unknown generic assets as generic holdings, and retain legacy recognized items only when their existing metadata remains valid without inventing missing gameplay deltas.

#### Scenario: Invalid structured metadata
- **WHEN** an item has a non-numeric delta, an unsupported attribute, a duplicate attribute, or malformed `bisAttributeDeltas`
- **THEN** BIS rejects the item for gameplay classification
- **AND** generic asset listing remains available without applying an unverified effect

