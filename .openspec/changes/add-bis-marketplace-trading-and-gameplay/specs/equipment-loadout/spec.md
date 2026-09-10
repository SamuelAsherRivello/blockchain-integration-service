## Purpose

Let a BIS account separately own and actively equip marketplace game items without treating ownership itself as a gameplay choice.

## ADDED Requirements

### Requirement: One active item per equipment family
The BIS Account experience SHALL recognize owned Stealth & Steel catalog assets and let a player select no item or exactly one currently owned item in each of Shoes, Dagger, and Shield families. It SHALL preserve generic non-catalog assets in the existing Assets view.

#### Scenario: Player equips catalog items
- **WHEN** a player owns Shoes II, Dagger I, and Shield III
- **THEN** the player can independently select one, none, or another owned item in each corresponding family
- **AND** no family has more than one active selection

### Requirement: Ownership remains separate from selection
The Account experience SHALL remove an active selection when a fresh ownership read no longer confirms that item and SHALL not activate an item merely because it is owned.

#### Scenario: Equipped asset is no longer owned
- **WHEN** a fresh ownership read no longer contains the currently active Dagger
- **THEN** BIS clears that Dagger selection and reports it as unavailable
- **AND** it leaves unrelated selections unchanged
