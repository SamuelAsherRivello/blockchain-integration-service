## ADDED Requirements

### Requirement: Saved player profile chooser
When origin-local storage contains saved player profiles, Account entry SHALL list each profile by its shortened public ID, visibly identify the active profile, and let the user activate another saved profile without restoring it again. Selecting Add Profile SHALL offer Create and Restore. Switching profiles SHALL preserve each profile's separately scoped wallet, equipment selections, and operation records; it SHALL NOT cancel, duplicate, or reattribute a submitted operation.

#### Scenario: Switch to a saved profile
- **WHEN** the user selects a saved shortened public ID that is not active
- **THEN** BIS makes that profile active without requesting its recovery phrase
- **AND** the previously active profile remains saved with its own scoped state

#### Scenario: Add another profile
- **WHEN** the user selects Add Profile
- **THEN** Account entry offers Create and Restore paths
- **AND** merely opening either path does not replace or remove a saved profile

#### Scenario: A saved profile has an unresolved operation
- **WHEN** the user switches away from a profile with a pending or unknown submitted operation
- **THEN** the operation remains associated only with its originating profile for later reconciliation
- **AND** the pending operation does not make unrelated profile-selection interaction globally inert
