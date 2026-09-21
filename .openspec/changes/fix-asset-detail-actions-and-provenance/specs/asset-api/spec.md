# Spec Delta

## ADDED Requirements

### Requirement: Asset listings may carry truthful provenance
The public asset listing MAY expose optional source provenance fields for a holding, including a source or mint transaction ID and a mint operation ID, when those values are available from existing durable BIS records or wallet history. Provenance fields SHALL be JSON-safe public strings, SHALL belong to the same account and network as the holding, and SHALL not be required for generic or externally created assets.

The listing SHALL not manufacture provenance, expose recovery material or raw SDK diagnostics, or treat a locally matching name/ticker as evidence of a source transaction.

#### Scenario: Known BIS mint provenance
- **WHEN** a listed holding matches a completed BIS mint record with a transaction ID
- **THEN** the asset record may include that transaction ID and operation ID
- **AND** the values remain attributable to the same account and active network

#### Scenario: Unknown provenance remains safe
- **WHEN** a listed holding has no matching local mint record and wallet history does not provide a source transaction
- **THEN** the asset remains in the successful list with its available generic metadata
- **AND** no placeholder, guessed transaction, recovery data, or raw SDK error is emitted as provenance
