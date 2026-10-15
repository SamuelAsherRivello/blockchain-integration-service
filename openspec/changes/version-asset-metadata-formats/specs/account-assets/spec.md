# Spec Delta

## ADDED Requirements

### Requirement: Admin asset inspection is version scoped without hiding ownership
When the Assets experience is hosted in Admin, it SHALL provide an asset-format selector for the active account/network. The selector SHALL default to the registry's latest version and offer supported versions represented by the current complete ownership snapshot. Selecting a version SHALL scope Admin operational views to compatible holdings of that version, while an unsupported/legacy diagnostic view remains available and generic ownership is never discarded or presented as another version.

#### Scenario: Admin changes selected format
- **WHEN** the active Admin account owns compatible `0.0.1` assets and a later supported version
- **THEN** the selector defaults to the latest version and changing it shows only holdings compatible with the selected version for versioned operations
- **AND** the account's complete generic ownership data remains available for safe inspection

#### Scenario: Unsupported holding is present
- **WHEN** the current snapshot contains an unknown, malformed, or unrecognized historical BIS holding
- **THEN** Admin displays safe diagnostic information without offering it as a selected supported version
- **AND** the holding is not silently hidden or relabeled

#### Scenario: Upgrade is waiting for a safe mutation scope
- **WHEN** an earlier-format holding has an enabled automatic upgrade but its owner, issuer, funding source, or durable recovery state is not eligible
- **THEN** Admin presents the holding and a safe upgrade-pending reason
- **AND** Admin does not claim the holding changed or hide it from inspection
