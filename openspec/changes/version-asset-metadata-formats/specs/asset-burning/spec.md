# Spec Delta

## ADDED Requirements

### Requirement: Admin version-selected burns retain compatibility and safety
An Admin burn initiated for a selected supported format SHALL use that format's compatibility validation before the existing exact holding, network, durable-intent, reservation, and submission protections. Admin SHALL not submit a burn for a holding whose resolved format is incompatible with the selected version or unsupported. This requirement does not loosen normal Asset Detail burn behavior for a valid generic holding.

#### Scenario: Admin burns a selected legacy-compatible holding
- **WHEN** Admin selects `0.0.1` and confirms a holding resolved as compatible `0.0.1`
- **THEN** the format handler validates that holding before the existing guarded burn is submitted
- **AND** the operation retains its exact quantity and durable recovery guarantees

#### Scenario: Selected version does not match holding
- **WHEN** an Admin-selected version differs from the holding's resolved version
- **THEN** no burn submission occurs
- **AND** Admin reports a safe version mismatch rather than treating the holding as current

#### Scenario: Migration retires an old holding
- **WHEN** an automatic version migration has verified delivery of the mapped replacement
- **THEN** retirement of the old holding uses the same exact-quantity guarded burn and durable recovery contract
- **AND** a failed or unknown retirement does not authorize another replacement issuance
