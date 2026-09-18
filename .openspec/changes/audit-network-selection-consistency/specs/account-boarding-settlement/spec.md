## ADDED Requirements

### Requirement: Boarding and withdrawal retain account network identity
Boarding quote, submission, live-status, reconciliation, withdrawal, and recovery operations SHALL use the active account's verified test network for every Arkade and Bitcoin route. They SHALL validate network-specific address formats and isolate their pending records and reservations from operations on the other test network.

#### Scenario: Mutinynet boarding lifecycle
- **WHEN** a Mutinynet account prepares, submits, or reconciles a boarding or withdrawal operation
- **THEN** its providers, address validation, records, and recovery reads remain Mutinynet-scoped
- **AND** a Signet record or route cannot establish success or availability
