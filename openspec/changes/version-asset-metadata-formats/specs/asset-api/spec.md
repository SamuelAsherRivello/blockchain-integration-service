# Spec Delta

## ADDED Requirements

### Requirement: Asset listing exposes safe format resolution
The UI-independent asset API SHALL expose JSON-safe resolved format information for a holding when BIS metadata is present. Generic positive holdings, including non-BIS and unrecognized assets, SHALL remain in a successful ownership response. Format resolution SHALL not expose SDK types, raw metadata decode errors, recovery material, or private data.

#### Scenario: Generic external asset is listed
- **WHEN** a wallet owns a positive asset with no BIS format metadata
- **THEN** the generic listing includes the holding and its available metadata
- **AND** it does not falsely report a supported BIS format

#### Scenario: Unsupported BIS version is listed
- **WHEN** a wallet owns a positive holding with an unknown or malformed BIS format version
- **THEN** the successful generic listing includes that holding with a safe unsupported format result
- **AND** it does not classify the holding as current equipment

### Requirement: Non-Admin consumers use only the latest format
Public BIS game-facing and runtime asset-selection APIs SHALL classify, equip, trade, or otherwise respect only holdings resolved as the registry's latest explicit or compatible version. They SHALL not start or resume a migration; they SHALL use a replacement only after Admin has verified its delivery. They SHALL not derive gameplay effects or marketplace eligibility from legacy, malformed, unknown, newer-than-supported, or migration-pending formats.

#### Scenario: Older format remains owned after a newer release
- **WHEN** a user owns a valid earlier-format item after a newer format becomes latest
- **THEN** generic ownership remains visible
- **AND** non-Admin BIS consumers do not select it for gameplay or marketplace behavior
