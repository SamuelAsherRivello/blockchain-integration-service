# Spec Delta

## MODIFIED Requirements

### Requirement: Restored accounts join the saved profile collection
Successful restoration SHALL add the verified encrypted identity to the origin-local player profile collection and make it active without replacing other saved profiles. If that public identity is already saved in the selected network scope, restoration SHALL select and activate the existing profile without showing a first-local-profile creation confirmation, creating a duplicate, or overwriting its profile-scoped state. Failed or cancelled restoration SHALL leave the collection unchanged. The production UI SHALL enter the active Account menu without listing, naming, or offering a chooser for the collection.

#### Scenario: Restore an additional identity
- **WHEN** a valid different player identity is successfully restored while another profile is saved
- **THEN** the restored public profile ID becomes active and the active Account menu opens without exposing any saved-profile list or switch control
- **AND** the earlier profile's wallet, equipment selections, and operation records remain unchanged

#### Scenario: Restore an already saved identity
- **WHEN** restoration verifies an identity whose public profile ID already exists in the selected network scope
- **THEN** BIS activates the existing saved profile without adding a duplicate or showing a first-local-profile creation confirmation
- **AND** it preserves that profile's scoped state

#### Scenario: Restore after local logout
- **WHEN** a player creates or restores an account, logs out, and restores the same valid phrase on the same network
- **THEN** BIS recognizes the retained local profile and activates it without another creation confirmation
- **AND** no wallet transaction, funding action, or remote account-registration check is required

#### Scenario: Same phrase on another network
- **WHEN** the same valid phrase is restored after the player changes to a different supported network with no local profile for that network
- **THEN** BIS follows the first-local-profile confirmation flow for that other network
- **AND** it does not copy or activate state from the retained profile on the first network
