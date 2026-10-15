# Spec Delta

## MODIFIED Requirements

### Requirement: Public equipment API supports the game UI

The packaged BIS public API SHALL expose the active player wallet's recognized owned items, effective selections, and a way to change each family selection without exposing Arkade-specific types, recovery data, or wallet secrets. Each recognized item SHALL expose gameplay classification derived from its validated chain-provided `bisAttributeDeltas`; family and tier SHALL remain descriptive or slot metadata and SHALL NOT supply gameplay values.

#### Scenario: Game requests items for its Settings page
- **WHEN** Stealth & Steel requests the active profile's item state through the public BIS API
- **THEN** BIS returns the recognized owned items and at most one effective selection per family
- **AND** each returned item includes the chain-provided icon URL and validated gameplay delta data needed by the game

