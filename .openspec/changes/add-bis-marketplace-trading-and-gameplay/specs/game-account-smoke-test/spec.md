## ADDED Requirements

### Requirement: Packaged game accepts account equipment state
The packaged Stealth & Steel consumer SHALL retain guest gameplay and its existing Account UI behavior while accepting an active BIS equipment loadout through the public package boundary.

#### Scenario: Packaged game opens with no account
- **WHEN** the production game opens without a BIS account
- **THEN** its Account UI and baseline playable game remain available
- **AND** no marketplace or wallet operation is required
