## ADDED Requirements

### Requirement: Packaged game accepts account equipment state
The packaged Stealth & Steel consumer SHALL retain guest gameplay and its existing Account UI behavior while accepting active BIS equipment state through the public package boundary.

#### Scenario: Packaged game opens with no account
- **WHEN** the production game opens without a BIS account
- **THEN** its Account UI and baseline playable game remain available
- **AND** no marketplace or wallet operation is required

#### Scenario: Packaged game uses an owned selection
- **WHEN** the active player wallet owns a selected item and a player is next spawned
- **THEN** the production game reflects that item's approved effect and icon
- **AND** the game obtained the state through the public BIS package boundary

### Requirement: Packaged game exposes owned-item selection
The packaged-game acceptance flow SHALL cover Settings, then Items, where the active player profile can view its recognized owned-item grid and select at most one Shoes, one Dagger, and one Shield item. It SHALL also cover the three ordered HUD item slots below Gold.

#### Scenario: Player changes an item in the packaged game
- **WHEN** the player selects an owned item in Settings, then Items, and the next player spawn occurs
- **THEN** the corresponding Shoes, Dagger, or Shield HUD slot shows the chain-URL icon
- **AND** the spawned player uses the corresponding approved effect

### Requirement: Packaged acceptance covers multiple player profiles
The packaged-game account acceptance flow SHALL cover a saved-profile chooser that shows shortened public IDs, identifies the active profile, switches between saved profiles without repeating restoration, and offers Create or Restore when adding a profile. Each saved profile SHALL retain its own wallet and equipment state.

#### Scenario: User switches the active player profile
- **WHEN** the user chooses a different saved public ID from the account entry experience
- **THEN** BIS makes that profile active without asking the user to restore it again
- **AND** the packaged game refreshes to that profile's owned and selected items

#### Scenario: User adds another player profile
- **WHEN** the user selects Add Profile
- **THEN** the account experience offers Create and Restore paths
- **AND** completing either path retains the previously saved profiles
