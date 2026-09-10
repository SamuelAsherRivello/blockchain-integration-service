## ADDED Requirements

### Requirement: Restored accounts join the saved profile collection
Successful restoration SHALL add the verified encrypted identity to the origin-local player profile collection and make it active without replacing other saved profiles. If that public identity is already saved, restoration SHALL select the existing profile without creating a duplicate or overwriting its profile-scoped state. Failed or cancelled restoration SHALL leave the collection unchanged.

#### Scenario: Restore an additional identity
- **WHEN** a valid different player identity is successfully restored while another profile is saved
- **THEN** the restored public profile ID becomes active and both profiles remain available
- **AND** the earlier profile's wallet, equipment selections, and operation records remain unchanged

#### Scenario: Restore an already saved identity
- **WHEN** restoration verifies an identity whose public profile ID already exists in the collection
- **THEN** BIS activates the existing saved profile without adding a duplicate
- **AND** it preserves that profile's scoped state
