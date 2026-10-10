# Spec Delta

## ADDED Requirements

### Requirement: Trophy uses the common BIS metadata envelope

Player trophies SHALL use the common BIS asset metadata envelope and SHALL carry an empty `bisAttributeDeltas` array. Trophy collection and ownership SHALL not create gameplay attribute changes.

#### Scenario: Trophy is minted
- **WHEN** a player explicitly collects a configured level trophy
- **THEN** the issued trophy contains its native metadata, BIS identity fields, and `bisAttributeDeltas: []`
- **AND** no gameplay attribute is inferred from its level, name, family, or tier

