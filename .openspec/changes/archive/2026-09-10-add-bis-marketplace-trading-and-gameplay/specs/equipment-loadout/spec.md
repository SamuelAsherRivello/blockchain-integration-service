## Purpose

Let each BIS player profile separately own and actively equip marketplace game items without treating ownership itself as a gameplay choice.

## ADDED Requirements

### Requirement: One active item per equipment family
BIS SHALL let the active player profile select no item or exactly one currently owned Stealth & Steel item in each of the Shoes, Dagger, and Shield families. No item SHALL be selected by default merely because it is owned.

#### Scenario: Player equips catalog items
- **WHEN** a player owns Shoes II, Dagger I, and Shield III
- **THEN** the player can independently select one, none, or another owned item in each corresponding family
- **AND** no family has more than one active selection

#### Scenario: Player has items but has made no selection
- **WHEN** the active profile owns recognized items and has no saved selection
- **THEN** BIS reports all three equipment families as unselected

### Requirement: Effective selections require current ownership
BIS SHALL make a selected item effective only while a fresh ownership read confirms that the active player wallet owns the exact chain asset. A failed ownership check SHALL NOT make an unverified item effective, and BIS SHALL NOT activate an item merely because it appears in a static catalog or another profile.

#### Scenario: Equipped asset is no longer owned
- **WHEN** a fresh ownership read no longer contains the currently active Dagger
- **THEN** BIS clears that Dagger selection and reports it as unavailable
- **AND** it leaves unrelated selections unchanged

#### Scenario: Ownership cannot be verified
- **WHEN** BIS cannot freshly verify ownership of a saved selection
- **THEN** the item is absent from the effective loadout until ownership can be verified
- **AND** guest or baseline gameplay remains available

### Requirement: Selections are profile-scoped local state
BIS SHALL persist equipment selections in origin-local storage under the player profile that made them. Switching the active profile SHALL expose only that profile's selections and SHALL NOT copy, overwrite, or activate selections from another profile.

#### Scenario: Player switches profiles
- **WHEN** the user switches from one saved player profile to another
- **THEN** BIS loads the second profile's own Shoes, Dagger, and Shield selections
- **AND** the first profile's selections remain associated only with the first profile

### Requirement: Public equipment API supports the game UI
The packaged BIS public API SHALL expose the active player wallet's recognized owned items, effective selections, and a way to change each family selection without exposing Arkade-specific types, recovery data, or wallet secrets.

#### Scenario: Game requests items for its Settings page
- **WHEN** Stealth & Steel requests the active profile's item state through the public BIS API
- **THEN** BIS returns the recognized owned items and at most one effective selection per family
- **AND** each returned item includes the chain-provided icon URL and gameplay classification data needed by the game
