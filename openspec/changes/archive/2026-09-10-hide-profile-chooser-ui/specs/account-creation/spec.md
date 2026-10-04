## MODIFIED Requirements

### Requirement: Created accounts join the saved profile collection
Successful account creation SHALL add the newly committed encrypted identity to the origin-local player profile collection and make it active without replacing other saved profiles. A failed, abandoned, or uncommitted creation SHALL leave the collection unchanged. Repeated completion of the same creation SHALL NOT create a duplicate profile. The production UI SHALL enter the active Account menu without listing, naming, or offering a chooser for the collection.

#### Scenario: Create an additional profile
- **WHEN** creation is successfully committed while another player profile is saved
- **THEN** the new public profile ID becomes active and the active Account menu opens without exposing any saved-profile list or switch control
- **AND** the earlier profile's wallet, equipment selections, and operation records remain unchanged

#### Scenario: Additional creation fails
- **WHEN** creation fails before durable commit
- **THEN** no new saved-profile entry appears
- **AND** every previously saved profile remains unchanged
