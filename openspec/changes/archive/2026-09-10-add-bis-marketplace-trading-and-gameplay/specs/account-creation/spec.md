## ADDED Requirements

### Requirement: Created accounts join the saved profile collection
Successful account creation SHALL add the newly committed encrypted identity to the origin-local player profile collection and make it active without replacing other saved profiles. A failed, abandoned, or uncommitted creation SHALL leave the collection unchanged. Repeated completion of the same creation SHALL NOT create a duplicate profile.

#### Scenario: Create an additional profile
- **WHEN** creation is successfully committed while another player profile is saved
- **THEN** the new public profile ID becomes active and both profiles remain available in Account entry
- **AND** the earlier profile's wallet, equipment selections, and operation records remain unchanged

#### Scenario: Additional creation fails
- **WHEN** creation fails before durable commit
- **THEN** no new saved-profile entry appears
- **AND** every previously saved profile remains unchanged
