## MODIFIED Requirements

### Requirement: Explicit real test account creation
A logged-out player SHALL explicitly select a supported test network and then explicitly start creation. The integration SHALL first verify the configured operator identifies itself as that selected network, then create a genuine account using only that network's configured Arkade integration and derivation. It SHALL show the lightning loader during asynchronous operations and display recovery material immediately on successful creation. It SHALL NOT create accounts merely on opening a dialogue, viewing a story, or refreshing. It SHALL reject unavailable, unsupported, or mismatched operator configuration and SHALL NOT substitute simulated success.

#### Scenario: Create and reveal recovery
- **WHEN** a logged-out player selects Mutinynet, its operator verifies as Mutinynet, and creation succeeds
- **THEN** the recovery screen appears with a clear Mutinynet test-only warning, including never entering or reusing a real-funds recovery phrase
- **AND** no active account or accountConnected event is published yet

#### Scenario: Operator mismatch
- **WHEN** a player selects Signet and the configured operator reports a different network
- **THEN** creation fails safely before a recovery candidate or active account is produced

#### Scenario: Repeated creation requests
- **WHEN** Create Account is requested again while creation is pending
- **THEN** no concurrent identity creation starts

### Requirement: Created accounts join the saved profile collection
Successful account creation SHALL add the newly committed encrypted identity to the selected-network origin-local player profile collection and make it active without replacing other saved profiles on that same network. A failed, abandoned, cross-network, or uncommitted creation SHALL leave every collection unchanged. Repeated completion of the same creation SHALL NOT create a duplicate profile. The production UI SHALL enter the active Account menu without listing, naming, or offering a chooser for the collection.

#### Scenario: Create on selected network
- **WHEN** creation is successfully committed on Signet while Mutinynet records exist locally
- **THEN** the new public profile ID becomes active only in the Signet collection
- **AND** no Mutinynet identity, wallet, or operation state is made active or visible

#### Scenario: Create an additional profile
- **WHEN** creation is successfully committed while another player profile is saved on the selected network
- **THEN** the new public profile ID becomes active without exposing any saved-profile list or switch control
- **AND** the earlier profile's wallet, equipment selections, and operation records remain unchanged

#### Scenario: Additional creation fails
- **WHEN** creation fails before durable commit
- **THEN** no new saved-profile entry appears
- **AND** every previously saved profile remains unchanged
