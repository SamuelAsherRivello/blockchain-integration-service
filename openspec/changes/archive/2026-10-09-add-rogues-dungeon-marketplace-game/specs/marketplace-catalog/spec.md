# Spec Delta

## ADDED Requirements

### Requirement: Empty registered games are browseable

The Marketplace SHALL expose each registered game identity as a selectable game option, including games with no implementation, wallet address, catalog items, or inventory. Selecting a game without published assets SHALL show a truthful empty state and SHALL NOT fabricate equipment or minting availability.

#### Scenario: Visitor selects Rogue's Dungeon before the game exists

- **WHEN** a visitor selects `Rogue's Dungeon` in the Marketplace game filter
- **THEN** `Rogue's Dungeon` remains visibly selected
- **AND** the Marketplace shows that no equipment is currently available for that game
- **AND** the Marketplace does not require a Rogue's Dungeon wallet, request Rogue's Dungeon inventory, or start a mint, transfer, or trading operation

#### Scenario: Stealth & Steel remains available beside the empty game

- **WHEN** a visitor switches from `Rogue's Dungeon` to `Stealth & Steel`
- **THEN** the existing Stealth & Steel catalog and registered game-wallet inventory behavior remains available
- **AND** the presence of `Rogue's Dungeon` does not change Stealth & Steel item classification, prices, artwork, or ownership state

#### Scenario: Empty game is not an Admin mint target

- **WHEN** an administrator uses the existing Marketplace catalog issuance workflow
- **THEN** only the existing defined Stealth & Steel catalog items are eligible for that workflow
- **AND** the registered `Rogue's Dungeon` identity is not represented as a mintable item or as a verified issued catalog
